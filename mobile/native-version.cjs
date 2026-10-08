"use strict";

const MAX_ANDROID_VERSION_CODE = 2_100_000_000;
const MAX_RUN_SEQUENCE = 9_999;

function parseVersion(version) {
  const parts = String(version).split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isSafeInteger(part) || part < 0 || part > 99)) {
    throw new Error("Invalid app version");
  }
  return parts;
}

function computeNativeBuildNumber(version, runNumber = 1) {
  const [major, minor, patch] = parseVersion(version);
  const sequence = Number(runNumber);
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_RUN_SEQUENCE) {
    throw new Error(`GITHUB_RUN_NUMBER must be between 1 and ${MAX_RUN_SEQUENCE}; bump the app version before the sequence is exhausted`);
  }
  const buildNumber = major * 100_000_000 + minor * 1_000_000 + patch * 10_000 + sequence;
  if (buildNumber > MAX_ANDROID_VERSION_CODE) throw new Error("Native build number exceeds Android versionCode limit");
  return buildNumber;
}

module.exports = { computeNativeBuildNumber, MAX_ANDROID_VERSION_CODE, MAX_RUN_SEQUENCE };
