import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { Prisma } from "@prisma/client";

export const questionsRouter = Router();
questionsRouter.use(requireAuth);

const listQuery = z.object({
  subjectId: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  type: z.enum(["mcq", "assertion_reason", "diagram", "statement_match"]).optional(),
  diagram: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** Counts per subject for the bank overview. */
questionsRouter.get("/stats", async (_req, res, next) => {
  try {
    const grouped = await prisma.question.groupBy({
      by: ["subjectId"],
      where: { validated: true },
      _count: { _all: true },
    });
    const total = grouped.reduce((s, g) => s + g._count._all, 0);
    res.json({
      total,
      bySubject: Object.fromEntries(grouped.map((g) => [g.subjectId, g._count._all])),
    });
  } catch (err) {
    next(err);
  }
});

/** Paginated, filterable list of validated questions. */
questionsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    const { subjectId, difficulty, type, diagram, page, pageSize } = parsed.data;
    const where: Prisma.QuestionWhereInput = {
      validated: true,
      ...(subjectId ? { subjectId } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(type ? { type } : {}),
      ...(diagram ? { isDiagram: diagram === "true" } : {}),
    };

    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          stem: true,
          options: true,
          correctIndex: true,
          explanation: true,
          difficulty: true,
          type: true,
          isDiagram: true,
          source: true,
          subject: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({ total, page, pageSize, questions });
  } catch (err) {
    next(err);
  }
});
