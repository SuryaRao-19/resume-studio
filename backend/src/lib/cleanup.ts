// Background hygiene: periodically delete expired magic-link tokens and stale
// rate-limit events so those tables don't grow unbounded. Consumed tokens are
// already deleted on verify; this sweeps the ones that were never used.

import { prisma } from "../db.js";

const SWEEP_INTERVAL_MS = 1000 * 60 * 15; // every 15 minutes
const RATE_EVENT_TTL_MS = 1000 * 60 * 60; // 1 hour (matches the rate window)

async function sweep(): Promise<void> {
  const now = new Date();
  try {
    await prisma.magicToken.deleteMany({ where: { expiresAt: { lt: now } } });
    await prisma.rateEvent.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RATE_EVENT_TTL_MS) } },
    });
  } catch (err) {
    console.error("[cleanup] sweep failed:", err);
  }
}

// Starts the recurring sweep and returns a stop function. unref() so the timer
// never keeps the process alive on its own.
export function startCleanup(): () => void {
  void sweep();
  const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
