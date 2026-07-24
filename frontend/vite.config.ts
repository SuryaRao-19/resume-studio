import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API base URL is injected at build time via VITE_API_BASE_URL so the
// frontend stays portable across hosts and never talks to Anthropic directly.
export default defineConfig({
  // Vercel's legacy `builds` serves this static bundle under /frontend/ (its
  // source path), so asset URLs must be prefixed to match where the files land.
  // The app is still reached at / and /verify — vercel.json rewrites those to
  // /frontend/index.html. base only affects emitted asset URLs, not routing.
  base: "/frontend/",
  plugins: [react()],
  server: { port: 5173 },
});
