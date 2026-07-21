// AI routes: /api/build, /api/build/stream, /api/check, /api/optimize,
// /api/cover-letter. All require auth and are rate limited. All model calls
// happen here, server-side; the API key never reaches the browser.

import { Router } from "express";
import { requireAuth, rateLimitAi } from "../middleware/auth.js";
import { callAI, callAIStream, callAIJson, AiError } from "../lib/ai.js";
import {
  BUILD_SYSTEM,
  buildUserMessage,
  CHECK_SYSTEM,
  checkUserMessage,
  OPTIMIZE_SYSTEM,
  optimizeUserMessage,
  COVER_LETTER_SYSTEM,
  coverLetterUserMessage,
} from "../lib/prompts.js";
import { ReportParseError, asStringArray, asScore } from "../lib/parse.js";
import {
  validate,
  buildSchema,
  checkSchema,
  optimizeSchema,
  coverLetterSchema,
} from "../lib/schemas.js";

export const aiRouter = Router();

aiRouter.use(requireAuth, rateLimitAi);

// POST /api/build
aiRouter.post("/build", async (req, res) => {
  const input = validate(buildSchema, req, res);
  if (!input) return;

  try {
    const resumeText = await callAI({
      system: BUILD_SYSTEM,
      user: buildUserMessage(input),
      temperature: 0.5,
    });
    res.json({ resumeText });
  } catch (err) {
    handleAiError(err, res);
  }
});

// POST /api/build/stream — same inputs as /build, but streams the draft token
// by token as Server-Sent Events so slow local models feel responsive.
aiRouter.post("/build/stream", async (req, res) => {
  const input = validate(buildSchema, req, res);
  if (!input) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    for await (const delta of callAIStream({
      system: BUILD_SYSTEM,
      user: buildUserMessage(input),
      temperature: 0.5,
    })) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    res.write("event: done\ndata: {}\n\n");
  } catch (err) {
    console.error("[ai] stream error:", err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Something went wrong. Try again." })}\n\n`);
  } finally {
    res.end();
  }
});

// POST /api/check
aiRouter.post("/check", async (req, res) => {
  const input = validate(checkSchema, req, res);
  if (!input) return;

  try {
    const parsed = await callAIJson<Record<string, unknown>>({
      system: CHECK_SYSTEM,
      user: checkUserMessage(input.resumeText),
      temperature: 0.2,
    });
    res.json({
      score: asScore(parsed.score),
      strengths: asStringArray(parsed.strengths),
      issues: asStringArray(parsed.issues),
      ats_flags: asStringArray(parsed.ats_flags),
    });
  } catch (err) {
    handleAiError(err, res);
  }
});

// POST /api/optimize
aiRouter.post("/optimize", async (req, res) => {
  const input = validate(optimizeSchema, req, res);
  if (!input) return;

  try {
    const parsed = await callAIJson<Record<string, unknown>>({
      system: OPTIMIZE_SYSTEM,
      user: optimizeUserMessage(input.resumeText, input.jobDescription),
      temperature: 0.2,
    });
    const summary = parsed.tailored_summary;
    const tailored = parsed.tailored_resume;
    res.json({
      match_score: asScore(parsed.match_score),
      matched_keywords: asStringArray(parsed.matched_keywords),
      missing_keywords: asStringArray(parsed.missing_keywords),
      rewrite_suggestions: asStringArray(parsed.rewrite_suggestions),
      tailored_summary: typeof summary === "string" ? summary : "",
      tailored_resume: typeof tailored === "string" ? tailored : "",
    });
  } catch (err) {
    handleAiError(err, res);
  }
});

// POST /api/cover-letter
aiRouter.post("/cover-letter", async (req, res) => {
  const input = validate(coverLetterSchema, req, res);
  if (!input) return;

  try {
    const letterText = await callAI({
      system: COVER_LETTER_SYSTEM,
      user: coverLetterUserMessage(input.resumeText, input.jobDescription, input.tone),
      temperature: 0.6,
    });
    res.json({ letterText });
  } catch (err) {
    handleAiError(err, res);
  }
});

function handleAiError(err: unknown, res: import("express").Response): void {
  if (err instanceof ReportParseError) {
    console.error("[ai] parse error:", err.message);
    res.status(502).json({ error: "Could not parse a report. Try again." });
    return;
  }
  if (err instanceof AiError) {
    console.error("[ai] provider error:", err.message);
    res.status(502).json({ error: "Something went wrong. Try again." });
    return;
  }
  console.error("[ai] unexpected error:", err);
  res.status(500).json({ error: "Something went wrong. Try again." });
}
