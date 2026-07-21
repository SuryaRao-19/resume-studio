import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API base URL is injected at build time via VITE_API_BASE_URL so the
// frontend stays portable across hosts and never talks to Anthropic directly.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
