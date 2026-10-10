import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  AMAROK_BOSS_ANIMATIONS,
  AMAROK_BOSS_FRAME_SIZE,
  BOTO_ENEMY_ANIMATIONS,
  BOTO_ENEMY_FRAME_SIZE,
  RAIJU_ENEMY_ANIMATIONS,
  RAIJU_ENEMY_FRAME_SIZE,
  CURUPIRA_BOSS_ANIMATIONS,
  CURUPIRA_BOSS_FRAME_SIZE,
  IARA_BOSS_ANIMATIONS,
  IARA_BOSS_FRAME_SIZE,
  SPROUT_ENEMY_ANIMATIONS,
  SPROUT_ENEMY_FRAME_SIZE,
  getArpgEnemyAnimationProfile,
} from "./enemy-sprites";
import { ARPG_DUNGEON_CONFIGS } from "../content/dungeons";
import { ARPG_ASSET_MANIFEST } from "../assets";

const readImage = (assetPath: string) => readFileSync(new URL(`../../../../public${assetPath}`, import.meta.url));
const readMetadata = (assetPath: string) => sharp(readImage(assetPath)).metadata();

describe("folklore enemy spritesheets", () => {
  it("loads an original transparent Broto WebP with six action rows", async () => {
    const metadata = await readMetadata(ARPG_ASSET_MANIFEST.enemies["sprout-enemy"].path);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(width).toBe(1024);
    expect(height).toBe(1536);
    expect(Math.floor(width / SPROUT_ENEMY_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / SPROUT_ENEMY_FRAME_SIZE)).toBe(6);
    expect(width - SPROUT_ENEMY_FRAME_SIZE * 4).toBe(0);
    expect(height - SPROUT_ENEMY_FRAME_SIZE * 6).toBe(0);
    expect(Object.entries(SPROUT_ENEMY_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["shoot", 3],
      ["damage", 4],
      ["defeat", 5],
    ]);
    expect(getArpgEnemyAnimationProfile("sprout-enemy")).toMatchObject({
      path: ARPG_ASSET_MANIFEST.enemies["sprout-enemy"].path,
      frameWidth: SPROUT_ENEMY_FRAME_SIZE,
      scale: 0.25,
    });
    expect(ARPG_DUNGEON_CONFIGS["mata-encantada"].enemyAnimations?.sprout).toBe("sprout-enemy");
  });

  it("uses a transparent four-by-six WebP atlas with every gameplay action", async () => {
    const metadata = await readMetadata(ARPG_ASSET_MANIFEST.enemies["curupira-boss"].path);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(Math.floor(width / CURUPIRA_BOSS_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / CURUPIRA_BOSS_FRAME_SIZE)).toBe(6);
    expect(width - CURUPIRA_BOSS_FRAME_SIZE * 4).toBe(0);
    expect(height - CURUPIRA_BOSS_FRAME_SIZE * 6).toBe(0);
  });

  it("maps distinct idle, walk, attack, shoot, damage, and defeat cycles to the Mata boss", () => {
    expect(Object.entries(CURUPIRA_BOSS_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["shoot", 3],
      ["damage", 4],
      ["defeat", 5],
    ]);
    expect(ARPG_DUNGEON_CONFIGS["mata-encantada"].enemyAnimations?.boss).toBe("curupira-boss");
  });

  it("retains Amarok art while Rúnicas uses Arthur's authored presentation", async () => {
    const metadata = await readMetadata(ARPG_ASSET_MANIFEST.enemies["amarok-boss"].path);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(width).toBe(1024);
    expect(height).toBe(1536);
    expect(width - AMAROK_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - AMAROK_BOSS_FRAME_SIZE * 6).toBe(0);
    expect(AMAROK_BOSS_FRAME_SIZE).toBe(CURUPIRA_BOSS_FRAME_SIZE);
    expect(Object.entries(AMAROK_BOSS_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["shoot", 3],
      ["damage", 4],
      ["defeat", 5],
    ]);
    expect(ARPG_DUNGEON_CONFIGS["montanhas-runicas"].bossPresentation).toBe("king-arthur");
  });

  it("loads the original transparent Iara sheet as the Marés boss animation", async () => {
    const metadata = await readMetadata(ARPG_ASSET_MANIFEST.enemies["iara-boss"].path);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(width).toBe(1024);
    expect(height).toBe(1536);
    expect(width - IARA_BOSS_FRAME_SIZE * 4).toBe(0);
    expect(height - IARA_BOSS_FRAME_SIZE * 6).toBe(0);
    expect(IARA_BOSS_FRAME_SIZE).toBe(CURUPIRA_BOSS_FRAME_SIZE);
    expect(Object.entries(IARA_BOSS_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["shoot", 3],
      ["damage", 4],
      ["defeat", 5],
    ]);
    expect(ARPG_DUNGEON_CONFIGS["arquipelago-das-mares"].enemyAnimations?.boss).toBe("iara-boss");
  });

  it("loads an original transparent Boto sheet and assigns it to the Marés skirmisher", async () => {
    const metadata = await readMetadata(ARPG_ASSET_MANIFEST.enemies["boto-enemy"].path);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(width).toBe(1024);
    expect(height).toBe(1536);
    expect(Math.floor(width / BOTO_ENEMY_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / BOTO_ENEMY_FRAME_SIZE)).toBe(6);
    expect(width - BOTO_ENEMY_FRAME_SIZE * 4).toBe(0);
    expect(height - BOTO_ENEMY_FRAME_SIZE * 6).toBe(0);
    expect(BOTO_ENEMY_FRAME_SIZE).toBe(256);
    expect(Object.entries(BOTO_ENEMY_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["shoot", 3],
      ["damage", 4],
      ["defeat", 5],
    ]);
    expect(getArpgEnemyAnimationProfile("boto-enemy")).toMatchObject({
      path: ARPG_ASSET_MANIFEST.enemies["boto-enemy"].path,
      frameWidth: BOTO_ENEMY_FRAME_SIZE,
      scale: 0.25,
    });
    expect(ARPG_DUNGEON_CONFIGS["arquipelago-das-mares"].enemyAnimations?.skirmisher).toBe("boto-enemy");
  });

  it("loads an original transparent Raijū sheet and assigns it to the Rúnicas storm beast", async () => {
    const metadata = await readMetadata(ARPG_ASSET_MANIFEST.enemies["raiju-enemy"].path);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(width).toBe(1024);
    expect(height).toBe(1536);
    expect(Math.floor(width / RAIJU_ENEMY_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / RAIJU_ENEMY_FRAME_SIZE)).toBe(6);
    expect(width - RAIJU_ENEMY_FRAME_SIZE * 4).toBe(0);
    expect(height - RAIJU_ENEMY_FRAME_SIZE * 6).toBe(0);
    expect(RAIJU_ENEMY_FRAME_SIZE).toBe(256);
    expect(Object.entries(RAIJU_ENEMY_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["shoot", 3],
      ["damage", 4],
      ["defeat", 5],
    ]);
    expect(getArpgEnemyAnimationProfile("raiju-enemy")).toMatchObject({
      path: ARPG_ASSET_MANIFEST.enemies["raiju-enemy"].path,
      frameWidth: RAIJU_ENEMY_FRAME_SIZE,
      scale: 0.25,
    });
    expect(ARPG_DUNGEON_CONFIGS["montanhas-runicas"].enemyAnimations?.stormBeast).toBe("raiju-enemy");
  });
});
