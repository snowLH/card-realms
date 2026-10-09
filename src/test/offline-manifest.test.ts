import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("builds the public pack before HTML prerendering and invalidates it for shell changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "folklard-offline-pack-"));
  const script = resolve("scripts/build-offline-manifest.mjs");
  const put = async (path: string, value: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), value);
  };
  try {
    await put("src/app/offline/page.tsx", 'const portrait = "/art/hero-v5.webp";');
    await put("src/ignored.test.ts", 'const portrait = "/art/missing.webp";');
    await put(".next/static/chunks/game.js", "public game bundle");
    for (const path of ["offline.html", "manifest.webmanifest", "icon.svg", "apple-icon.png",
      "icons/card-realms-192.png", "icons/card-realms-512.png", "icons/card-realms-maskable-512.png", "art/hero-v5.webp"]) {
      await put(`public/${path}`, "public asset");
    }
    const build = async () => {
      await promisify(execFile)(process.execPath, [script, root, join(root, ".next")]);
      return JSON.parse(await readFile(join(root, "public/offline-pack.json"), "utf8"));
    };
    const first = await build();
    expect(first.files).toContain("/offline");
    expect(first.files).toContain("/_next/static/chunks/game.js");
    expect(first.files).toContain("/art/hero-v5.webp");
    expect(first.files).not.toContain("/art/missing.webp");
    expect((await build()).version).toBe(first.version);
    await put("src/app/offline/page.tsx", 'const portrait = "/art/hero-v5.webp"; // updated public shell');
    expect((await build()).version).not.toBe(first.version);
  } finally {
    const absolute = resolve(root);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith("folklard-offline-pack-")) {
      throw new Error("Refusing to remove a path outside the generated test fixture");
    }
    await rm(absolute, { recursive: true, force: true });
  }
});
