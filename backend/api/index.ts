// Vercel serverless entry for the Resume Studio API.
//
// An Express app is itself an (req, res) request handler, so exporting it as the
// default export is all @vercel/node needs. Every /api/* route is funnelled here
// by the root vercel.json rewrite, and Express does the internal routing. There
// is no app.listen() and no background interval — serverless has no persistent
// process, so token/rate-limit cleanup is handled out-of-band (see notes).

import { app } from "../src/app.js";

export default app;
