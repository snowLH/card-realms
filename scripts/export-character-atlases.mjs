import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import sharp from "sharp";
import { limitPixelPalette } from "./pixel-palette.mjs";

// Production atlas packing: retain source originals, uniform framing and scale
// across poses, binary alpha and the chosen logical grid with nearest-neighbor export.
if (!process.argv[2]) throw new Error("Usage: node scripts/export-character-atlases.mjs <art-spec.json>");
const specPath = resolve(process.argv[2]);
const spec = JSON.parse(await readFile(specPath, "utf8"));
if (process.argv[3]) spec.sourceDirectory = resolve(process.argv[3]);
const version = spec.version ?? 4;
const logicalFrame = spec.logicalFrame ?? 128;
const colours = spec.colours ?? 96;
const sourceArchive = resolve(`../../outputs/art-sources-v${version}`);
await mkdir(sourceArchive, { recursive: true });
const report = [];
for (const [actor, definition] of Object.entries(spec.actors)) {
  const sourcePath = definition.sourcePath ?? join(spec.sourceDirectory, definition.file);
  const archivedSource = join(sourceArchive, `${actor}${extname(sourcePath)}`);
  if (resolve(sourcePath) !== archivedSource) await copyFile(sourcePath, archivedSource);
  const metadata = await sharp(sourcePath).metadata();
  if (Math.abs(metadata.width - 1024) > 2 || Math.abs(metadata.height - 1536) > 2) throw new Error(`${actor}: incorrect source atlas dimensions`);
  const { data, info } = await sharp(sourcePath).resize(1024, 1536, { kernel: "nearest" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Transparent RGB must never leak through interpolation or WebP decoders.
  for (let offset = 0; offset < data.length; offset += 4) {
    const visible = data[offset + 3] >= 96;
    data[offset + 3] = visible ? 255 : 0;
    if (!visible) data.fill(0, offset, offset + 4);
  }
  let idleBottom = 0;
  let idleTop = 256;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 1024; x++) {
    if (data[(y * 1024 + x) * 4 + 3]) { idleBottom = Math.max(idleBottom, y); idleTop = Math.min(idleTop, y); }
  }
  const scale = Math.min(logicalFrame / 256 * 0.8, logicalFrame * 0.6875 / (idleBottom - idleTop + 1));
  const packedSize = Math.round(256 * scale);
  const left = Math.floor((logicalFrame - packedSize) / 2);
  // Uniform offset preserves the authored action motion and jumping poses.
  const margin = logicalFrame / 16;
  const top = Math.max(margin, Math.min(logicalFrame - packedSize - margin, Math.round(logicalFrame * 0.875 - idleBottom * scale)));
  const frames = [];
  for (let frame = 0; frame < 24; frame++) {
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    const buffer = await sharp(data, { raw: info })
      .extract({ left: column * 256, top: row * 256, width: 256, height: 256 })
      .resize(packedSize, packedSize, { kernel: "nearest" }).png().toBuffer();
    frames.push({ input: buffer, left: column * logicalFrame + left, top: row * logicalFrame + top });
  }
  const logicalPixels = await sharp({ create: { width: logicalFrame * 4, height: logicalFrame * 6, channels: 4, background: "#00000000" } })
    .composite(frames).raw().toBuffer();
  const logical = await sharp(limitPixelPalette(logicalPixels, colours), { raw: { width: logicalFrame * 4, height: logicalFrame * 6, channels: 4 } }).png().toBuffer();
  const prefix = ["blacksmith", "merchant", "archivist", "bestiaryKeeper"].includes(actor)
    ? `guild-${actor === "bestiaryKeeper" ? "bestiary-keeper" : actor}` : `legend-${actor}`;
  const filename = definition.path?.split("/").pop() ?? `${prefix}-spritesheet-v${version}.webp`;
  const output = await sharp(logical).resize(1024, 1536, { kernel: "nearest" }).webp({ lossless: true, effort: 6 }).toBuffer();
  await writeFile(resolve("public/art", filename), output);
  report.push({ actor, source: definition.file ?? sourcePath, path: `/art/${filename}`, bytes: output.length, logicalFrame, colours, scale, top, left });
}
await writeFile(resolve(spec.reportPath ?? `../../outputs/character-export-v${version}.json`), JSON.stringify(report, null, 2));
console.log(`${report.length} atlases exported, ${(report.reduce((sum, actor) => sum + actor.bytes, 0) / 1048576).toFixed(2)} MB total.`);
