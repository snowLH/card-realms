import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PLAYABLE_LEGEND_IDS } from "../content/legends";
import { FOLKLARD_PIXEL_ACTORS, getFolklardPixelActorFrame } from "./folklard-pixel-actors";

describe("retained experimental Folklard pixel assets", () => {
  it.each(FOLKLARD_PIXEL_ACTORS.filter((actor) => actor !== "king-arthur"))("keeps %s on an opaque 32px grid without blur or frame bleed", async (actor) => {
    // Validate the preserved studies themselves. They are not the active hero
    // catalog after the user rejected their loss of character detail.
    const prefix = ["blacksmith", "merchant", "archivist", "bestiaryKeeper"].includes(actor)
      ? `guild-${actor === "bestiaryKeeper" ? "bestiary-keeper" : actor}`
      : actor === "sprout" ? "monster-sprout" : `legend-${actor}`;
    const file = resolve(process.cwd(), "public/art", `${prefix}-spritesheet-v3.webp`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1024, 1536]);
    const palette = new Set<string>();
    let invalidPixel: string | null = null;
    for (let y = 0; y < 1536 && !invalidPixel; y += 8) {
      for (let x = 0; x < 1024 && !invalidPixel; x += 8) {
        const origin = (y * 1024 + x) * 4;
        const color = data.subarray(origin, origin + 4);
        if (color[3] !== 0 && color[3] !== 255) { invalidPixel = `translucent pixel at ${x},${y}`; break; }
        if (color[3]) palette.add(color.toString("hex"));
        for (let dy = 0; dy < 8 && !invalidPixel; dy++) for (let dx = 0; dx < 8; dx++) {
          const pixel = ((y + dy) * 1024 + x + dx) * 4;
          if (!data.subarray(pixel, pixel + 4).equals(color)) { invalidPixel = `blurred cluster at ${x},${y}`; break; }
        }
      }
    }
    expect(invalidPixel).toBeNull();
    expect(palette.size).toBeLessThanOrEqual(16);
    const native = await sharp(data, { raw: info }).resize(128, 192, { kernel: "nearest" }).raw().toBuffer();
    const cycleSignatures: string[] = [];
    for (let row = 0; row < 6; row++) {
      const poses = new Set<string>();
      const cycleFrames: string[] = [];
      for (let frame = 0; frame < 4; frame++) {
        let opaque = 0;
        const hash = createHash("sha256");
        for (let y = 0; y < 32; y++) {
          const start = ((row * 32 + y) * 128 + frame * 32) * 4;
          const line = native.subarray(start, start + 32 * 4);
          hash.update(line);
          for (let x = 0; x < 32; x++) {
            const alpha = line[x * 4 + 3];
            if (alpha) opaque++;
            if (x === 0 || x === 31 || y === 0 || y === 31) expect(alpha, `${actor} row ${row} frame ${frame}: border ${x},${y}`).toBe(0);
          }
        }
        expect(opaque, `${actor} row ${row} frame ${frame}`).toBeGreaterThan(64);
        const signature = hash.digest("hex");
        poses.add(signature);
        cycleFrames.push(signature);
      }
      if (PLAYABLE_LEGEND_IDS.includes(actor as typeof PLAYABLE_LEGEND_IDS[number])) {
        expect(poses.size, `${actor} row ${row}: actual animation poses`).toBeGreaterThan(1);
      }
      cycleSignatures.push(cycleFrames.join(":"));
    }
    if (PLAYABLE_LEGEND_IDS.includes(actor as typeof PLAYABLE_LEGEND_IDS[number])) {
      expect(cycleSignatures[0], `${actor}: moving differs from resting`).not.toBe(cycleSignatures[1]);
      expect(cycleSignatures[2], `${actor}: signature magic differs from the basic attack`).not.toBe(cycleSignatures[3]);
    }
  });

  it("draws both Curupira feet with left-facing toes below a right-facing head", () => {
    const pixels = Array<string | null>(32 * 32).fill(null);
    for (const rect of getFolklardPixelActorFrame("curupira", 0, 0)) {
      for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) pixels[y * 32 + x] = rect.color;
    }
    expect(pixels[27 * 32 + 11]).toBe("#efaa65");
    expect(pixels[27 * 32 + 18]).toBe("#efaa65");
    expect(pixels[27 * 32 + 24]).toBeNull();
    expect(pixels[9 * 32 + 20]).toBe("#fff1ce");
  });
});
