import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPaths = [
  ".github/workflows/android-app.yml",
  ".github/workflows/android-signed-release.yml",
  ".github/workflows/desktop-app.yml",
  ".github/workflows/ios-signed-release.yml",
  ".github/workflows/ios-simulator.yml",
  ".github/workflows/verify.yml",
  ".github/workflows/windows-signed-release.yml",
] as const;

function workflow(path: (typeof workflowPaths)[number]) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("native release workflow hardening", () => {
  it("keeps every application workflow on the production Node 22 runtime", () => {
    for (const path of workflowPaths) {
      const source = workflow(path);
      expect(source, path).not.toMatch(/node-version:\s*["']?24/);
      expect(source, path).toMatch(/node-version:\s*["']?22/);
    }
  });

  it("validates native changes in pull requests but reserves push releases for main", () => {
    for (const path of [
      ".github/workflows/android-app.yml",
      ".github/workflows/desktop-app.yml",
      ".github/workflows/ios-simulator.yml",
    ] as const) {
      const source = workflow(path);
      expect(source, path).toContain("pull_request:");
      expect(source, path).toMatch(/push:\n\s+branches:\n\s+- main/);
    }
  });

  it("never publishes automatic native downloads from feature branches", () => {
    const android = workflow(".github/workflows/android-app.yml");
    const desktop = workflow(".github/workflows/desktop-app.yml");
    expect(android).toContain("if: github.ref == 'refs/heads/main' && needs.android.outputs.update-compatible == 'true'");
    expect(desktop).toContain("if: github.ref == 'refs/heads/main'");
  });

  it("publishes signed Android builds with integrity metadata", () => {
    const source = workflow(".github/workflows/android-signed-release.yml");
    expect(source).toContain("node release-metadata.cjs release signed-release");
    expect(source).toContain("Folklard-Android.json");
    expect(source).toContain("tag_name: downloads-android");
    expect(source).toContain("overwrite_files: true");
    expect(source).toContain("contents: write");
  });

  it("publishes signed Windows builds without removing the Linux release channel", () => {
    const source = workflow(".github/workflows/windows-signed-release.yml");
    expect(source).toContain("node release-metadata.cjs Windows signed-release");
    expect(source).toContain("Folklard-Windows.json");
    expect(source).toContain("tag_name: downloads-desktop");
    expect(source).toContain("O asset Linux permanece no mesmo canal de downloads.");
    expect(source).toContain("contents: write");
  });
});
