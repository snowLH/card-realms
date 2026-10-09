import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const subjects = new Map();
for (const file of await readdir("src/game/content/creatures")) {
  const source = await readFile(`src/game/content/creatures/${file}`, "utf8");
  for (const match of source.matchAll(/id: "([^"]+)", name: "([^"]+)"[\s\S]*?description: "([^"]+)"/g)) {
    subjects.set(match[1], { id: match[1], name: match[2], description: match[3] });
  }
}
const expansion = await readFile("src/game/content/requested-expansion.ts", "utf8");
for (const row of expansion.match(/const REQUESTED_ROWS = `([\s\S]*?)`;/)[1].trim().split("\n")) {
  const [id, name, , , description] = row.split("|");
  if (!subjects.has(id)) subjects.set(id, { id, name, description });
}
const heroes = ["curupira", "iara", "boto-cor-de-rosa", "kappa", "raiju", "ratatoskr", "mapinguari", "amarok", "kelpie", "ahuizotl", "carbunclo", "alicanto", "yeti"];
const extras = [...subjects.values()].filter((subject) => !heroes.includes(subject.id) && subject.id !== "roc");
const style = "Folklard encyclopedia SPRITE ATLAS. Match PRIMARY user reference image1 LITERALLY, image2 clarifies its style. Cute compact chibi pixel art, huge head, short limbs, simple black pixel eyes, thick dark STEPPED outline, small 3-4 color ramps, flat 2D 16-bit SQUARE PIXEL clusters. No 3D, no painted texture, no smooth shading or blur. TRANSPARENT 1024x1024PNG, exact4columns4rows of256squarecells. Each cell holds ONE different FULL BODY creature, centered, about176px tall, same tiny chibi proportions as reference, native64pixel logical grid,4xnearest export. 24px transparent margin on EVERY side. No scenery, text, letters, grid, watermark or labels. Facing southeast, idle pose. Keep all silhouettes and identities distinct. IMPORTANT: exact subjects in ROW MAJOR order left to right, top to bottom. Empty unused cells are fully transparent. Draw actual game sprites, not illustrations reduced in size. Interpret the following folklore descriptions as cute game designs, NO gore or nudity.\n";
const groups = [];
for (let start = 0; start < extras.length; start += 16) {
  const id = `catalog-${String(groups.length + 1).padStart(2, "0")}`;
  const entries = extras.slice(start, start + 16);
  const prompt = style + entries.map((subject, i) => `CELL row${Math.floor(i / 4) + 1} column${i % 4 + 1}: ${subject.name} (${subject.id}) — ${subject.description}`).join("\n");
  groups.push({ id, entries, prompt });
  await writeFile(resolve(`../../outputs/${id}-prompt.txt`), prompt);
}
await writeFile(resolve("../../outputs/catalog-art-spec.json"), JSON.stringify({ heroes, groups, total: subjects.size }, null, 2));
console.log(`${subjects.size} encyclopedia entries: ${heroes.length} hero sheets + Roc + ${extras.length} portraits in ${groups.length} atlases.`);
