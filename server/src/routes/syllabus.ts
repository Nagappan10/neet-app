import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const syllabusRouter = Router();

// All syllabus routes require a logged-in user.
syllabusRouter.use(requireAuth);

/** Subjects with chapter counts and total PYQ weighting. */
syllabusRouter.get("/subjects", async (_req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { chapters: true } } },
    });
    const weights = await prisma.chapter.groupBy({
      by: ["subjectId"],
      _sum: { weighting: true },
    });
    const weightBySubject = new Map(weights.map((w) => [w.subjectId, w._sum.weighting ?? 0]));
    res.json({
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        chapterCount: s._count.chapters,
        pyqTotal: weightBySubject.get(s.id) ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Chapters for a subject, ordered, with weighting/topics/analysis. */
syllabusRouter.get("/subjects/:subjectId/chapters", async (req, res, next) => {
  try {
    const chapters = await prisma.chapter.findMany({
      where: { subjectId: req.params.subjectId },
      orderBy: [{ weighting: "desc" }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        className: true,
        order: true,
        weighting: true,
        ntaIncluded: true,
        topics: true,
        analysis: true,
      },
    });
    res.json({ chapters });
  } catch (err) {
    next(err);
  }
});
