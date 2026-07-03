import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { prisma } from "../prisma.js";

export interface AccessTokenPayload {
  sub: string; // user id
  username: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new Error("Malformed access token");
  }
  return { sub: decoded.sub, username: (decoded as jwt.JwtPayload).username as string };
}

// Refresh tokens are opaque random strings; only a SHA-256 hash is stored,
// so a DB leak cannot be replayed as live sessions.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return token;
}

/**
 * Validates a refresh token and rotates it: the old row is revoked and a new
 * token issued atomically. Returns null when the token is unknown, expired,
 * or already revoked (possible replay).
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; newToken: string } | null> {
  const tokenHash = hashToken(token);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }
  const newToken = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    const fresh = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await tx.refreshToken.create({
      data: { userId: existing.userId, tokenHash: hashToken(fresh), expiresAt },
    });
    return fresh;
  });
  return { userId: existing.userId, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
