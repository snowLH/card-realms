import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ARPG_ASSET_MANIFEST } from "../assets";
import { FOLKLARD_PIXEL_ENEMIES, getOriginalPixelEnemyId } from "./folklard-pixel-enemies";

describe("original Mata enemies", () => {
  it.each(FOLKLARD_PIXEL_ENEMIES)("exports %s with crisp transparent pixels and six distinct action cycles", async (enemy) => {
    const profile = `${enemy}-enemy` as const;
    const definition = ARPG_ASSET_MANIFEST.enemies[profile];
    expect(getOriginalPixelEnemyId(profile)).toBe(enemy);
    const file = resolve(process.cwd(), "public", definition.path.slice(1));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([definition.frameWidth * 4, definition.frameHeight * 6]);
    const palette = new Set<string>();
    let invalidPixel: string | null = null;
    for (let y = 0; y < info.height && !invalidPixel; y += 4) for (let x = 0; x < info.width && !invalidPixel; x += 4) {
      const origin = (y * info.width + x) * 4;
      const color = data.subarray(origin, origin + 4);
      if (color[3] !== 0 && color[3] !== 255) { invalidPixel = `translucency at ${x},${y}`; break; }
      if (color[3]) palette.add(color.toString("hex"));
      for (let dy = 0; dy < 4 && !invalidPixel; dy++) for (let dx = 0; dx < 4; dx++) {
        const offset = ((y + dy) * info.width + x + dx) * 4;
        if (!data.subarray(offset, offset + 4).equals(color)) { invalidPixel = `blur at ${x},${y}`; break; }
      }
    }
    expect(invalidPixel).toBeNull();
    expect(palette.size).toBeLessThanOrEqual(48);
    const native = await sharp(data, { raw: info }).resize(256, 384, { kernel: "nearest" }).raw().toBuffer();
    const cycles = new Set<string>();
    for (let row = 0; row < 6; row++) {
      const poses = new Set<string>();
      const hashes: string[] = [];
      for (let frame = 0; frame < 4; frame++) {
        const hash = createHash("sha256");
        let opaque = 0, border = 0;
        for (let y = 0; y < 64; y++) {
          const offset = ((row * 64 + y) * 256 + frame * 64) * 4;
          const line = native.subarray(offset, offset + 256);
          hash.update(line);
          for (let x = 0; x < 64; x++) {
            if (line[x * 4 + 3]) opaque++;
            if ((x === 0 || x === 63 || y === 0 || y === 63) && line[x * 4 + 3]) border++;
          }
        }
        expect(border, `${enemy} ${row}:${frame}: frame bleed`).toBe(0);
        expect(opaque, `${enemy} ${row}:${frame}: missing pose`).toBeGreaterThan(40);
        const signature = hash.digest("hex");
        poses.add(signature); hashes.push(signature);
      }
      expect(poses.size, `${enemy} ${row}: actual animation`).toBeGreaterThan(1);
      cycles.add(hashes.join(":"));
    }
    expect(cycles.size, `${enemy}: distinct six actions`).toBe(6);
  });

  it("keeps the enemies' silhouettes separate from each other and from the playable Mapinguari", async () => {
    const silhouettes = new Set<string>();
    for (const enemy of FOLKLARD_PIXEL_ENEMIES) {
      const profile = ARPG_ASSET_MANIFEST.enemies[`${enemy}-enemy`];
      const pixels = await sharp(resolve(process.cwd(), "public", profile.path.slice(1)))
        .extract({ left: 0, top: 0, width: 256, height: 256 }).resize(32, 32, { kernel: "nearest" }).ensureAlpha().raw().toBuffer();
      const alpha = Array.from({ length: 1024 }, (_, i) => pixels[i * 4 + 3]);
      silhouettes.add(createHash("sha256").update(Buffer.from(alpha)).digest("hex"));
    }
    expect(silhouettes.size).toBe(FOLKLARD_PIXEL_ENEMIES.length);
    const monster = await sharp(resolve(process.cwd(), "public/art/monster-mapinguari-enemy-spritesheet-v5.webp")).raw().toBuffer();
    const hero = await sharp(resolve(process.cwd(), "public/art/legend-mapinguari-spritesheet-v5.webp")).raw().toBuffer();
    expect(monster.equals(hero)).toBe(false);
    expect(getOriginalPixelEnemyId("amarok-boss")).toBeNull();
  });

});
