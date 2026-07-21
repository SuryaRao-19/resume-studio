// Provider-agnostic AI entry point. Routes call callAI(); the actual backend
// (Ollama or Anthropic) is chosen by AI_PROVIDER. Either way, the model call
// happens server-side only.

import { env } from "../env.js";
import { callAnthropic, callAnthropicStream, AnthropicError } from "./anthropic.js";
import { callOllama, callOllamaStream, OllamaError } from "./ollama.js";
import { callMock, callMockStream } from "./mock.js";
import { parseModelJson, ReportParseError } from "./parse.js";

export interface AiCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  json?: boolean;
  // Sampling temperature. Lower for structured JSON (Check/Optimize), higher
  // for open-ended prose (Build/Cover letter). Providers apply their own
  // default when omitted.
  temperature?: number;
}

// Unified error the route layer maps to a generic client-facing message.
export class AiError extends Error {}

export async function callAI(opts: AiCallOptions): Promise<string> {
  try {
    if (env.aiProvider === "mock") {
      return await callMock(opts);
    }
    if (env.aiProvider === "anthropic") {
      return await callAnthropic(opts);
    }
    return await callOllama(opts);
  } catch (err) {
    if (err instanceof AnthropicError || err instanceof OllamaError) {
      throw new AiError(err.message);
    }
    throw new AiError(err instanceof Error ? err.message : "Unknown AI error");
  }
}

// Streaming variant used by the Build endpoint. Yields text deltas; maps
// provider errors to the unified AiError like callAI does.
export async function* callAIStream(opts: AiCallOptions): AsyncGenerator<string> {
  try {
    if (env.aiProvider === "mock") {
      yield* callMockStream(opts);
    } else if (env.aiProvider === "anthropic") {
      yield* callAnthropicStream(opts);
    } else {
      yield* callOllamaStream(opts);
    }
  } catch (err) {
    if (err instanceof AnthropicError || err instanceof OllamaError) {
      throw new AiError(err.message);
    }
    throw new AiError(err instanceof Error ? err.message : "Unknown AI error");
  }
}

// JSON-mode call with one retry. Check/Optimize demand strict JSON; local
// models occasionally emit prose or a truncated object. On a parse failure we
// retry once with a stricter reminder appended before giving up.
export async function callAIJson<T>(opts: AiCallOptions): Promise<T> {
  const first = await callAI({ ...opts, json: true });
  try {
    return parseModelJson<T>(first);
  } catch (err) {
    if (!(err instanceof ReportParseError)) throw err;
    const retry = await callAI({
      ...opts,
      json: true,
      system:
        opts.system +
        "\n\nIMPORTANT: Return ONLY the raw JSON object. No prose, no markdown, no code fences.",
    });
    return parseModelJson<T>(retry);
  }
}
