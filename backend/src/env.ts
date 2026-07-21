// Centralized, validated environment configuration.
// Fails fast at startup if a required variable is missing.

import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

// Which AI provider backs the modes: "ollama" (free, local), "anthropic"
// (paid, Claude), or "mock" (deterministic canned responses, tests/CI only).
// Default is ollama so the app runs at zero cost.
const aiProvider = optional("AI_PROVIDER", "ollama").toLowerCase();

export const env = {
  aiProvider: aiProvider as "ollama" | "anthropic" | "mock",
  // Only required when actually using Anthropic.
  anthropicApiKey:
    aiProvider === "anthropic" ? required("ANTHROPIC_API_KEY") : (process.env.ANTHROPIC_API_KEY ?? ""),
  ollamaBaseUrl: optional("OLLAMA_BASE_URL", "http://localhost:11434"),
  ollamaModel: optional("OLLAMA_MODEL", "llama3"),
  databaseUrl: required("DATABASE_URL"),
  authSecret: required("AUTH_SECRET"),
  rateLimitPerHour: parseInt(optional("RATE_LIMIT_PER_HOUR", "20"), 10),
  port: parseInt(optional("PORT", "4000"), 10),
  frontendOrigin: optional("FRONTEND_ORIGIN", "http://localhost:5173"),
  cookieSecure: optional("COOKIE_SECURE", "false") === "true",
  isProd: process.env.NODE_ENV === "production",
};

// Model used when AI_PROVIDER=anthropic (Claude Messages API).
export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
