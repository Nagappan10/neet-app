import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { aiConfigured, generateQuestions, getProvider, MissingApiKeyError } from "../agent/index.js";
import type { Difficulty } from "@prisma/client";

export const agentRouter = Router();
agentRouter.use(requireAuth);

/** Whether on-demand generation is available (AI key present). */
agentRouter.get("/status", (_req, res) => {
  res.json({ configured: aiConfigured() });
});

const genSchema = z.object({
  chapterId: z.string(),
  count: z.coerce.number().int().min(1).max(15).default(5),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
});

/**
 * Generate + validate fresh questions for a chapter, then cache them in the
 * bank (source=ai-generated, validated=true — only questions that passed both
 * the structural and second-pass answer checks are stored).
 */
agentRouter.post("/generate-questions", async (req, res, next) => {
  try {
    const parsed = genSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid input");
    const { chapterId, count, difficulty } = parsed.data;

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { subject: true },
    });
    if (!chapter) throw new HttpError(404, "Chapter not found");

    const provider = getProvider();
    const result = await generateQuestions(provider, {
      subject: chapter.subject.name,
      chapterTitle: chapter.title,
      topics: chapter.topics,
      count,
      difficulty,
    });

    // Persist validated questions, tagged to this chapter.
    const created = await Promise.all(
      result.questions.map((q) =>
        prisma.question.create({
          data: {
            subjectId: chapter.subjectId,
            stem: q.stem,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            difficulty: q.difficulty as Difficulty,
            type: "mcq",
            isDiagram: false,
            source: "ai-generated",
            validated: true,
            chapters: { create: [{ chapterId }] },
          },
          select: { id: true },
        }),
      ),
    );

    res.json({
      created: created.length,
      requested: result.requested,
      rejectedStructure: result.rejectedStructure,
      rejectedAnswerCheck: result.rejectedAnswerCheck,
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      next(new HttpError(503, err.message));
      return;
    }
    // Surface provider/network errors as a clean 502 rather than a 500.
    if (err instanceof Error && /API error|empty response|JSON/.test(err.message)) {
      next(new HttpError(502, `Generation failed: ${err.message}`));
      return;
    }
    next(err);
  }
});
