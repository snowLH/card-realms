import { ARPG_ASSET_MANIFEST, registerArpgSpriteSheetAnimations } from "../assets";
import { getPixelArtTextureKey } from "./pixel-art-sheet";

const ENEMY_ASSETS = ARPG_ASSET_MANIFEST.enemies;

export const CURUPIRA_BOSS_TEXTURE = ENEMY_ASSETS["curupira-boss"].textureKey;
export const CURUPIRA_BOSS_FRAME_SIZE = ENEMY_ASSETS["curupira-boss"].frameWidth;
export const AMAROK_BOSS_TEXTURE = ENEMY_ASSETS["amarok-boss"].textureKey;
export const AMAROK_BOSS_FRAME_SIZE = ENEMY_ASSETS["amarok-boss"].frameWidth;
export const IARA_BOSS_TEXTURE = ENEMY_ASSETS["iara-boss"].textureKey;
export const IARA_BOSS_FRAME_SIZE = ENEMY_ASSETS["iara-boss"].frameWidth;
export const SPROUT_ENEMY_TEXTURE = ENEMY_ASSETS["sprout-enemy"].textureKey;
export const SPROUT_ENEMY_FRAME_SIZE = ENEMY_ASSETS["sprout-enemy"].frameWidth;
export const BOTO_ENEMY_TEXTURE = ENEMY_ASSETS["boto-enemy"].textureKey;
export const BOTO_ENEMY_FRAME_SIZE = ENEMY_ASSETS["boto-enemy"].frameWidth;
export const RAIJU_ENEMY_TEXTURE = ENEMY_ASSETS["raiju-enemy"].textureKey;
export const RAIJU_ENEMY_FRAME_SIZE = ENEMY_ASSETS["raiju-enemy"].frameWidth;

export const CURUPIRA_BOSS_ANIMATIONS = ENEMY_ASSETS["curupira-boss"].animations;
export const AMAROK_BOSS_ANIMATIONS = ENEMY_ASSETS["amarok-boss"].animations;
export const IARA_BOSS_ANIMATIONS = ENEMY_ASSETS["iara-boss"].animations;
export const SPROUT_ENEMY_ANIMATIONS = ENEMY_ASSETS["sprout-enemy"].animations;
export const BOTO_ENEMY_ANIMATIONS = ENEMY_ASSETS["boto-enemy"].animations;
export const RAIJU_ENEMY_ANIMATIONS = ENEMY_ASSETS["raiju-enemy"].animations;

export type ArpgEnemyAnimation =
  | keyof typeof CURUPIRA_BOSS_ANIMATIONS
  | keyof typeof ENEMY_ASSETS["shade-enemy"]["animations"];
export const ARPG_ENEMY_ANIMATION_PROFILES = ENEMY_ASSETS;

export type ArpgEnemyAnimationProfile = keyof typeof ARPG_ENEMY_ANIMATION_PROFILES;

export function getArpgEnemyAnimationProfile(profile: ArpgEnemyAnimationProfile) {
  return ARPG_ENEMY_ANIMATION_PROFILES[profile];
}

export function isArpgEnemyAnimationProfile(value: unknown): value is ArpgEnemyAnimationProfile {
  return typeof value === "string" && Object.hasOwn(ARPG_ENEMY_ANIMATION_PROFILES, value);
}

export function registerArpgEnemyAnimations(
  scene: import("phaser").Scene,
  profile: ArpgEnemyAnimationProfile,
) {
  const profileDefinition = getArpgEnemyAnimationProfile(profile);
  registerArpgSpriteSheetAnimations(scene, {
    textureKey: getPixelArtTextureKey(profileDefinition.textureKey),
    animations: profileDefinition.animations,
    columns: profileDefinition.columns,
    keyPrefix: profileDefinition.animationKeyPrefix!,
  });
}

export function playArpgEnemyAnimation(
  sprite: import("phaser").GameObjects.Sprite,
  profile: ArpgEnemyAnimationProfile,
  animation: ArpgEnemyAnimation,
  restart = false,
) {
  const key = `${getArpgEnemyAnimationProfile(profile).animationKeyPrefix}-${animation}`;
  if (restart || sprite.anims.currentAnim?.key !== key) sprite.play(key);
}
