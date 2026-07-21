// Resume Studio backend entrypoint.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { aiRouter } from "./routes/ai.js";
import { resumesRouter } from "./routes/resumes.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { startCleanup } from "./lib/cleanup.js";

const app = express();

// Security headers. This is a JSON API (no first-party HTML), so the strict
// defaults are fine; disable CSP which only matters for served markup.
app.use(helmet({ contentSecurityPolicy: false }));
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

app.listen(env.port, () => {
  console.log(`Resume Studio backend listening on http://localhost:${env.port}`);
  startCleanup();
});
