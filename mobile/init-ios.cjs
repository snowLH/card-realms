"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawnSync } = require("node:child_process");
const cli = path.join(__dirname, "node_modules", "@capacitor", "cli", "bin", "capacitor");
const spm = path.join(__dirname, "ios", "App", "CapApp-SPM", "Package.swift");
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: __dirname, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  return result;
}
if (!fs.existsSync(spm)) {
  const added = run(["add", "ios", "--packagemanager", "SPM"]);
  // Capacitor 7.6.9 creates the SPM template but lowercases the selector before
  // choosing the initial updater. A fresh sync detects the created SPM project.
  if (added.status !== 0 && !(fs.existsSync(spm) && `${added.stdout}${added.stderr}`.includes("Podfile"))) {
    throw new Error("Could not generate the iOS project");
  }
}
if (run(["sync", "ios"]).status !== 0) throw new Error("Could not synchronize the iOS project");
