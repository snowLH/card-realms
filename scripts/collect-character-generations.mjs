import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

// Persist each completed built-in generation before integrating the full set.
const directory = resolve(process.argv[2] ?? "../../outputs");
const specPath = join(directory, "character-art-v5.json");
const spec = JSON.parse(await readFile(specPath, "utf8"));
for (const filename of (await readdir(directory)).filter((file) => file.endsWith("-v5-result.json"))) {
  const result = JSON.parse(await readFile(join(directory, filename), "utf8"));
  const file = result.output_hint?.match(/exec-[a-f0-9-]+\.png/)?.[0];
  if (!file) throw new Error(`${result.id}: generation did not return a saved image`);
  spec.actors[result.id] = { file, subject: result.subject };
  if (/-enemy$|-boss$/.test(result.id)) spec.actors[result.id].path = `/art/monster-${result.id}-spritesheet-v5.webp`;
}
await writeFile(specPath, JSON.stringify(spec, null, 2));
console.log(`${Object.keys(spec.actors).length} character sources registered.`);
