// Defensive JSON parsing for model output on the Check / Optimize endpoints.
// Strips markdown fences and extracts the first balanced JSON object before
// parsing, so a chatty model doesn't crash the endpoint.

export class ReportParseError extends Error {}

export function parseModelJson<T>(raw: string): T {
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // If there's leading/trailing prose, grab the outermost { ... }.
  if (!text.startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      text = text.slice(first, last + 1);
    }
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ReportParseError("Model did not return valid JSON");
  }
}

// Normalizers guard against a model that returns almost-right shapes.
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function asScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
