import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const report = JSON.parse(await readFile(resolve("../../outputs/character-export-v5.json"), "utf8"));
const width = 1200; const cell = 200; const height = Math.ceil(report.length / 6) * 230;
const frames = [];
for (let i = 0; i < report.length; i++) {
  const actor = report[i];
  frames.push({ input: await sharp(`public${actor.path}`).extract({ left: 0, top: 0, width: 256, height: 256 }).resize(192, 192, { kernel: "nearest" }).png().toBuffer(), left: (i % 6) * cell + 4, top: Math.floor(i / 6) * 230 });
}
const labels = report.map((actor, i) => `<text x="${i % 6 * cell + 100}" y="${Math.floor(i / 6) * 230 + 216}" text-anchor="middle" fill="#f7e5bb" font-size="13" font-family="monospace">${actor.actor}</text>`).join("");
frames.push({ input: Buffer.from(`<svg width="${width}" height="${height}">${labels}</svg>`), left: 0, top: 0 });
await writeFile(resolve("../../outputs/folklard-all-characters-v5.png"), await sharp({ create: { width, height, channels: 4, background: "#17352a" } }).composite(frames).png().toBuffer());
