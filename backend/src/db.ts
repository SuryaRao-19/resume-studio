// Prisma client plus an RLS-aware transaction helper.
//
// Every read/write against resumes / resume_reports goes through `withUser`,
// which opens a transaction and sets `app.current_user_id` so the Postgres
// row-level security policies (see the init migration) apply as a second layer
// of defense behind the explicit user_id filters in the route handlers.

import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { env } from "./env.js";

// Pass the cleaned URL explicitly instead of letting Prisma read the raw
// env("DATABASE_URL"), so a whitespace-mangled dashboard value can't break it.
//
// Cache the client on globalThis so warm serverless invocations (and dev hot
// reloads) reuse a single instance instead of opening a fresh connection pool
// each time, which would exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
  });

if (!env.isProd) globalForPrisma.prisma = prisma;

type TxClient = Prisma.TransactionClient;

export async function withUser<T>(
  userId: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(..., true) => local to this transaction only.
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.current_user_id', $1, true)",
      userId
    );
    return fn(tx);
  });
}
