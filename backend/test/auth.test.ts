import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  createMagicToken,
  hashToken,
} from "../src/lib/auth.js";

describe("session tokens", () => {
  it("round-trips a valid session", () => {
    const token = createSessionToken({ userId: "u1", email: "a@b.com" });
    expect(verifySessionToken(token)).toEqual({ userId: "u1", email: "a@b.com" });
  });

  it("rejects a tampered/garbage token", () => {
    expect(verifySessionToken("garbage.token.value")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    // A well-formed JWT signed with the wrong key must not verify.
    const other =
      "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4IiwiZW1haWwiOiJ4QHkuY29tIn0.invalidsig";
    expect(verifySessionToken(other)).toBeNull();
  });
});

describe("magic tokens", () => {
  it("creates a raw token whose hash matches hashToken", () => {
    const { raw, hash, expiresAt } = createMagicToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toBe(hashToken(raw));
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("hashes deterministically and differs per input", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
