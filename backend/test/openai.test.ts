import { describe, it, expect, vi, afterEach } from "vitest";
import { callOpenAI, callOpenAIStream, OpenAIError } from "../src/lib/openai.js";

// Build a Response whose body streams the given chunks as an async iterable,
// mirroring what fetch returns for an SSE endpoint.
function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield encoder.encode(c);
    },
  };
  return { ok: true, body } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openai provider", () => {
  it("extracts message content from a chat completion", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  hello world  " } }] }),
    } as unknown as Response);

    expect(await callOpenAI({ system: "s", user: "u" })).toBe("hello world");
  });

  it("throws AiError-mappable OpenAIError on a non-2xx response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    } as unknown as Response);

    await expect(callOpenAI({ system: "s", user: "u" })).rejects.toBeInstanceOf(OpenAIError);
  });

  it("throws on an empty completion", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    } as unknown as Response);

    await expect(callOpenAI({ system: "s", user: "u" })).rejects.toBeInstanceOf(OpenAIError);
  });

  it("concatenates SSE deltas and ignores [DONE]", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
        ": keep-alive\n",
        "data: [DONE]\n",
      ])
    );

    let out = "";
    for await (const piece of callOpenAIStream({ system: "s", user: "u" })) out += piece;
    expect(out).toBe("Hello");
  });
});
