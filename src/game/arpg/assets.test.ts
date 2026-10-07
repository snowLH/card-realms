import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ARPG_ASSET_MANIFEST,
  ARPG_ASSET_PATHS,
  getArpgSpriteSheetFrameConfig,
  registerArpgSpriteSheetAnimations,
} from "./assets";

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

describe("ARPG runtime asset manifest", () => {
  it("points every loaded static asset at a checked-in public file", () => {
    expect(ARPG_ASSET_PATHS.length).toBeGreaterThan(0);
    for (const assetPath of ARPG_ASSET_PATHS) {
      expect(assetPath).toMatch(/^\/art\//);
      expect(existsSync(resolve(process.cwd(), "public", assetPath.slice(1)))).toBe(true);
    }
  });

  it("resolves all literal art URLs in source and keeps original PNGs out of public", () => {
    const sourceRoot = resolve(process.cwd(), "src");
    const publicArt = resolve(process.cwd(), "public", "art");
    const sourceFiles = listFiles(sourceRoot).filter((file) => /\.(?:css|js|json|ts|tsx)$/i.test(file));
    const references = sourceFiles.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(/[\"'`]\/(art\/[^\"'`\s)]+)[\"'`]/g)]
        .map((match) => ({ file, assetPath: `/${match[1]}` }));
    });

    for (const reference of references) {
      expect(existsSync(resolve(process.cwd(), "public", reference.assetPath.slice(1))), reference.file).toBe(true);
    }
    expect(readdirSync(publicArt).some((file) => file.toLowerCase().endsWith(".png"))).toBe(false);
  });

  it("keeps every service worker precache entry available in public", () => {
    const serviceWorker = readFileSync(resolve(process.cwd(), "public", "sw.js"), "utf8");
    const coreAssets = serviceWorker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1];
    expect(coreAssets).toBeDefined();

    const assetPaths = [...coreAssets!.matchAll(/\"([^\"]+)\"/g)].map((match) => match[1]);
    expect(assetPaths.length).toBeGreaterThan(0);
    for (const assetPath of assetPaths) {
      const publicFile = resolve(process.cwd(), "public", assetPath.slice(1));
      const appMetadataFile = resolve(process.cwd(), "src", "app", assetPath.slice(1));
      expect(existsSync(publicFile) || existsSync(appMetadataFile), assetPath).toBe(true);
    }
  });

  it("keeps an archived PNG source for every deployed WebP", () => {
    const publicArt = resolve(process.cwd(), "public", "art");
    const archivedArt = resolve(process.cwd(), "artifacts", "archive", "public-art");
    const webpFiles = readdirSync(publicArt).filter((file) => file.endsWith(".webp"));
    expect(webpFiles.length).toBeGreaterThan(0);

    for (const file of webpFiles) {
      const sourcePath = resolve(archivedArt, file.replace(/\.webp$/i, ".png"));
      expect(existsSync(sourcePath)).toBe(true);
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
