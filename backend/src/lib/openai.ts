// OpenAI-compatible provider — talks to any Chat Completions endpoint
// (Groq, OpenRouter, Google Gemini's OpenAI layer, etc). Used when
// AI_PROVIDER=openai. Pick a free-tier host so the app stays zero-cost:
//   Groq       OPENAI_BASE_URL=https://api.groq.com/openai/v1
//   OpenRouter OPENAI_BASE_URL=https://openrouter.ai/api/v1
//   Gemini     OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
// The key lives server-side only and is never sent to the browser.

import { env } from "../env.js";

export interface OpenAICallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  // When true, request a strict JSON object (Check/Optimize).
  json?: boolean;
  temperature?: number;
}

export class OpenAIError extends Error {}

function body(opts: OpenAICallOptions, stream: boolean) {
  const { system, user, maxTokens = 1600, json = false, temperature = 0.4 } = opts;
  return JSON.stringify({
    model: env.openaiModel,
    stream,
    temperature,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
}

async function post(opts: OpenAICallOptions, stream: boolean): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: body(opts, stream),
    });
  } catch (err) {
    throw new OpenAIError(
      err instanceof Error ? err.message : "Could not reach the AI provider"
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenAIError(`Provider returned ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res;
}

export async function callOpenAI(opts: OpenAICallOptions): Promise<string> {
  const res = await post(opts, false);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new OpenAIError("Provider returned a non-JSON envelope");
  }

  const content =
    data && typeof data === "object" && "choices" in data
      ? (data as { choices?: Array<{ message?: { content?: unknown } }> })
          .choices?.[0]?.message?.content
      : undefined;

  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new OpenAIError("Empty response from the AI provider");
  return text;
}

// Streaming variant: the endpoint returns Server-Sent Events, each line
// `data: {json}` carrying choices[0].delta.content, terminated by `data: [DONE]`.
export async function* callOpenAIStream(
  opts: OpenAICallOptions
): AsyncGenerator<string> {
  const res = await post(opts, true);
  if (!res.body) throw new OpenAIError("Provider returned no stream body");

  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = false;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const piece = obj.choices?.[0]?.delta?.content;
        if (piece) {
          emitted = true;
          yield piece;
        }
      } catch {
        /* ignore partial/keep-alive lines */
      }
    }
  }
  if (!emitted) throw new OpenAIError("Empty response from the AI provider");
}
