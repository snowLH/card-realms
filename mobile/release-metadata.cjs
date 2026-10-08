"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require("node:crypto");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json");
const folder = path.join(__dirname, "android", "app", "build", "outputs", "apk", "debug");
const file = "Folklard-Android.apk";
const bytes = fs.readFileSync(path.join(folder, file));
fs.writeFileSync(path.join(folder, "Folklard-Android.json"), JSON.stringify({
  version, file, commit: process.env.GITHUB_SHA ?? null, size: bytes.length,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  builtAt: new Date().toISOString(), signing: "development-test",
}, null, 2) + "\n");
