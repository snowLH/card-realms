import type { Scene } from "phaser";
import type { NativePixelActorId } from "./native-pixel-actors";

export const GENERATED_SPRITE_FRAME_SIZE = 256;
export const GENERATED_SPRITE_FRAME_COUNT = 24;

// The user's Naturalist reference defines the compact chibi pixel art family.
// v5 sheets share a 64px logical grid and 24 authored poses.
// The rejected 32px v3 studies remain archived. Selection cards, the Guild and
// dungeon actors must use this same catalog to preserve character identity.
const GENERATED_LEGEND_SPRITE_SHEETS: Partial<Record<NativePixelActorId, string>> = {
  "king-arthur": "/art/legend-king-arthur-spritesheet-v5.webp",
  curupira: "/art/legend-curupira-spritesheet-v5.webp",
  iara: "/art/legend-iara-spritesheet-v5.webp",
  boto: "/art/legend-boto-spritesheet-v5.webp",
  kappa: "/art/legend-kappa-spritesheet-v5.webp",
  raiju: "/art/legend-raiju-spritesheet-v5.webp",
  ratatoskr: "/art/legend-ratatoskr-spritesheet-v5.webp",
  mapinguari: "/art/legend-mapinguari-spritesheet-v5.webp",
  sprout: "/art/monster-sprout-enemy-spritesheet-v5.webp",
  amarok: "/art/legend-amarok-spritesheet-v5.webp",
  kelpie: "/art/legend-kelpie-spritesheet-v5.webp",
  ahuizotl: "/art/legend-ahuizotl-spritesheet-v5.webp",
  carbunclo: "/art/legend-carbunclo-spritesheet-v5.webp",
  alicanto: "/art/legend-alicanto-spritesheet-v5.webp",
  yeti: "/art/legend-yeti-spritesheet-v5.webp",
  blacksmith: "/art/guild-blacksmith-spritesheet-v5.webp",
  merchant: "/art/guild-merchant-spritesheet-v5.webp",
  archivist: "/art/guild-archivist-spritesheet-v5.webp",
  bestiaryKeeper: "/art/guild-bestiary-keeper-spritesheet-v5.webp",
};

export function getGeneratedLegendSpriteSheet(actorId: string) {
  return GENERATED_LEGEND_SPRITE_SHEETS[actorId as NativePixelActorId] ?? null;
}

export function queueGeneratedLegendSpriteSheet(
  scene: Scene,
  actorId: string,
  textureKey: string,
) {
  const path = getGeneratedLegendSpriteSheet(actorId);
  if (!path || scene.textures.exists(textureKey)) return false;

  scene.load.spritesheet(textureKey, path, {
    frameWidth: GENERATED_SPRITE_FRAME_SIZE,
    frameHeight: GENERATED_SPRITE_FRAME_SIZE,
    endFrame: GENERATED_SPRITE_FRAME_COUNT - 1,
  });
  return true;
}
