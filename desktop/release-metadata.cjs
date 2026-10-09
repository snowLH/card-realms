"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require("node:crypto");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json");
const platform = process.argv[2];
const signing = process.argv[3] ?? "unsigned-test";
if (!["Windows", "Linux"].includes(platform)) throw new Error("Unknown desktop target");
if (!["signed-release", "unsigned-test"].includes(signing)) throw new Error("Unknown desktop signing classification");
const extension = platform === "Windows" ? ".exe" : ".AppImage";
const folder = path.join(__dirname, "dist");
const file = `Folklard-${platform}${extension}`;
const candidates = fs.readdirSync(folder).filter((name) => name.endsWith(extension) && name !== file);
if (candidates.length !== 1) throw new Error("Expected one installer for the target");
fs.copyFileSync(path.join(folder, candidates[0]), path.join(folder, file));
const bytes = fs.readFileSync(path.join(folder, file));
fs.writeFileSync(path.join(folder, `Folklard-${platform}.json`), JSON.stringify({
  version, file, commit: process.env.GITHUB_SHA ?? null, size: bytes.length,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  builtAt: new Date().toISOString(), signing,
}, null, 2) + "\n");
