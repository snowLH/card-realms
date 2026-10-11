"use strict";
const PRODUCTION_GAME_URL = "https://card-realms.vercel.app/";
// Only the separate QA package injects this metadata; normal releases omit it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packagedQaOrigin = require("./package.json").folklardNativeQaOrigin;
function resolveAppConfig(env = process.env, args = process.argv, qaOrigin = packagedQaOrigin) {
  const requested = Boolean(qaOrigin) || env.FOLKLARD_NATIVE_QA === "1" || args.includes("--folklard-native-qa");
  const argument = args.find((value) => value.startsWith("--folklard-native-qa-url="));
  const raw = argument?.slice("--folklard-native-qa-url=".length) ?? env.FOLKLARD_NATIVE_QA_URL ?? qaOrigin;
  if (requested && raw) {
    try {
      const url = new URL(raw);
      if (["127.0.0.1", "localhost"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol)
        && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) {
        return { qa: true, gameUrl: url.toString(), protocolArgs: ["--folklard-native-qa", `--folklard-native-qa-url=${url}`] };
      }
    } catch { /* Never trust an arbitrary environment/argv URL. */ }
    throw new Error("Native QA requires an explicit loopback URL");
  }
  return { qa: false, gameUrl: PRODUCTION_GAME_URL, protocolArgs: [] };
}
module.exports = { resolveAppConfig };
