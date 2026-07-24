// Centralized, validated environment configuration.
// Fails fast at startup if a required variable is missing.

import "dotenv/config";

// Values are trimmed: dashboard copy-paste often introduces a stray leading or
// trailing newline/space, which breaks things downstream (e.g. Prisma rejects a
// DATABASE_URL that doesn't start exactly with "postgresql://", and a newline in
// FRONTEND_ORIGIN makes the CORS header throw ERR_INVALID_CHAR).
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

// Which AI provider backs the modes: "ollama" (free, local), "openai"
// (any OpenAI-compatible endpoint — Groq/OpenRouter/Gemini free tiers, good
// for a zero-cost hosted deploy), "anthropic" (paid, Claude), or "mock"
// (deterministic canned responses, tests/CI only).
// Default is ollama so the app runs at zero cost locally.
const aiProvider = optional("AI_PROVIDER", "ollama").toLowerCase();

export const env = {
  aiProvider: aiProvider as "ollama" | "openai" | "anthropic" | "mock",
  // Only required when actually using Anthropic.
  anthropicApiKey:
    aiProvider === "anthropic" ? required("ANTHROPIC_API_KEY") : (process.env.ANTHROPIC_API_KEY ?? ""),
  ollamaBaseUrl: optional("OLLAMA_BASE_URL", "http://localhost:11434"),
  ollamaModel: optional("OLLAMA_MODEL", "llama3"),
  // OpenAI-compatible provider (used when AI_PROVIDER=openai). Base URL and
  // model default to Groq's free tier; the key is required only for this mode.
  openaiApiKey:
    aiProvider === "openai" ? required("OPENAI_API_KEY") : (process.env.OPENAI_API_KEY ?? ""),
  openaiBaseUrl: optional("OPENAI_BASE_URL", "https://api.groq.com/openai/v1"),
  openaiModel: optional("OPENAI_MODEL", "llama-3.3-70b-versatile"),
  // Strip ALL whitespace (a Postgres URL never contains any). A stray newline
  // from a dashboard paste otherwise makes Prisma reject it with "the URL must
  // start with the protocol postgresql://". This cleaned value is passed
  // explicitly to PrismaClient in db.ts, since schema.prisma's env("DATABASE_URL")
  // would otherwise read the raw, un-cleaned environment variable.
  databaseUrl: required("DATABASE_URL").replace(/\s+/g, ""),
  authSecret: required("AUTH_SECRET"),
  rateLimitPerHour: parseInt(optional("RATE_LIMIT_PER_HOUR", "20"), 10),
  port: parseInt(optional("PORT", "4000"), 10),
  // Strip ALL whitespace, not just the edges: a URL never contains whitespace,
  // and an embedded newline from a dashboard paste would otherwise make the CORS
  // Access-Control-Allow-Origin header throw ERR_INVALID_CHAR and 500 every
  // request (including the health check).
  frontendOrigin: optional("FRONTEND_ORIGIN", "http://localhost:5173").replace(/\s+/g, ""),
  cookieSecure: optional("COOKIE_SECURE", "false") === "true",
  isProd: process.env.NODE_ENV === "production",
};

// Model used when AI_PROVIDER=anthropic (Claude Messages API).
export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
