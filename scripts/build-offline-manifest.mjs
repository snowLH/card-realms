import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

async function filesBelow(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesBelow(join(root, entry.name)) : [join(root, entry.name)]))).flat();
}

// Only public game files; authenticated HTML/API responses never enter the pack.
const projectDir = resolve(process.argv[2] ?? ".");
const distDir = resolve(process.argv[3] ?? join(projectDir, ".next"));
const staticDir = join(distDir, "static");
const sources = (await filesBelow(join(projectDir, "src"))).filter((path) => /\.(tsx?|css)$/.test(path) && !/\.test\./.test(path)).sort();
const hash = createHash("sha256");
const art = new Set();
const legacyPortrait = /\/(?:folklore-creatures(?:-second-atlas)?-chibi-portraits-v1\.webp|requested-creatures-chibi-atlas-[a-d]-v[12]\.webp|folklore-requested-evolution-atlas\.svg)$/;
for (const path of sources) {
  const source = await readFile(path, "utf8");
  // Include the public shell's source so HTML changes invalidate the pack too.
  // Prerendered HTML does not exist yet and hosts may relocate it afterwards.
  hash.update(relative(projectDir, path).replaceAll("\\", "/")).update(source);
  for (const match of source.matchAll(/["'(](\/art\/[^"')\s]+\.(?:webp|png|svg))["')]/g)) {
    if (!legacyPortrait.test(match[1])) art.add(match[1]);
  }
}
const staticPaths = (await filesBelow(staticDir))
  .filter((path) => /\.(?:js|css|woff2?)$/.test(path))
  .map((path) => `/_next/static/${relative(staticDir, path).replaceAll("\\", "/")}`).sort();
const files = ["/offline", "/offline.html", "/manifest.webmanifest", "/icon.svg", "/apple-icon.png",
  "/icons/card-realms-192.png", "/icons/card-realms-512.png", "/icons/card-realms-maskable-512.png",
  ...staticPaths, ...[...art].sort()];
// Byte estimate covers static assets; /offline is fetched after prerendering.
let bytes = 0;
for (const path of files.filter((path) => path !== "/offline")) {
  const asset = path.startsWith("/_next/static/") ? join(staticDir, path.slice(14)) : join(projectDir, `public${path}`);
  bytes += (await stat(asset)).size;
  hash.update(await readFile(asset));
}
const version = hash.update(JSON.stringify(files)).digest("hex").slice(0,16);
await writeFile(join(projectDir, "public/offline-pack.json"), JSON.stringify({ version, bytes, files }));
console.log(`Offline pack: ${files.length} public files, ${(bytes / 1048576).toFixed(1)} MB.`);
