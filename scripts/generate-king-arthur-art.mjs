import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import sharp from "sharp";

// Rasterize the original drawing source. Never ingest third-party/reference art.
const source = await readFile(resolve("src/game/arpg/bosses/king-arthur/pixel-art.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createArthurSpriteSvg } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const output = resolve("public/art/legend-king-arthur-spritesheet-v5.webp");
await sharp(Buffer.from(createArthurSpriteSvg())).webp({ lossless: true, effort: 6 }).toFile(output);
console.log(`Arthur: ${output}`);
