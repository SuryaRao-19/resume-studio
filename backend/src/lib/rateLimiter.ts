// Postgres-backed sliding-window rate limiter, keyed per identity (user id if
// authenticated, otherwise IP). Unlike an in-memory limiter, this survives
// restarts and holds across multiple instances sharing one database.

import { prisma } from "../db.js";

const WINDOW_MS = 1000 * 60 * 60; // 1 hour

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(key: string, limit: number): Promise<RateResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const count = await prisma.rateEvent.count({
    where: { key, createdAt: { gte: windowStart } },
  });

  if (count >= limit) {
    const oldest = await prisma.rateEvent.findFirst({
      where: { key, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryAfterSeconds = oldest
      ? Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - oldest.createdAt.getTime())) / 1000))
      : 60;
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  await prisma.rateEvent.create({ data: { key } });
  // Opportunistically prune this key's expired rows so the table stays small.
  await prisma.rateEvent
    .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
    .catch(() => {});

  return { allowed: true, remaining: limit - count - 1, retryAfterSeconds: 0 };
}
