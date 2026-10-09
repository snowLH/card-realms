import { resolve } from "node:path";
import type { Scene } from "phaser";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FOLKLARD_PIXEL_ENEMIES } from "./folklard-pixel-enemies";
import { createOriginalPixelEnemySheet } from "./original-enemy-sheet";

afterEach(() => vi.unstubAllGlobals());

describe("original enemy asset-load fallback", () => {
  it.each(FOLKLARD_PIXEL_ENEMIES)("reproduces the exported %s pixels when its image is unavailable", async (enemy) => {
    // A deterministic raster backend for Canvas fillRect; the production drawing
    // remains the code under test and is compared with the exported WebP.
    const pixels = Buffer.alloc(1024 * 1536 * 4);
    const context = {
      fillStyle: "#000000", imageSmoothingEnabled: true,
      fillRect(x: number, y: number, width: number, height: number) {
        const color = Buffer.from(this.fillStyle.slice(1) + "ff", "hex");
        for (let dy = y; dy < y + height; dy++) {
          for (let dx = x; dx < x + width; dx++) color.copy(pixels, (dy * 1024 + dx) * 4);
        }
      },
    };
    const canvas = { width: 0, height: 0, getContext: () => context };
    vi.stubGlobal("document", { createElement: () => canvas });
    const addSpriteSheet = vi.fn(() => ({ frameTotal: 25, has: (frame: string) => frame === "23" }));
    const scene = { textures: { exists: () => false, addSpriteSheet } } as unknown as Scene;
    createOriginalPixelEnemySheet(scene, enemy, "enemy-fallback");
    expect(addSpriteSheet).toHaveBeenCalledWith("enemy-fallback", canvas, { frameWidth: 256, frameHeight: 256, endFrame: 23 });
    const exported = await sharp(resolve(process.cwd(), `public/art/monster-${enemy}-spritesheet-v3.webp`)).ensureAlpha().raw().toBuffer();
    expect(pixels.equals(exported)).toBe(true);
  });
});
