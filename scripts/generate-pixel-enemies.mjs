import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import sharp from "sharp";

const source = await readFile(resolve("src/game/arpg/runtime/folklard-pixel-enemies.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { FOLKLARD_PIXEL_ENEMIES, getFolklardPixelEnemyFrame } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const rects = (enemy, row, frame) => getFolklardPixelEnemyFrame(enemy, row, frame)
  .map(({ x, y, width, height, color }) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`).join("");

for (const enemy of FOLKLARD_PIXEL_ENEMIES) {
  const cells = [];
  for (let row = 0; row < 6; row++) for (let frame = 0; frame < 4; frame++) {
    cells.push(`<g transform="translate(${frame * 32} ${row * 32})">${rects(enemy, row, frame)}</g>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 128 192" shape-rendering="crispEdges">${cells.join("")}</svg>`;
  await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 6 }).toFile(resolve("public/art", `monster-${enemy}-spritesheet-v3.webp`));
  console.log(`Original pixel enemy: ${enemy}`);
}

if (process.argv[2]) {
  const cells = FOLKLARD_PIXEL_ENEMIES.flatMap((enemy, index) => [0, 1, 2, 3, 4, 5].map((row) => {
    const x = row * 192, y = index * 192;
    return `<g transform="translate(${x} ${y})"><rect x="4" y="4" width="184" height="184" fill="#233039"/><g transform="translate(32 10) scale(4)">${rects(enemy, row, row === 2 ? 2 : 1)}</g><text x="96" y="158" fill="#f3dfaa" font-family="monospace" font-size="12" text-anchor="middle">${enemy}</text><text x="96" y="176" fill="#99d5b5" font-family="monospace" font-size="11" text-anchor="middle">${["idle", "walk", "attack", "shoot", "damage", "defeat"][row]}</text></g>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="768" shape-rendering="crispEdges"><rect width="1152" height="768" fill="#131d26"/>${cells.join("")}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(resolve(process.argv[2]));
}
