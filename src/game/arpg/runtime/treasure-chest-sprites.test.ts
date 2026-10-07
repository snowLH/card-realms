import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  TREASURE_CHEST_ASSET_PATH,
  TREASURE_CHEST_FRAME_SIZE,
  TREASURE_CHEST_OPEN_FRAMES,
  TREASURE_CHEST_OPEN_ANIMATION_KEY,
  TREASURE_CHEST_FRAME_BOUNDS,
  getTreasureChestFrameBounds,
} from "./treasure-chest-sprites";
import { ARPG_ASSET_MANIFEST } from "../assets";

const readImage = (assetPath: string) => readFileSync(new URL(`../../../../public${assetPath}`, import.meta.url));

describe("treasure chest spritesheet", () => {
  it("loads the original transparent 2×2 WebP chest animation atlas", async () => {
    const image = readImage(TREASURE_CHEST_ASSET_PATH);
    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(metadata.width).toBe(TREASURE_CHEST_FRAME_SIZE * 2);
    expect(metadata.height).toBe(TREASURE_CHEST_FRAME_SIZE * 2);
    expect(TREASURE_CHEST_ASSET_PATH).toBe(ARPG_ASSET_MANIFEST.props.treasureChest.path);
  });

  it("keeps the chest closed initially and opens through the remaining frames once", () => {
    expect(TREASURE_CHEST_OPEN_ANIMATION_KEY).toBe("folklard-treasure-chest-open");
    expect(TREASURE_CHEST_OPEN_FRAMES).toEqual([1, 2, 3]);
  });

  it("keeps the prompt above the correct sprite bounds in all four frames", () => {
    expect(TREASURE_CHEST_FRAME_BOUNDS).toEqual({
      0: { top: 172, baseline: 574 },
      1: { top: 169, baseline: 578 },
      2: { top: 36, baseline: 546 },
      3: { top: 35, baseline: 548 },
    });
    expect(getTreasureChestFrameBounds(3)).toEqual({ top: 35, baseline: 548 });
    expect(getTreasureChestFrameBounds(9)).toEqual({ top: 172, baseline: 574 });
  });
});
