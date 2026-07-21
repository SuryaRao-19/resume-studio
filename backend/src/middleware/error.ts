// Central error handling. Never leaks internal messages, stack traces, or DB
// errors to the client — logs the real cause server-side and returns a generic
// message.

import type { Request, Response, NextFunction } from "express";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found." });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Server-side only.
  console.error("[error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Try again." });
}
