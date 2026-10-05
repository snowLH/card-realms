import { readFileSync } from "node:fs";
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

describe("folklore enemy spritesheets", () => {
  it("loads an original transparent Broto sheet with the four combat animation rows", () => {
    const image = readImage(ARPG_ASSET_MANIFEST.enemies["sprout-enemy"].path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    expect(width).toBe(1254);
    expect(height).toBe(1254);
    expect(Math.floor(width / SPROUT_ENEMY_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / SPROUT_ENEMY_FRAME_SIZE)).toBe(4);
    expect(width - SPROUT_ENEMY_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - SPROUT_ENEMY_FRAME_SIZE * 4).toBeLessThan(4);
    expect(image[25]).toBe(6);
    expect(Object.entries(SPROUT_ENEMY_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["defeat", 3],
    ]);
    expect(getArpgEnemyAnimationProfile("sprout-enemy")).toMatchObject({
      path: ARPG_ASSET_MANIFEST.enemies["sprout-enemy"].path,
      frameWidth: SPROUT_ENEMY_FRAME_SIZE,
      scale: 0.2,
    });
    expect(ARPG_DUNGEON_CONFIGS["mata-encantada"].enemyAnimations?.sprout).toBe("sprout-enemy");
  });

  it("uses a transparent four-by-four PNG atlas with room for every animation frame", () => {
    const image = readImage(ARPG_ASSET_MANIFEST.enemies["curupira-boss"].path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    expect(Math.floor(width / CURUPIRA_BOSS_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / CURUPIRA_BOSS_FRAME_SIZE)).toBe(4);
    expect(width - CURUPIRA_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - CURUPIRA_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(image[25]).toBe(6);
  });

  it("maps distinct idle, walk, attack, and defeat cycles to the Mata boss", () => {
    expect(Object.entries(CURUPIRA_BOSS_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["defeat", 3],
    ]);
    expect(ARPG_DUNGEON_CONFIGS["mata-encantada"].enemyAnimations?.boss).toBe("curupira-boss");
  });

  it("loads the original transparent Amarok sheet as the Rúnicas boss animation", () => {
    const image = readImage(ARPG_ASSET_MANIFEST.enemies["amarok-boss"].path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    expect(width).toBe(1254);
    expect(height).toBe(1254);
    expect(width - AMAROK_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - AMAROK_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(image[25]).toBe(6);
    expect(AMAROK_BOSS_FRAME_SIZE).toBe(CURUPIRA_BOSS_FRAME_SIZE);
    expect(Object.entries(AMAROK_BOSS_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["defeat", 3],
    ]);
    expect(ARPG_DUNGEON_CONFIGS["montanhas-runicas"].enemyAnimations?.boss).toBe("amarok-boss");
  });

  it("loads the original transparent Iara sheet as the Marés boss animation", () => {
    const image = readImage(ARPG_ASSET_MANIFEST.enemies["iara-boss"].path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    expect(width).toBe(1254);
    expect(height).toBe(1254);
    expect(width - IARA_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - IARA_BOSS_FRAME_SIZE * 4).toBeLessThan(4);
    expect(image[25]).toBe(6);
    expect(IARA_BOSS_FRAME_SIZE).toBe(CURUPIRA_BOSS_FRAME_SIZE);
    expect(Object.entries(IARA_BOSS_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["defeat", 3],
    ]);
    expect(ARPG_DUNGEON_CONFIGS["arquipelago-das-mares"].enemyAnimations?.boss).toBe("iara-boss");
  });

  it("loads an original transparent Boto sheet and assigns it to the Marés skirmisher", () => {
    const image = readImage(ARPG_ASSET_MANIFEST.enemies["boto-enemy"].path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    expect(width).toBe(1254);
    expect(height).toBe(1254);
    expect(Math.floor(width / BOTO_ENEMY_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / BOTO_ENEMY_FRAME_SIZE)).toBe(4);
    expect(width - BOTO_ENEMY_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - BOTO_ENEMY_FRAME_SIZE * 4).toBeLessThan(4);
    expect(image[25]).toBe(6);
    expect(BOTO_ENEMY_FRAME_SIZE).toBe(CURUPIRA_BOSS_FRAME_SIZE);
    expect(Object.entries(BOTO_ENEMY_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["defeat", 3],
    ]);
    expect(getArpgEnemyAnimationProfile("boto-enemy")).toMatchObject({
      path: ARPG_ASSET_MANIFEST.enemies["boto-enemy"].path,
      frameWidth: BOTO_ENEMY_FRAME_SIZE,
      scale: 0.22,
    });
    expect(ARPG_DUNGEON_CONFIGS["arquipelago-das-mares"].enemyAnimations?.skirmisher).toBe("boto-enemy");
  });

  it("loads an original transparent Raijū sheet and assigns it to the Rúnicas storm beast", () => {
    const image = readImage(ARPG_ASSET_MANIFEST.enemies["raiju-enemy"].path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    expect(width).toBe(1254);
    expect(height).toBe(1254);
    expect(Math.floor(width / RAIJU_ENEMY_FRAME_SIZE)).toBe(4);
    expect(Math.floor(height / RAIJU_ENEMY_FRAME_SIZE)).toBe(4);
    expect(width - RAIJU_ENEMY_FRAME_SIZE * 4).toBeLessThan(4);
    expect(height - RAIJU_ENEMY_FRAME_SIZE * 4).toBeLessThan(4);
    expect(image[25]).toBe(6);
    expect(RAIJU_ENEMY_FRAME_SIZE).toBe(CURUPIRA_BOSS_FRAME_SIZE);
    expect(Object.entries(RAIJU_ENEMY_ANIMATIONS).map(([name, row]) => [name, row.row])).toEqual([
      ["idle", 0],
      ["walk", 1],
      ["attack", 2],
      ["defeat", 3],
    ]);
    expect(getArpgEnemyAnimationProfile("raiju-enemy")).toMatchObject({
      path: ARPG_ASSET_MANIFEST.enemies["raiju-enemy"].path,
      frameWidth: RAIJU_ENEMY_FRAME_SIZE,
      scale: 0.22,
    });
    expect(ARPG_DUNGEON_CONFIGS["montanhas-runicas"].enemyAnimations?.stormBeast).toBe("raiju-enemy");
  });
});
