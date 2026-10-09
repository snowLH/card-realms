import type { Scene } from "phaser";
import type { NativePixelActorId } from "./native-pixel-actors";

export const GENERATED_SPRITE_FRAME_SIZE = 256;
export const GENERATED_SPRITE_FRAME_COUNT = 24;

const GENERATED_LEGEND_SPRITE_SHEETS: Partial<Record<NativePixelActorId, string>> = {
  curupira: "/art/legend-curupira-spritesheet-v3.webp",
  iara: "/art/legend-iara-spritesheet-v3.webp",
  boto: "/art/legend-boto-spritesheet-v3.webp",
  kappa: "/art/legend-kappa-spritesheet-v3.webp",
  raiju: "/art/legend-raiju-spritesheet-v3.webp",
  ratatoskr: "/art/legend-ratatoskr-spritesheet-v3.webp",
  mapinguari: "/art/legend-mapinguari-spritesheet-v3.webp",
  sprout: "/art/monster-sprout-spritesheet-v3.webp",
  amarok: "/art/legend-amarok-spritesheet-v3.webp",
  kelpie: "/art/legend-kelpie-spritesheet-v3.webp",
  ahuizotl: "/art/legend-ahuizotl-spritesheet-v3.webp",
  carbunclo: "/art/legend-carbunclo-spritesheet-v3.webp",
  alicanto: "/art/legend-alicanto-spritesheet-v3.webp",
  yeti: "/art/legend-yeti-spritesheet-v3.webp",
  blacksmith: "/art/guild-blacksmith-spritesheet-v3.webp",
  merchant: "/art/guild-merchant-spritesheet-v3.webp",
  archivist: "/art/guild-archivist-spritesheet-v3.webp",
  bestiaryKeeper: "/art/guild-bestiary-keeper-spritesheet-v3.webp",
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
