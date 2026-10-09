import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const fixtures: string[] = [];
const fixturePrefix = join(tmpdir(), "folklard-release-metadata-");
function fixture(target: "mobile" | "desktop") {
  const root = mkdtempSync(fixturePrefix);
  fixtures.push(root);
  copyFileSync(resolve(target, "release-metadata.cjs"), join(root, "release-metadata.cjs"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.2.0" }));
  return root;
}
afterEach(() => {
  for (const root of fixtures.splice(0)) {
    if (!root.startsWith(fixturePrefix)) throw new Error("Invalid temporary release fixture path");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("native download integrity metadata", () => {
  it.each(["debug", "release"] as const)("creates recognized %s Android metadata from the actual APK bytes", (buildType) => {
    const root = fixture("mobile");
    const folder = join(root, "android", "app", "build", "outputs", "apk", buildType);
    mkdirSync(folder, { recursive: true });
    const bytes = Buffer.from("Folklard APK integrity fixture");
    writeFileSync(join(folder, `app-${buildType}.apk`), bytes);
    const result = spawnSync(process.execPath, [join(root, "release-metadata.cjs"), buildType], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const metadata = JSON.parse(readFileSync(join(folder, "Folklard-Android.json"), "utf8"));
    expect(metadata).toMatchObject({ version: "0.2.0", file: "Folklard-Android.apk", size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      signing: buildType === "release" ? "signed-release" : "development-test" });
    expect(readFileSync(join(folder, "Folklard-Android.apk"))).toEqual(bytes);
  });

  it.each(["mobile", "desktop"] as const)("rejects unknown %s signing labels before emitting a download", (target) => {
    const root = fixture(target);
    const result = spawnSync(process.execPath, [join(root, "release-metadata.cjs"), target === "mobile" ? "release" : "Windows", "mystery-signature"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown");
    expect(result.stderr).toContain("signing classification");
  });
});
