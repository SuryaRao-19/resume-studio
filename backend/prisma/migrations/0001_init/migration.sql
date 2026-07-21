-- Resume Studio initial migration.
-- Creates the core tables and enables Postgres row-level security (RLS) as a
-- second layer of defense on top of application-level user_id filtering.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE "users" (
  "id"         UUID PRIMARY KEY,
  "email"      TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

CREATE TABLE "resumes" (
  "id"          UUID PRIMARY KEY,
  "user_id"     UUID NOT NULL,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "mode_origin" TEXT NOT NULL,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "resumes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX "resumes_user_id_idx" ON "resumes" ("user_id");

CREATE TABLE "resume_reports" (
  "id"              UUID PRIMARY KEY,
  "resume_id"       UUID NOT NULL,
  "type"            TEXT NOT NULL,
  "score"           INTEGER NOT NULL,
  "report_json"     JSONB NOT NULL,
  "job_description" TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "resume_reports_resume_id_fkey"
    FOREIGN KEY ("resume_id") REFERENCES "resumes" ("id") ON DELETE CASCADE
);
CREATE INDEX "resume_reports_resume_id_idx" ON "resume_reports" ("resume_id");

CREATE TABLE "magic_tokens" (
  "id"         UUID PRIMARY KEY,
  "user_id"    UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "magic_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "magic_tokens_token_hash_key" ON "magic_tokens" ("token_hash");

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- The application sets the current user for each request-scoped transaction:
--     SET LOCAL app.current_user_id = '<uuid>';
-- Policies below use current_setting('app.current_user_id', true) so that a
-- missing setting yields NULL (and therefore no rows), failing closed.
--
-- FORCE ROW LEVEL SECURITY makes the policies apply even to the table owner,
-- so a bug in one endpoint cannot leak another user's data. Run the app with a
-- DB role that is NOT a superuser (superusers bypass RLS entirely).
-- ---------------------------------------------------------------------------

ALTER TABLE "resumes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "resumes_owner_select" ON "resumes"
  FOR SELECT
  USING ("user_id" = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "resumes_owner_insert" ON "resumes"
  FOR INSERT
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "resumes_owner_update" ON "resumes"
  FOR UPDATE
  USING ("user_id" = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "resumes_owner_delete" ON "resumes"
  FOR DELETE
  USING ("user_id" = current_setting('app.current_user_id', true)::uuid);

ALTER TABLE "resume_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resume_reports" FORCE ROW LEVEL SECURITY;

-- resume_reports are scoped through their parent resume's owner.
CREATE POLICY "resume_reports_owner_select" ON "resume_reports"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "resumes" r
    WHERE r."id" = "resume_reports"."resume_id"
      AND r."user_id" = current_setting('app.current_user_id', true)::uuid
  ));

CREATE POLICY "resume_reports_owner_insert" ON "resume_reports"
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM "resumes" r
    WHERE r."id" = "resume_reports"."resume_id"
      AND r."user_id" = current_setting('app.current_user_id', true)::uuid
  ));

CREATE POLICY "resume_reports_owner_delete" ON "resume_reports"
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM "resumes" r
    WHERE r."id" = "resume_reports"."resume_id"
      AND r."user_id" = current_setting('app.current_user_id', true)::uuid
  ));
