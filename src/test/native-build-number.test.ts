import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { computeNativeBuildNumber, MAX_ANDROID_VERSION_CODE } = require(resolve(
  process.cwd(),
  "mobile/native-version.cjs",
)) as {
  computeNativeBuildNumber: (version: string, runNumber?: number | string) => number;
  MAX_ANDROID_VERSION_CODE: number;
};

describe("native application build numbers", () => {
  it("increments when the same app version is rebuilt in CI", () => {
    expect(computeNativeBuildNumber("0.2.0", 42)).toBe(computeNativeBuildNumber("0.2.0", 41) + 1);
  });

  it("keeps a newer semantic version above the previous version even with a lower run sequence", () => {
    expect(computeNativeBuildNumber("0.2.1", 1)).toBeGreaterThan(computeNativeBuildNumber("0.2.0", 9_999));
    expect(computeNativeBuildNumber("0.3.0", 1)).toBeGreaterThan(computeNativeBuildNumber("0.2.99", 9_999));
  });

  it("rejects invalid or exhausted build sequences instead of reusing a native version code", () => {
    expect(() => computeNativeBuildNumber("0.2.0", 0)).toThrow();
    expect(() => computeNativeBuildNumber("0.2.0", 10_000)).toThrow();
    expect(() => computeNativeBuildNumber("0.2.0", "not-a-number")).toThrow();
  });

  it("never emits a versionCode above Android's supported limit", () => {
    expect(computeNativeBuildNumber("20.0.0", 1)).toBeLessThanOrEqual(MAX_ANDROID_VERSION_CODE);
    expect(() => computeNativeBuildNumber("21.0.0", 1)).toThrow();
  });
});
