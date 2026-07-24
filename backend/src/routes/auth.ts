// Auth routes: magic-link request, verify, session info, logout.

import { Router, type Request } from "express";
import { prisma } from "../db.js";
import { env } from "../env.js";
import {
  SESSION_COOKIE,
  createMagicToken,
  hashToken,
  createSessionToken,
  sessionCookieOptions,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The origin to build the sign-in link against. On the single-domain deploy the
// frontend and API share a host, so derive it from the request itself — that way
// the link points at whatever host actually served the app (Vercel prod, a
// preview URL, or localhost) with no FRONTEND_ORIGIN needed. An explicitly
// configured FRONTEND_ORIGIN (a split frontend/backend deploy) still wins.
function signInBaseUrl(req: Request): string {
  if (process.env.FRONTEND_ORIGIN?.trim()) return env.frontendOrigin;
  const origin = req.get("origin");
  if (origin) return origin.replace(/[^\x21-\x7E]/g, "");
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0] || req.protocol;
  const host = req.get("host");
  if (host) return `${proto}://${host}`;
  return env.frontendOrigin;
}

// POST /api/auth/request-link  { email }
authRouter.post("/request-link", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const { raw, hash, expiresAt } = createMagicToken();
    await prisma.magicToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });

    const link = `${signInBaseUrl(req)}/verify?token=${raw}`;

    // DEV: log the link. Wire a real email provider here for production.
    console.log(`\n[magic-link] Sign-in link for ${email}:\n${link}\n`);

    // Always respond the same way so email existence can't be probed.
    res.json({ ok: true, message: "Check your email for a sign-in link." });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/verify?token=...
authRouter.get("/verify", async (req, res, next) => {
  try {
    const raw = String(req.query.token ?? "");
    if (!raw) {
      res.status(400).json({ error: "Missing sign-in token." });
      return;
    }

    const tokenHash = hashToken(raw);
    const record = await prisma.magicToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      // Clean up an expired record if present.
      if (record) {
        await prisma.magicToken.delete({ where: { id: record.id } }).catch(() => {});
      }
      res.status(400).json({ error: "This sign-in link is invalid or has expired." });
      return;
    }

    // Single-use: consume the token.
    await prisma.magicToken.delete({ where: { id: record.id } });

    const session = createSessionToken({
      userId: record.user.id,
      email: record.user.email,
    });
    res.cookie(SESSION_COOKIE, session, sessionCookieOptions);
    res.json({ ok: true, email: record.user.email });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ email: req.user!.email });
});

// POST /api/auth/logout
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
