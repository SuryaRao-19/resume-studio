import { defineConfig, devices } from "@playwright/test";

// The stack must already be running (frontend, backend, Postgres, Ollama).
// Override targets with BASE_URL / API_URL / DATABASE_URL env vars.
export default defineConfig({
  testDir: "./tests",
  timeout: 5 * 60 * 1000, // local LLM generations can be slow
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
