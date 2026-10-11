import type { Scene } from "phaser";
import type { BossEncounterSnapshot } from "./boss-encounter-controller";
import { ArthurPresentation } from "./king-arthur/presentation";
import { ARTHUR_CHARACTER_ART } from "./king-arthur/art";
import { RegionalForgottenLegendPresentation } from "./regional-presentation";
import { REGIONAL_BOSS_ART, type RegionalForgottenLegendId } from "./regional-art";
import { bossRoomArtAssets } from "./boss-room-art";

export type BossPresentation = {
  update(encounter: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string): void;
  destroy(): void;
};
type Factory = (scene: Scene, origin: { x: number; y: number }, width: number, height: number) => BossPresentation;

const regional = (bossId: RegionalForgottenLegendId) => ({
  create: ((scene: Scene, origin: { x: number; y: number }, width: number) =>
    new RegionalForgottenLegendPresentation(scene, bossId, origin, width)) satisfies Factory,
  sheets: [{ key: REGIONAL_BOSS_ART[bossId].key, path: REGIONAL_BOSS_ART[bossId].path }],
});

const presentations: Readonly<Record<string, { create: Factory; sheets: readonly { key: string; path: string }[] }>> = {
  "ancestral-curupira": regional("ancestral-curupira"),
  "deep-iara": regional("deep-iara"),
  "king-arthur": {
    create: (scene, origin, width) => new ArthurPresentation(scene, origin, width),
    sheets: Object.values(ARTHUR_CHARACTER_ART),
  },
};

export function queueBossPresentationAssets(scene: Scene, id: string) {
  for (const asset of bossRoomArtAssets(id)) {
    if (!scene.textures.exists(asset.key)) scene.load.image(asset.key, asset.path);
  }
  for (const sheet of presentations[id]?.sheets ?? []) {
    if (!scene.textures.exists(sheet.key)) {
      scene.load.spritesheet(sheet.key, sheet.path, { frameWidth: 256, frameHeight: 256, endFrame: 23 });
    }
  }
}

export function createBossPresentation(id: string, ...args: Parameters<Factory>) {
  return presentations[id]?.create(...args) ?? null;
}
