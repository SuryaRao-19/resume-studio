// Thin wrapper around the Anthropic Messages API.
// This is the ONLY place the API key is used — it lives server-side and is
// never sent to the browser.

import Anthropic from "@anthropic-ai/sdk";
import { env, ANTHROPIC_MODEL } from "../env.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

export interface CallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  // Accepted for signature parity with the Ollama provider. Anthropic relies on
  // the prompt itself to demand JSON; the defensive parser handles the rest.
  json?: boolean;
  temperature?: number;
}

// Raised when the upstream model call fails. The route layer maps this to a
// generic client-facing message and logs the real cause server-side only.
export class AnthropicError extends Error {}

export async function callAnthropic({
  system,
  user,
  maxTokens = 1600,
  temperature,
}: CallOptions): Promise<string> {
  try {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      throw new AnthropicError("Empty response from model");
    }
    return text;
  } catch (err) {
    if (err instanceof AnthropicError) throw err;
    throw new AnthropicError(
      err instanceof Error ? err.message : "Unknown Anthropic error"
    );
  }
}

// Streaming variant: yields text deltas as Claude produces them.
export async function* callAnthropicStream({
  system,
  user,
  maxTokens = 1600,
  temperature,
}: CallOptions): AsyncGenerator<string> {
  try {
    const stream = client.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
      system,
      messages: [{ role: "user", content: user }],
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (err) {
    throw new AnthropicError(
      err instanceof Error ? err.message : "Unknown Anthropic error"
    );
  }
}
