import { defineConfig } from "vitest/config";

// The source uses NodeNext ESM imports with explicit ".js" extensions. Vite
// doesn't map those to the ".ts" sources by default, so strip the extension
// from relative specifiers and let normal resolution find the TS file.
export default defineConfig({
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
