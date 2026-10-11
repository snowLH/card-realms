import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { limitPixelPalette } from "./pixel-palette.mjs";

// The source is an imagegen-authored bitmap, never procedural scenery.
// Usage: node scripts/export-boss-room-art.mjs curupira original.png
const [id, source] = process.argv.slice(2);
if (!["curupira", "iara", "arthur"].includes(id) || !source) throw new Error("Informe o boss e o PNG original.");
const directory = path.join("public/art/boss-rooms", id);
await fs.mkdir(directory, { recursive: true });
const { data } = await sharp(source).resize(976, 496, { fit: "fill", kernel: "nearest" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
await sharp(limitPixelPalette(data, 128), { raw: { width: 976, height: 496, channels: 4 } })
  .resize(1952, 992, { kernel: "nearest" }).webp({ lossless: true, effort: 6 })
  .toFile(path.join(directory, "arena.webp"));
