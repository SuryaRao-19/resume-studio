// Resume Studio backend entrypoint for LOCAL / long-lived hosting.
//
// The Express app itself lives in app.ts so it can be shared with the Vercel
// serverless entry (api/index.ts). This file only owns the things that need a
// persistent process: binding a port and the background cleanup interval.

import { app } from "./app.js";
import { env } from "./env.js";
import { startCleanup } from "./lib/cleanup.js";

app.listen(env.port, () => {
  console.log(`Resume Studio backend listening on http://localhost:${env.port}`);
  startCleanup();
});
