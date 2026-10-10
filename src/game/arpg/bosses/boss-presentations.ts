import type { Scene } from "phaser";
import type { BossEncounterSnapshot } from "./boss-encounter-controller";
import { ArthurPresentation } from "./king-arthur/presentation";
import { ARTHUR_CHARACTER_ART } from "./king-arthur/art";
export type BossPresentation = { update(encounter: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string): void; destroy(): void };
type Factory = (scene: Scene, origin: { x: number; y: number }, width: number, height: number) => BossPresentation;
const presentations: Readonly<Record<string, { create: Factory; sheets: readonly { key: string; path: string }[] }>> = {
  "king-arthur": {
    create: (scene, origin, width, height) => new ArthurPresentation(scene, origin, width, height),
    sheets: Object.values(ARTHUR_CHARACTER_ART),
  },
};
export function queueBossPresentationAssets(scene: Scene, id: string) {
  for (const sheet of presentations[id]?.sheets ?? []) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.path, { frameWidth: 256, frameHeight: 256, endFrame: 23 });
  }
}
export function createBossPresentation(id: string, ...args: Parameters<Factory>) { return presentations[id]?.create(...args) ?? null; }
