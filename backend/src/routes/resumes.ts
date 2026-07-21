// Resume CRUD. Every query filters by the authenticated user's id at the
// application layer, and runs inside withUser() so Postgres RLS enforces the
// same scoping as a second layer. Ownership failures return 404 (not 403) so a
// mismatched user can't probe which resume ids exist.

import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma, withUser } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asScore } from "../lib/parse.js";
import { validate, saveResumeSchema } from "../lib/schemas.js";

export const resumesRouter = Router();

resumesRouter.use(requireAuth);

// POST /api/resumes  { title, content, mode_origin, report? }
resumesRouter.post("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const input = validate(saveResumeSchema, req, res);
    if (!input) return;

    const { title, content, mode_origin: modeOrigin, report: rawReport } = input;

    // Optional analysis report to persist alongside a check/optimize resume.
    const report = rawReport
      ? {
          type: rawReport.type,
          score: asScore(rawReport.score),
          reportJson: (rawReport.report_json ?? {}) as Prisma.InputJsonValue,
          jobDescription: rawReport.job_description ?? null,
        }
      : null;

    const resume = await withUser(userId, async (tx) => {
      const created = await tx.resume.create({
        data: { userId, title, content, modeOrigin },
        select: { id: true, title: true, modeOrigin: true, updatedAt: true },
      });
      if (report) {
        await tx.resumeReport.create({
          data: { resumeId: created.id, ...report },
        });
      }
      return created;
    });

    res.status(201).json(resume);
  } catch (err) {
    next(err);
  }
});

// GET /api/resumes  -> light list (no full content)
resumesRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const resumes = await withUser(userId, (tx) =>
      tx.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, modeOrigin: true, updatedAt: true },
      })
    );
    res.json({ resumes });
  } catch (err) {
    next(err);
  }
});

// GET /api/resumes/:id -> full content + latest report (owner only; 404 otherwise)
resumesRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id;

    const resume = await withUser(userId, (tx) =>
      tx.resume.findFirst({
        where: { id, userId },
        include: {
          reports: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    );

    if (!resume) {
      res.status(404).json({ error: "Not found." });
      return;
    }

    const latestReport = resume.reports[0] ?? null;
    res.json({
      id: resume.id,
      title: resume.title,
      content: resume.content,
      mode_origin: resume.modeOrigin,
      updated_at: resume.updatedAt,
      latest_report: latestReport
        ? {
            type: latestReport.type,
            score: latestReport.score,
            report_json: latestReport.reportJson,
            job_description: latestReport.jobDescription,
            created_at: latestReport.createdAt,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resumes/:id (owner only; 404 otherwise)
resumesRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id;

    // Ownership check via a scoped deleteMany: affects 0 rows if not owner.
    const result = await withUser(userId, (tx) =>
      tx.resume.deleteMany({ where: { id, userId } })
    );

    if (result.count === 0) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Keep prisma referenced for potential future non-scoped admin use.
void prisma;
