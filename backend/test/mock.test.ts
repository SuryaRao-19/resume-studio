import { describe, it, expect } from "vitest";
import { callMock, callMockStream } from "../src/lib/mock.js";
import {
  BUILD_SYSTEM,
  CHECK_SYSTEM,
  OPTIMIZE_SYSTEM,
  COVER_LETTER_SYSTEM,
} from "../src/lib/prompts.js";
import { parseModelJson } from "../src/lib/parse.js";

describe("mock provider", () => {
  it("returns valid Check JSON with the required arrays", async () => {
    const raw = await callMock({ system: CHECK_SYSTEM });
    const j = parseModelJson<Record<string, unknown>>(raw);
    expect(typeof j.score).toBe("number");
    expect((j.strengths as string[]).length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(j.ats_flags)).toBe(true);
  });

  it("returns valid Optimize JSON incl. tailored_resume", async () => {
    const raw = await callMock({ system: OPTIMIZE_SYSTEM });
    const j = parseModelJson<Record<string, unknown>>(raw);
    expect(typeof j.match_score).toBe("number");
    expect((j.matched_keywords as string[]).length).toBeGreaterThan(0);
    expect(typeof j.tailored_resume).toBe("string");
  });

  it("returns plain-text for build and cover", async () => {
    const build = await callMock({ system: BUILD_SYSTEM });
    expect(build).toContain("PROFESSIONAL SUMMARY");
    const cover = await callMock({ system: COVER_LETTER_SYSTEM });
    expect(cover).toContain("Sincerely,");
  });

  it("streams the build text in multiple chunks", async () => {
    const chunks: string[] = [];
    for await (const c of callMockStream({ system: BUILD_SYSTEM })) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toContain("PROFESSIONAL SUMMARY");
  });
});
