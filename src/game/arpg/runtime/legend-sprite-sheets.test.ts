import { access } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PLAYABLE_LEGEND_IDS } from "../content/legends";
import {
  GENERATED_SPRITE_FRAME_COUNT,
  GENERATED_SPRITE_FRAME_SIZE,
  getGeneratedLegendSpriteSheet,
} from "./legend-sprite-sheets";

describe("playable legend sprite sheets", () => {
  it("provides a complete six-cycle sheet for every playable legend", async () => {
    expect(GENERATED_SPRITE_FRAME_COUNT).toBe(24);

    await Promise.all(PLAYABLE_LEGEND_IDS.map(async (legendId) => {
      const publicPath = getGeneratedLegendSpriteSheet(legendId);
      expect(publicPath).toMatch(/^\/art\/legend-[a-z-]+-spritesheet(?:-safe)?-v\d+\.webp$/);

      const filePath = resolve(process.cwd(), "public", publicPath!.slice(1));
      await access(filePath);
      const metadata = await sharp(filePath).metadata();
      expect(metadata.width).toBe(GENERATED_SPRITE_FRAME_SIZE * 4);
      expect(metadata.height).toBe(GENERATED_SPRITE_FRAME_SIZE * 6);
      expect(metadata.hasAlpha).toBe(true);
    }));
  });
});
