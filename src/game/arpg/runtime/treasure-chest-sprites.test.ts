import { readFileSync } from "node:fs";
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
  it("loads the original transparent 2×2 chest animation atlas", () => {
    const image = readImage(TREASURE_CHEST_ASSET_PATH);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.readUInt32BE(16)).toBe(TREASURE_CHEST_FRAME_SIZE * 2);
    expect(image.readUInt32BE(20)).toBe(TREASURE_CHEST_FRAME_SIZE * 2);
    expect(image[25]).toBe(6);
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
