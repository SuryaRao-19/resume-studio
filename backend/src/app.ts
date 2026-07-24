// Resume Studio Express app.
//
// This module builds and exports the app WITHOUT calling app.listen(), so the
// same app can be driven by a long-lived local server (server.ts) or wrapped as
// a Vercel serverless function (api/index.ts). Keep anything process-lifecycle
// bound (app.listen, setInterval cleanup) out of here — serverless has no
// long-lived process to host it.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { aiRouter } from "./routes/ai.js";
import { resumesRouter } from "./routes/resumes.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

// Security headers. This is a JSON API (no first-party HTML), so the strict
// defaults are fine; disable CSP which only matters for served markup.
app.use(helmet({ contentSecurityPolicy: false }));
// When the frontend is served from the same origin (the Vercel single-domain
// deploy) requests are same-origin and never trigger CORS. cors() stays as a
// harmless no-op there and keeps cross-origin local dev (Vite :5173) working.
app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api", aiRouter); // /api/build, /api/check, /api/optimize
app.use("/api/resumes", resumesRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
