import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../auth/tokens.js";
import { env, isProd } from "../env.js";
import { HttpError } from "../middleware/error.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
});
authRouter.use(authLimiter);

const REFRESH_COOKIE = "neet_refresh";

function setRefreshCookie(res: import("express").Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may contain letters, digits and _ only"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1, "Display name is required").max(50),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { username, password, displayName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new HttpError(409, "Username is already taken");

    const user = await prisma.user.create({
      data: { username, displayName, passwordHash: await hashPassword(password) },
    });

    const accessToken = signAccessToken({ sub: user.id, username: user.username });
    setRefreshCookie(res, await issueRefreshToken(user.id));
    res.status(201).json({
      accessToken,
      user: { id: user.id, username: user.username, displayName: user.displayName },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid username or password");
    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    // Same error for unknown user and wrong password — no username probing.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid username or password");
    }

    const accessToken = signAccessToken({ sub: user.id, username: user.username });
    setRefreshCookie(res, await issueRefreshToken(user.id));
    res.json({
      accessToken,
      user: { id: user.id, username: user.username, displayName: user.displayName },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new HttpError(401, "No refresh token");

    const rotated = await rotateRefreshToken(token);
    if (!rotated) {
      res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      throw new HttpError(401, "Refresh token invalid or expired");
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new HttpError(401, "User no longer exists");

    const accessToken = signAccessToken({ sub: user.id, username: user.username });
    setRefreshCookie(res, rotated.newToken);
    res.json({
      accessToken,
      user: { id: user.id, username: user.username, displayName: user.displayName },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) await revokeRefreshToken(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
