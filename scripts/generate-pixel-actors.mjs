import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import sharp from "sharp";

// Compile the pure drawing source; no browser, remote images or image processing
// of existing art is involved. SVG rasterization places each logical pixel at 8x.
const source = await readFile(resolve("src/game/arpg/runtime/folklard-pixel-actors.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { FOLKLARD_PIXEL_ACTORS, getFolklardPixelActorFrame } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const rects = (actor, row, frame) => getFolklardPixelActorFrame(actor, row, frame)
  .map(({ x, y, width, height, color }) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`).join("");
const pathFor = (actor) => `${["blacksmith", "merchant", "archivist", "bestiaryKeeper"].includes(actor) ? `guild-${actor === "bestiaryKeeper" ? "bestiary-keeper" : actor}` : actor === "sprout" ? "monster-sprout" : `legend-${actor}`}-spritesheet-v3.webp`;

for (const actor of FOLKLARD_PIXEL_ACTORS) {
  const cells = [];
  for (let row = 0; row < 6; row++) for (let frame = 0; frame < 4; frame++) {
    cells.push(`<g transform="translate(${frame * 32} ${row * 32})">${rects(actor, row, frame)}</g>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 128 192" shape-rendering="crispEdges">${cells.join("")}</svg>`;
  const output = resolve("public/art", pathFor(actor));
  await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 6 }).toFile(output);
  console.log(`${actor}: ${output}`);
}

if (process.argv[2]) {
  const cells = FOLKLARD_PIXEL_ACTORS.map((actor, index) => {
    const x = index % 4 * 256, y = Math.floor(index / 4) * 256;
    return `<g transform="translate(${x} ${y})"><rect x="6" y="6" width="244" height="244" fill="#233039"/><g transform="translate(32 22) scale(6)">${rects(actor, 0, 0)}</g><text x="128" y="236" fill="#f3dfaa" font-family="monospace" font-size="18" text-anchor="middle">${actor}</text></g>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" shape-rendering="crispEdges"><rect width="1024" height="1280" fill="#131d26"/>${cells.join("")}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(resolve(process.argv[2]));
  console.log(`Review: ${resolve(process.argv[2])}`);
}
