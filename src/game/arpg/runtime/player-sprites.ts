import {DEFAULT_AVATAR_CONFIG,type AvatarConfig} from '@/game/save/local-progress';
import {ARPG_ASSET_MANIFEST,registerArpgSpriteSheetAnimations} from '../assets';
import {getGeneratedLegendSpriteSheet} from './legend-sprite-sheets';
import {FOLKLARD_ART_MANIFEST} from '../art/manifest';
const PLAYER_SHEET = ARPG_ASSET_MANIFEST.player;
export const CARTOGRAPHER_PLAYER_TEXTURE = PLAYER_SHEET.textureKey;
// The avatar sheet is already authored on a strict 3px grid; keep it intact so
// its smallest facial and armor clusters survive at the new in-game scale.
export const CARTOGRAPHER_PLAYER_PIXEL_TEXTURE = PLAYER_SHEET.textureKey;
export const CARTOGRAPHER_PLAYER_FRAME_SIZE = PLAYER_SHEET.frameWidth;
export const CARTOGRAPHER_PLAYER_SCALE = PLAYER_SHEET.scale;


export function createCartographerAvatarSpritesheet(avatar:AvatarConfig=DEFAULT_AVATAR_CONFIG){return getGeneratedLegendSpriteSheet(avatar.legendId)??FOLKLARD_ART_MANIFEST.missingActor.path;}
export function createCartographerAvatarIdleSpritesheet(avatar:AvatarConfig=DEFAULT_AVATAR_CONFIG){return createCartographerAvatarSpritesheet(avatar);}
export type CartographerPlayerAnimation = keyof typeof PLAYER_SHEET.animations;
export type CartographerPlayerAction = Exclude<CartographerPlayerAnimation, "idle" | `walk-${string}`>;

export function registerCartographerPlayerAnimations(scene: import("phaser").Scene) {
  const animations = {
    ...PLAYER_SHEET.animations,
    // Keep the exported idle animation compatible with existing callers while
    // ensuring it is a fixed rest pose instead of a four-frame loop.
    idle: { startFrame: 0, endFrame: 0, frameRate: 1, repeat: 0 },
  };
  registerArpgSpriteSheetAnimations(scene, {
    textureKey: CARTOGRAPHER_PLAYER_PIXEL_TEXTURE,
    animations,
    columns: PLAYER_SHEET.columns,
    keyPrefix: PLAYER_SHEET.animationKeyPrefix!,
  });
}

export function playCartographerPlayerAnimation(
  sprite: import("phaser").GameObjects.Sprite,
  animation: CartographerPlayerAnimation,
  restart = false,
) {
  if (animation === "idle") {
    sprite.anims.stop();
    sprite.setFrame(0);
    return;
  }

  const key = `${PLAYER_SHEET.animationKeyPrefix}-${animation}`;
  if (restart || sprite.anims.currentAnim?.key !== key) sprite.play(key);
}
