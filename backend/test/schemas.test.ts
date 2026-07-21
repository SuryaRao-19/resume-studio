import { describe, it, expect } from "vitest";
import {
  buildSchema,
  checkSchema,
  optimizeSchema,
  saveResumeSchema,
} from "../src/lib/schemas.js";

describe("buildSchema", () => {
  it("requires non-empty history", () => {
    const r = buildSchema.safeParse({ history: "   " });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/work history/i);
    }
  });

  it("defaults tone and optional fields", () => {
    const r = buildSchema.safeParse({ history: "did things" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tone).toBe("professional");
      expect(r.data.role).toBe("");
    }
  });

  it("falls back to professional for an unknown tone", () => {
    const r = buildSchema.safeParse({ history: "x", tone: "sarcastic" });
    expect(r.success && r.data.tone).toBe("professional");
  });
});

describe("check/optimize schemas", () => {
  it("checkSchema requires resumeText", () => {
    expect(checkSchema.safeParse({}).success).toBe(false);
    expect(checkSchema.safeParse({ resumeText: "hi" }).success).toBe(true);
  });

  it("optimizeSchema requires both fields", () => {
    expect(optimizeSchema.safeParse({ resumeText: "hi" }).success).toBe(false);
    expect(
      optimizeSchema.safeParse({ resumeText: "hi", jobDescription: "job" }).success
    ).toBe(true);
  });
});

describe("saveResumeSchema", () => {
  it("accepts a valid save without a report", () => {
    const r = saveResumeSchema.safeParse({
      title: "My resume",
      content: "content here",
      mode_origin: "build",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid mode_origin", () => {
    const r = saveResumeSchema.safeParse({
      title: "t",
      content: "c",
      mode_origin: "bogus",
    });
    expect(r.success).toBe(false);
  });

  it("accepts and coerces an optional report", () => {
    const r = saveResumeSchema.safeParse({
      title: "t",
      content: "c",
      mode_origin: "optimize",
      report: { type: "optimize", score: "77", report_json: { a: 1 } },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.report?.score).toBe(77);
  });
});
