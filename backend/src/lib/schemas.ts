// Request body validation with zod. Centralizes input rules (length caps,
// enums, required fields) and produces the same friendly, client-safe error
// messages the handlers used before. Use validate() in a route to parse the
// body; it returns the typed data or sends a 400 and returns null.

import { z } from "zod";
import type { Request, Response } from "express";

const MAX_INPUT = 20000; // guard against oversized pastes
const TONES = ["professional", "concise", "impactful", "warm"] as const;

const bounded = (max = MAX_INPUT) => z.string().max(max, "That input is too long. Please shorten it and try again.");

export const buildSchema = z.object({
  role: bounded().default(""),
  tone: z.enum(TONES).catch("professional"),
  history: bounded().trim().min(1, "Add some work history or notes before drafting."),
  skills: bounded().default(""),
  education: bounded().default(""),
});

export const checkSchema = z.object({
  resumeText: bounded().trim().min(1, "Paste a resume to check."),
});

export const optimizeSchema = z.object({
  resumeText: bounded().trim().min(1, "Paste your resume to optimize."),
  jobDescription: bounded().trim().min(1, "Paste the job description to optimize against."),
});

export const coverLetterSchema = z.object({
  resumeText: bounded().trim().min(1, "Paste your resume to write a cover letter."),
  jobDescription: bounded().trim().min(1, "Paste the job description to tailor the letter."),
  tone: z.enum(TONES).catch("professional"),
});

const reportSchema = z.object({
  type: z.enum(["check", "optimize"]),
  score: z.coerce.number().default(0),
  report_json: z.unknown().default({}),
  job_description: z.string().nullish(),
});

export const saveResumeSchema = z.object({
  title: z.string().trim().min(1, "Give this resume a title.").max(200),
  content: z.string().trim().min(1, "There's no content to save.").max(100000),
  mode_origin: z.enum(["build", "check", "optimize", "cover"], {
    message: "Invalid resume origin.",
  }),
  report: reportSchema.optional(),
});

// Parse and validate a request body. On failure, sends a 400 with the first
// error message and returns null so the caller can `return` early.
export function validate<T>(
  schema: z.ZodType<T>,
  req: Request,
  res: Response
): T | null {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request.";
    res.status(400).json({ error: message });
    return null;
  }
  return result.data;
}
