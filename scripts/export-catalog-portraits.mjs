import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { limitPixelPalette } from "./pixel-palette.mjs";

const directory = resolve("../../outputs");
const spec = JSON.parse(await readFile(join(directory, "catalog-art-spec.json"), "utf8"));
const archive = join(directory, "art-sources-v5");
await mkdir(archive, { recursive: true });
const portraits = {};
for (const id of spec.heroes) {
  portraits[id] = { sheet: `/art/legend-${id === "boto-cor-de-rosa" ? "boto" : id}-spritesheet-v5.webp`, columns: 4, rows: 6, column: 0, row: 0 };
}
portraits.roc = { sheet: "/art/monster-roc-boss-spritesheet-v5.webp", columns: 4, rows: 6, column: 0, row: 0 };
for (const group of spec.groups) {
  const result = JSON.parse(await readFile(join(directory, `${group.id}-result.json`), "utf8"));
  const source = result.output_hint.match(/as (C:\\[^\n]+\.png) by default/)[1];
  await copyFile(source, join(archive, `${group.id}.png`));
  const metadata = await sharp(source).metadata();
  // The built-in generator chooses its square export resolution. Normalize the
  // complete four-by-four grid before packing, without changing subject order.
  if (metadata.width < 768 || Math.abs(metadata.width - metadata.height) > 2) throw new Error(`${group.id}: portrait atlas must be square`);
  const { data, info } = await sharp(source).resize(1024, 1024, { kernel: "nearest" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = data[i + 3] >= 96 ? 255 : 0;
    if (!data[i + 3]) data.fill(0, i, i + 4);
  }
  const frames = [];
  const path = `/art/folklard-bestiary-${group.id}-v5.webp`;
  for (let index = 0; index < group.entries.length; index++) {
    const column = index % 4; const row = Math.floor(index / 4);
    const extracted = await sharp(data, { raw: info }).extract({ left: column * 256, top: row * 256, width: 256, height: 256 }).png().toBuffer();
    const cell = await sharp(extracted).trim().png().toBuffer();
    const bounds = await sharp(cell).metadata();
    const scale = Math.min(44 / bounds.height, 54 / bounds.width);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    frames.push({ input: await sharp(cell).resize(width, height, { kernel: "nearest" }).png().toBuffer(), left: column * 64 + Math.floor((64 - width) / 2), top: row * 64 + 56 - height });
    portraits[group.entries[index].id] = { sheet: path, columns: 4, rows: 4, column, row };
  }
  const logical = await sharp({ create: { width: 256, height: 256, channels: 4, background: "#00000000" } }).composite(frames).raw().toBuffer();
  const output = await sharp(limitPixelPalette(logical, 64), { raw: { width: 256, height: 256, channels: 4 } }).resize(1024, 1024, { kernel: "nearest" }).webp({ lossless: true, effort: 6 }).toBuffer();
  await writeFile(resolve(`public${path}`), output);
}
await writeFile("src/game/content/character-portraits.ts", `// Generated atlas coordinates; all encyclopedia art follows the user's Naturalist reference.\nimport type { SpriteDefinition } from "../types";\n\nexport const CHARACTER_PORTRAITS: Record<string, SpriteDefinition> = ${JSON.stringify(portraits, null, 2)};\n`);
console.log(`${Object.keys(portraits).length} Naturalist-style encyclopedia portraits exported.`);
