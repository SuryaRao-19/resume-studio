// Authentication middleware. Reads the session cookie, verifies the JWT, and
// attaches the user to the request. Also provides the per-user rate limiter.

import type { Request, Response, NextFunction } from "express";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimiter.js";
import { env } from "../env.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    res.status(401).json({ error: "You need to sign in to do that." });
    return;
  }
  req.user = session;
  next();
}

// Rate limit AI endpoints per authenticated user (falls back to IP).
export async function rateLimitAi(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.user?.userId ?? req.ip ?? "anonymous";
    const result = await checkRateLimit(key, env.rateLimitPerHour);
    if (!result.allowed) {
      const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      res.status(429).json({
        error: `You've hit the hourly limit. Please try again in about ${minutes} minute${
          minutes === 1 ? "" : "s"
        }.`,
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
