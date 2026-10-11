import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/vitest.setup.ts"],
    // Process isolation avoids the JSDOM worker startup timeouts observed on
    // Windows in the full suite. Linux CI keeps its existing thread pool;
    // both platforms retain test isolation, time limits and all assertions.
    pool: process.platform === "win32" ? "forks" : "threads",
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
