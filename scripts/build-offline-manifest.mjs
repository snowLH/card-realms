import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

async function filesBelow(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesBelow(join(root, entry.name)) : [join(root, entry.name)]))).flat();
}

// Only public game files; authenticated HTML/API responses never enter the pack.
const sources = (await filesBelow("src")).filter((path) => /\.(tsx?|css)$/.test(path) && !/\.test\./.test(path));
const art = new Set();
const legacyPortrait = /\/(?:folklore-creatures(?:-second-atlas)?-chibi-portraits-v1\.webp|requested-creatures-chibi-atlas-[a-d]-v[12]\.webp|folklore-requested-evolution-atlas\.svg)$/;
for (const path of sources) {
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(/["'(](\/art\/[^"')\s]+\.(?:webp|png|svg))["')]/g)) {
    if (!legacyPortrait.test(match[1])) art.add(match[1]);
  }
}
const staticPaths = (await filesBelow(".next/static"))
  .filter((path) => /\.(?:js|css|woff2?)$/.test(path))
  .map((path) => `/_next/static/${relative(".next/static", path).replaceAll("\\", "/")}`);
const files = ["/offline", "/offline.html", "/manifest.webmanifest", "/icon.svg", "/apple-icon.png",
  "/icons/card-realms-192.png", "/icons/card-realms-512.png", "/icons/card-realms-maskable-512.png",
  ...staticPaths, ...[...art].sort()];
let bytes = (await stat(".next/server/app/offline.html")).size;
const hash = createHash("sha256").update(await readFile(".next/server/app/offline.html"));
for (const path of files.filter((path) => path !== "/offline")) {
  const asset = path.startsWith("/_next/static/") ? `.next/static/${path.slice(14)}` : `public${path}`;
  bytes += (await stat(asset)).size;
  hash.update(await readFile(asset));
}
const version = hash.update(JSON.stringify(files)).digest("hex").slice(0,16);
await writeFile("public/offline-pack.json", JSON.stringify({ version, bytes, files }));
console.log(`Offline pack: ${files.length} public files, ${(bytes / 1048576).toFixed(1)} MB.`);
