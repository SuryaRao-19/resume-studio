// Passwordless (magic-link) auth helpers.
//
// - Magic-link tokens are random, single-use, hashed at rest, and short-lived.
// - Sessions are stateless signed JWTs stored in an httpOnly cookie.

import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export const SESSION_COOKIE = "rs_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAGIC_TTL_MS = 1000 * 60 * 15; // 15 minutes

export interface SessionPayload {
  userId: string;
  email: string;
}

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.authSecret, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.authSecret) as SessionPayload;
    if (!decoded.userId || !decoded.email) return null;
    return { userId: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
}

// A magic-link token: the raw value goes in the URL, only its hash is stored.
export function createMagicToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  return { raw, hash, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "lax" as const,
  maxAge: SESSION_TTL_SECONDS * 1000,
  path: "/",
};
