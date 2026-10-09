"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require("node:crypto");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json");
const buildType = process.argv[2] ?? "debug";
if (!["debug", "release"].includes(buildType)) throw new Error("Unknown Android build type");
const signing = process.argv[3] ?? (buildType === "release" ? "signed-release" : "development-test");
if (!["signed-release", "development-test"].includes(signing)) throw new Error("Unknown Android signing classification");
const folder = path.join(__dirname, "android", "app", "build", "outputs", "apk", buildType);
const file = "Folklard-Android.apk";
const canonicalPath = path.join(folder, file);
if (!fs.existsSync(canonicalPath)) {
  const candidates = fs.readdirSync(folder).filter((name) => name.endsWith(".apk") && name !== file);
  if (candidates.length !== 1) throw new Error("Expected one Android APK for the target");
  fs.copyFileSync(path.join(folder, candidates[0]), canonicalPath);
}
const bytes = fs.readFileSync(canonicalPath);
fs.writeFileSync(path.join(folder, "Folklard-Android.json"), JSON.stringify({
  version, file, commit: process.env.GITHUB_SHA ?? null, size: bytes.length,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  builtAt: new Date().toISOString(), signing,
}, null, 2) + "\n");
