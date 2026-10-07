import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/vitest.setup.ts"],
    pool: "threads",
    maxWorkers: 2,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "server-only": new URL("./src/test/server-only.ts", import.meta.url).pathname,
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
