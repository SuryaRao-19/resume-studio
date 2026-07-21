-- Persistent rate-limit events. One row per allowed AI request, keyed by user
-- id (or IP). A sliding-window count over created_at enforces the per-hour
-- limit; rows outside the window are pruned opportunistically and by the
-- background cleanup sweep. No RLS: these are counters, not user data.

CREATE TABLE "rate_events" (
  "id"         UUID PRIMARY KEY,
  "key"        TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "rate_events_key_created_at_idx" ON "rate_events" ("key", "created_at");
