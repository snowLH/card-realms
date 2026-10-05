import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ARPG_ASSET_MANIFEST,
  ARPG_ASSET_PATHS,
  getArpgSpriteSheetFrameConfig,
  registerArpgSpriteSheetAnimations,
} from "./assets";

describe("ARPG runtime asset manifest", () => {
  it("points every loaded static asset at a checked-in public file", () => {
    expect(ARPG_ASSET_PATHS.length).toBeGreaterThan(0);
    for (const assetPath of ARPG_ASSET_PATHS) {
      expect(assetPath).toMatch(/^\/art\//);
      expect(existsSync(resolve(process.cwd(), "public", assetPath.slice(1)))).toBe(true);
    }
  });

  it("keeps sprite frame sizes and animation ranges in the reusable manifest", () => {
    const spriteSheets = [
      ARPG_ASSET_MANIFEST.player,
      ...Object.values(ARPG_ASSET_MANIFEST.characterAtlases),
      ...Object.values(ARPG_ASSET_MANIFEST.enemies),
      ...Object.values(ARPG_ASSET_MANIFEST.guildNpcs),
      ARPG_ASSET_MANIFEST.props.treasureChest,
    ];

    for (const sheet of spriteSheets) {
      expect(getArpgSpriteSheetFrameConfig(sheet)).toEqual({
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
        endFrame: sheet.frameCount - 1,
      });
      if (!("animations" in sheet)) continue;
      const columns = "columns" in sheet ? sheet.columns ?? 1 : 1;
      for (const animation of Object.values(sheet.animations)) {
        const firstFrame = "row" in animation
          ? animation.row * columns
          : animation.startFrame;
        const lastFrame = "row" in animation
          ? firstFrame + columns - 1
          : animation.endFrame;
        expect(firstFrame).toBeGreaterThanOrEqual(0);
        expect(lastFrame).toBeLessThan(sheet.frameCount);
      }
    }
  });

  it("registers animations from manifest rows and frame ranges", () => {
    const create = vi.fn();
    const generateFrameNumbers = vi.fn(() => []);
    const scene = {
      anims: {
        exists: vi.fn(() => false),
        generateFrameNumbers,
        create,
      },
    } as unknown as import("phaser").Scene;

    registerArpgSpriteSheetAnimations(scene, {
      textureKey: ARPG_ASSET_MANIFEST.props.treasureChest.textureKey,
      animations: ARPG_ASSET_MANIFEST.props.treasureChest.animations,
      columns: ARPG_ASSET_MANIFEST.props.treasureChest.columns,
      keyPrefix: ARPG_ASSET_MANIFEST.props.treasureChest.animationKeyPrefix,
    });

    expect(generateFrameNumbers).toHaveBeenCalledWith("folklard-treasure-chest", { start: 1, end: 3 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      key: "folklard-treasure-chest-open",
      frameRate: 10,
      repeat: 0,
    }));
  });
});
