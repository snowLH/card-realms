import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const directory = resolve("../../outputs");
const files = (await readdir(directory)).filter((file) => /(?:-v5|-\d\d)-prompt\.txt$/.test(file)).sort();
const text = ["# Prompts finais — personagens v5", "", "Modo: ferramenta integrada `image_gen`, com fundo transparente. Referências de estilo: `docs/folklard-character-style-reference.png` e a folha original `public/art/guild-bestiary-keeper-spritesheet-v1.webp`. Os quatro NPCs foram preservados a partir de suas folhas originais, sem nova geração criativa.", ""];
for (const file of files) {
  text.push(`## ${file.replace("-prompt.txt", "")}`, "", "```text", (await readFile(join(directory, file), "utf8")).trim(), "```", "");
}
await writeFile("docs/character-art-v5-prompts.md", text.join("\n"));
console.log(`${files.length} final prompts documented.`);
