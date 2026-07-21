// Ollama provider — free, local LLM inference via the Ollama HTTP API.
// Used when AI_PROVIDER=ollama (the default). No API key, no cost.

import { env } from "../env.js";

export interface OllamaCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  // When true, ask Ollama to constrain output to valid JSON (Check/Optimize).
  json?: boolean;
  temperature?: number;
}

export class OllamaError extends Error {}

export async function callOllama({
  system,
  user,
  maxTokens = 1600,
  json = false,
  temperature = 0.4,
}: OllamaCallOptions): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.ollamaModel,
        stream: false,
        ...(json ? { format: "json" } : {}),
        options: { num_predict: maxTokens, temperature },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (err) {
    throw new OllamaError(
      err instanceof Error ? err.message : "Could not reach Ollama"
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OllamaError(`Ollama returned ${res.status}: ${detail.slice(0, 200)}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new OllamaError("Ollama returned a non-JSON envelope");
  }

  const content =
    data && typeof data === "object" && "message" in data
      ? (data as { message?: { content?: unknown } }).message?.content
      : undefined;

  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new OllamaError("Empty response from Ollama");
  return text;
}

// Streaming variant: yields content deltas as the model produces them.
// Ollama streams newline-delimited JSON objects, each with a partial
// message.content and a `done` flag on the final line.
export async function* callOllamaStream({
  system,
  user,
  maxTokens = 1600,
  json = false,
  temperature = 0.4,
}: OllamaCallOptions): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.ollamaModel,
        stream: true,
        ...(json ? { format: "json" } : {}),
        options: { num_predict: maxTokens, temperature },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (err) {
    throw new OllamaError(
      err instanceof Error ? err.message : "Could not reach Ollama"
    );
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new OllamaError(`Ollama returned ${res.status}: ${detail.slice(0, 200)}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = false;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as { message?: { content?: string } };
        const piece = obj.message?.content;
        if (piece) {
          emitted = true;
          yield piece;
        }
      } catch {
        /* ignore partial/non-JSON keep-alive lines */
      }
    }
  }
  if (!emitted) throw new OllamaError("Empty response from Ollama");
}
