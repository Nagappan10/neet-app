import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, username: true, displayName: true, createdAt: true },
    });
    if (!user) throw new HttpError(404, "User not found");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
