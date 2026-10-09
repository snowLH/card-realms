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
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

describe("native release workflow hardening", () => {
  it("pins external GitHub Actions to immutable commit SHAs", () => {
    for (const path of workflowPaths) {
      const source = workflow(path);
      const refs = [...source.matchAll(/uses:\s+([^\s@]+)@([^\s#]+)/g)];
      expect(refs.length, path).toBeGreaterThan(0);
      for (const [, action, ref] of refs) {
        expect(ref, `${path}: ${action}`).toMatch(/^[a-f0-9]{40}$/);
      }
    }
  });

  it("does not persist checkout credentials in build jobs", () => {
    for (const path of workflowPaths) {
      const source = workflow(path);
      const checkoutCount = source.match(/uses: actions\/checkout@/g)?.length ?? 0;
      const hardenedCount = source.match(/persist-credentials: false/g)?.length ?? 0;
      expect(hardenedCount, path).toBe(checkoutCount);
    }
    expect(workflow(".github/workflows/desktop-app.yml")).not.toContain("GH_TOKEN:");
  });

  it("keeps every application workflow on the production Node 22 runtime", () => {
    for (const path of workflowPaths) {
      const source = workflow(path);
      expect(source, path).not.toMatch(/node-version:\s*["']?24/);
      expect(source, path).toMatch(/node-version:\s*["']?22/);
    }
  });

  it("isolates native concurrency by ref and cancels only stale PR validation", () => {
    for (const path of [
      ".github/workflows/android-app.yml",
      ".github/workflows/desktop-app.yml",
      ".github/workflows/ios-simulator.yml",
    ] as const) {
      const source = workflow(path);
      expect(source, path).toContain("${{ github.ref }}");
      expect(source, path).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
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

  it("builds every native target when the direct download catalog changes", () => {
    for (const path of [
      ".github/workflows/android-app.yml",
      ".github/workflows/desktop-app.yml",
      ".github/workflows/ios-simulator.yml",
    ] as const) {
      const source = workflow(path);
      expect(source.match(/"src\/server\/downloads\/\*\*"/g), path).toHaveLength(2);
      expect(source.match(/"src\/app\/instalar\/\*\*"/g), path).toHaveLength(2);
    }
  });

  it("never publishes automatic native downloads from feature branches", () => {
    const android = workflow(".github/workflows/android-app.yml");
    const desktop = workflow(".github/workflows/desktop-app.yml");
    expect(android).toContain("if: github.ref == 'refs/heads/main' && needs.android.outputs.update-compatible == 'true'");
    expect(desktop).toContain("if: github.ref == 'refs/heads/main'");
  });

  it("only allows signed native release jobs to run from main", () => {
    for (const path of [
      ".github/workflows/android-signed-release.yml",
      ".github/workflows/windows-signed-release.yml",
      ".github/workflows/ios-signed-release.yml",
    ] as const) {
      const source = workflow(path);
      expect(source, path).toContain("if: github.ref == 'refs/heads/main'");
    }
  });

  it("publishes signed Android builds with integrity metadata", () => {
    const source = workflow(".github/workflows/android-signed-release.yml");
    expect(source).toContain("node release-metadata.cjs release signed-release");
    expect(source).toContain("Folklard-Android.json");
    expect(source).toContain("tag_name: downloads-android");
    expect(source).toContain("overwrite_files: true");
    expect(source).toContain("contents: write");
  });

  it("preserves installed Android progress when a signed APK has a different or unverifiable certificate", () => {
    const source = workflow(".github/workflows/android-signed-release.yml");
    expect(source).toContain("update-compatible: ${{ steps.signing.outputs.compatible }}");
    expect(source).toContain("compatible=false");
    expect(source).toContain('if [ -n "$previous" ] && [ "$previous" = "$current" ]; then compatible=true; fi');
    expect(source).toContain("if: github.ref == 'refs/heads/main' && needs.release.outputs.update-compatible == 'true'");
    expect(source.indexOf("Check update signature")).toBeLessThan(source.indexOf("Upload signed release"));
  });

  it("never downgrades a signed Windows download from the automatic desktop workflow", () => {
    const source = workflow(".github/workflows/desktop-app.yml");
    expect(source).toContain("Preserve a signed Windows download");
    expect(source).toContain("m.signing === 'signed-release'");
    expect(source).toContain("files: publish/*");
    expect(source).not.toContain("files: installers/*");
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
