import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ARPG_ASSET_MANIFEST } from "../assets";
import { PLAYABLE_LEGEND_IDS } from "../content/legends";
import { getGeneratedLegendSpriteSheet } from "./legend-sprite-sheets";

const characterPaths = [...new Set([
  ...PLAYABLE_LEGEND_IDS.map((id) => getGeneratedLegendSpriteSheet(id)!),
  ...Object.values(ARPG_ASSET_MANIFEST.guildNpcs).map((sheet) => sheet.path),
  ...Object.values(ARPG_ASSET_MANIFEST.enemies).map((sheet) => sheet.path),
  "/art/monster-roc-boss-spritesheet-v5.webp",
  "/art/monster-king-arthur-corrupted-spritesheet-v5.webp",
])];

describe("Naturalist pixel art family", () => {
  it("uses the same active generation for all playable heroes, NPCs and dungeon enemies", () => {
    expect(characterPaths).toHaveLength(37);
    expect(characterPaths.every((path) => path.endsWith("-v5.webp"))).toBe(true);
  });

  it.each(characterPaths)("keeps %s sharp, transparent, padded and genuinely animated", async (path) => {
    const source = await readFile(`public${path}`);
    expect(source.byteLength).toBeLessThan(150_000);
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([1024, 1536, 4]);
    const colours = new Set<number>();
    let binaryAlpha = true;
    let gridAligned = true;
    const logical = Buffer.alloc(256 * 384 * 4);
    for (let y = 0; y < info.height; y += 4) for (let x = 0; x < info.width; x += 4) {
      const offset = (y * info.width + x) * 4;
      const pixel = data.readUInt32LE(offset);
      colours.add(pixel);
      binaryAlpha &&= data[offset + 3] === 0 || data[offset + 3] === 255;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
        if (data.readUInt32LE(((y + dy) * info.width + x + dx) * 4) !== pixel) gridAligned = false;
      }
      logical.writeUInt32LE(pixel, ((y / 4) * 256 + x / 4) * 4);
    }
    expect(binaryAlpha).toBe(true);
    expect(gridAligned).toBe(true);
    expect(colours.size).toBeLessThanOrEqual(48);
    expect(colours.size).toBeGreaterThan(12);
    const hashes: string[] = [];
    for (let frame = 0; frame < 24; frame++) {
      const pose = Buffer.alloc(64 * 64 * 4);
      let visible = 0;
      let touchesBoundary = false;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const offset = ((Math.floor(frame / 4) * 64 + y) * 256 + (frame % 4) * 64 + x) * 4;
        logical.copy(pose, (y * 64 + x) * 4, offset, offset + 4);
        if (logical[offset + 3]) {
          visible++;
          if (x < 4 || y < 4 || x >= 60 || y >= 60) touchesBoundary = true;
        }
      }
      expect(visible, `frame ${frame}`).toBeGreaterThan(80);
      expect(touchesBoundary, `frame ${frame}`).toBe(false);
      hashes.push(createHash("sha256").update(pose).digest("hex"));
    }
    for (const row of [1, 2, 3]) expect(new Set(hashes.slice(row * 4, row * 4 + 4)).size, `cycle ${row}`).toBeGreaterThan(1);
    expect(hashes[0]).not.toBe(hashes[23]);
  });
});
