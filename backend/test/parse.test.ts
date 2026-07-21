import { describe, it, expect } from "vitest";
import {
  parseModelJson,
  ReportParseError,
  asStringArray,
  asScore,
} from "../src/lib/parse.js";

describe("parseModelJson", () => {
  it("parses a plain JSON object", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json code fences", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips bare ``` fences", () => {
    expect(parseModelJson('```\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("extracts the object from surrounding prose", () => {
    expect(parseModelJson('Here you go: {"a":3} hope that helps')).toEqual({ a: 3 });
  });

  it("throws ReportParseError on non-JSON", () => {
    expect(() => parseModelJson("not json at all")).toThrow(ReportParseError);
  });
});

describe("asStringArray", () => {
  it("keeps only strings", () => {
    expect(asStringArray(["a", 1, "b", null, {}])).toEqual(["a", "b"]);
  });
  it("returns [] for non-arrays", () => {
    expect(asStringArray("nope")).toEqual([]);
    expect(asStringArray(undefined)).toEqual([]);
  });
});

describe("asScore", () => {
  it("clamps to 0-100 and rounds", () => {
    expect(asScore(150)).toBe(100);
    expect(asScore(-5)).toBe(0);
    expect(asScore(72.6)).toBe(73);
  });
  it("coerces numeric strings", () => {
    expect(asScore("88")).toBe(88);
  });
  it("returns 0 for non-numeric", () => {
    expect(asScore("abc")).toBe(0);
    expect(asScore(NaN)).toBe(0);
  });
});
