import { describe, expect, it } from "vitest";
import { isFolklardWorker } from "./service-worker-registration";

describe("development worker cleanup", () => {
  it("recognizes both release and opt-in QA workers when returning to development", () => {
    const origin = "http://127.0.0.1:3000";
    expect(isFolklardWorker(`${origin}/sw.js`, origin)).toBe(true);
    expect(isFolklardWorker(`${origin}/sw.js?offline=1`, origin)).toBe(true);
    expect(isFolklardWorker(`${origin}/another-worker.js`, origin)).toBe(false);
    expect(isFolklardWorker("https://other.invalid/sw.js?offline=1", origin)).toBe(false);
    expect(isFolklardWorker(undefined, origin)).toBe(false);
    expect(isFolklardWorker("malformed", origin)).toBe(false);
  });
});
