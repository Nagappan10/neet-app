import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const testsRouter = Router();
testsRouter.use(requireAuth);

// NEET marking scheme.
const MARK_CORRECT = 4;
const MARK_WRONG = -1;

const buildSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  subjectId: z.string().optional(),
  chapterIds: z.array(z.string()).optional(),
  count: z.coerce.number().int().min(1).max(180).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  durationSec: z.coerce.number().int().min(60).max(4 * 60 * 60),
});

/** Build a test: pick validated questions, create a template + started attempt. */
testsRouter.post("/build", async (req, res, next) => {
  try {
    const parsed = buildSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    const { name, subjectId, chapterIds, count, difficulty, durationSec } = parsed.data;

    const where: Prisma.QuestionWhereInput = {
      validated: true,
      ...(subjectId ? { subjectId } : {}),
      ...(chapterIds && chapterIds.length
        ? { chapters: { some: { chapterId: { in: chapterIds } } } }
        : {}),
      ...(difficulty ? { difficulty } : {}),
    };

    const poolSize = await prisma.question.count({ where });
    if (poolSize === 0) {
      throw new HttpError(
        409,
        "No questions match that selection yet. Generate some for this chapter first.",
      );
    }

    // Random selection without loading the whole pool: sample distinct offsets.
    const take = Math.min(count, poolSize);
    const offsets = sampleOffsets(poolSize, take);
    const ids: string[] = [];
    for (const off of offsets) {
      const row = await prisma.question.findMany({
        where,
        select: { id: true },
        orderBy: { id: "asc" },
        skip: off,
        take: 1,
      });
      if (row[0]) ids.push(row[0].id);
    }

    const template = await prisma.testTemplate.create({
      data: {
        name: name ?? "Practice test",
        mode: "custom",
        config: { subjectId, chapterIds, count: ids.length, difficulty, durationSec },
      },
    });

    const attempt = await prisma.testAttempt.create({
      data: {
        userId: req.user!.sub,
        templateId: template.id,
        durationSec,
        answers: { questionIds: ids, responses: {} },
      },
    });

    // Return questions WITHOUT the answer key (this is a live test).
    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        stem: true,
        options: true,
        type: true,
        isDiagram: true,
        subject: { select: { name: true } },
      },
    });
    // Preserve the sampled order.
    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    res.status(201).json({
      attemptId: attempt.id,
      name: template.name,
      durationSec,
      questions: ordered,
    });
  } catch (err) {
    next(err);
  }
});

const submitSchema = z.object({
  // questionId -> chosen option index (0..3); omit for unattempted
  responses: z.record(z.string(), z.number().int().min(0).max(3)),
});

/** Submit answers, score with +4/-1/0, persist, return the scorecard. */
testsRouter.post("/:attemptId/submit", async (req, res, next) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid submission");

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: req.params.attemptId },
    });
    if (!attempt || attempt.userId !== req.user!.sub) throw new HttpError(404, "Attempt not found");
    if (attempt.submittedAt) throw new HttpError(409, "This attempt is already submitted");

    const meta = attempt.answers as { questionIds: string[] };
    const questions = await prisma.question.findMany({
      where: { id: { in: meta.questionIds } },
      select: { id: true, correctIndex: true, subjectId: true },
    });
    const correctById = new Map(questions.map((q) => [q.id, q.correctIndex]));
    const subjectById = new Map(questions.map((q) => [q.id, q.subjectId]));

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    let score = 0;
    const section: Record<string, { correct: number; wrong: number; unattempted: number; score: number }> = {};

    const bump = (sid: string, key: "correct" | "wrong" | "unattempted", pts: number) => {
      section[sid] ??= { correct: 0, wrong: 0, unattempted: 0, score: 0 };
      section[sid][key]++;
      section[sid].score += pts;
    };

    for (const qid of meta.questionIds) {
      const sid = subjectById.get(qid) ?? "unknown";
      const chosen = parsed.data.responses[qid];
      if (chosen === undefined) {
        unattempted++;
        bump(sid, "unattempted", 0);
      } else if (chosen === correctById.get(qid)) {
        correct++;
        score += MARK_CORRECT;
        bump(sid, "correct", MARK_CORRECT);
      } else {
        wrong++;
        score += MARK_WRONG;
        bump(sid, "wrong", MARK_WRONG);
      }
    }

    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        answers: { ...meta, responses: parsed.data.responses },
        score,
        correct,
        wrong,
        unattempted,
        sectionBreakdown: section,
      },
    });

    res.json({
      attemptId: updated.id,
      score,
      correct,
      wrong,
      unattempted,
      total: meta.questionIds.length,
      maxScore: meta.questionIds.length * MARK_CORRECT,
      sectionBreakdown: section,
    });
  } catch (err) {
    next(err);
  }
});

/** Full review of a submitted attempt: each question with your answer vs correct. */
testsRouter.get("/:attemptId/review", async (req, res, next) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: req.params.attemptId },
    });
    if (!attempt || attempt.userId !== req.user!.sub) throw new HttpError(404, "Attempt not found");
    if (!attempt.submittedAt) throw new HttpError(409, "Attempt not submitted yet");

    const meta = attempt.answers as { questionIds: string[]; responses: Record<string, number> };
    const questions = await prisma.question.findMany({
      where: { id: { in: meta.questionIds } },
      select: {
        id: true,
        stem: true,
        options: true,
        correctIndex: true,
        explanation: true,
        source: true,
        subject: { select: { name: true } },
      },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const review = meta.questionIds
      .map((id) => {
        const q = byId.get(id);
        if (!q) return null;
        return { ...q, chosenIndex: meta.responses[id] ?? null };
      })
      .filter(Boolean);

    res.json({
      score: attempt.score,
      correct: attempt.correct,
      wrong: attempt.wrong,
      unattempted: attempt.unattempted,
      sectionBreakdown: attempt.sectionBreakdown,
      review,
    });
  } catch (err) {
    next(err);
  }
});

/** A user's own attempt history. */
testsRouter.get("/history", async (req, res, next) => {
  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { userId: req.user!.sub, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 50,
      include: { template: { select: { name: true, mode: true } } },
    });
    res.json({
      attempts: attempts.map((a) => ({
        id: a.id,
        name: a.template.name,
        mode: a.template.mode,
        submittedAt: a.submittedAt,
        score: a.score,
        correct: a.correct,
        wrong: a.wrong,
        unattempted: a.unattempted,
        total: a.correct + a.wrong + a.unattempted,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Distinct random offsets in [0, poolSize). */
function sampleOffsets(poolSize: number, take: number): number[] {
  if (take >= poolSize) return Array.from({ length: poolSize }, (_, i) => i);
  const chosen = new Set<number>();
  while (chosen.size < take) chosen.add(Math.floor(Math.random() * poolSize));
  return [...chosen];
}
