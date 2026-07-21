// Portable e2e auth: seed a single-use magic-link token straight into Postgres
// (matching the app's sha256 hashing), then sign in by visiting /verify?token=.
// Avoids scraping the backend console and doesn't weaken the app.

import crypto from "node:crypto";
import pg from "pg";
import type { Page } from "@playwright/test";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://resume_app:resume_app_pw@127.0.0.1:5433/resume_studio";

const MAGIC_TTL_MS = 1000 * 60 * 15;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Ensures a user exists and inserts a fresh magic token; returns the raw token.
export async function seedMagicToken(email: string): Promise<string> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const userRes = await client.query(
      `INSERT INTO users (id, email)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [crypto.randomUUID(), email.toLowerCase()]
    );
    const userId = userRes.rows[0].id as string;

    const raw = crypto.randomBytes(32).toString("base64url");
    await client.query(
      `INSERT INTO magic_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), userId, hashToken(raw), new Date(Date.now() + MAGIC_TTL_MS)]
    );
    return raw;
  } finally {
    await client.end();
  }
}

// Signs a page in as `email` and waits for the authenticated Studio to render.
export async function signIn(page: Page, email: string): Promise<void> {
  const token = await seedMagicToken(email);
  await page.goto(`/verify?token=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: "Draft resume" }).waitFor({ state: "visible" });
}
