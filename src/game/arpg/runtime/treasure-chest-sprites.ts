import { ARPG_ASSET_MANIFEST, registerArpgSpriteSheetAnimations } from "../assets";

const CHEST_SHEET = ARPG_ASSET_MANIFEST.props.treasureChest;
export const TREASURE_CHEST_TEXTURE = CHEST_SHEET.textureKey;
export const TREASURE_CHEST_FRAME_SIZE = CHEST_SHEET.frameWidth;
export const TREASURE_CHEST_DISPLAY_SIZE = CHEST_SHEET.displaySize;
export const TREASURE_CHEST_DISPLAY_SCALE = CHEST_SHEET.scale;
export const TREASURE_CHEST_ASSET_PATH = CHEST_SHEET.path;
export const TREASURE_CHEST_OPEN_ANIMATION_KEY = `${CHEST_SHEET.animationKeyPrefix}-open`;
const CHEST_OPEN_ANIMATION = CHEST_SHEET.animations.open;
export const TREASURE_CHEST_OPEN_FRAMES = Array.from(
  { length: CHEST_OPEN_ANIMATION.endFrame - CHEST_OPEN_ANIMATION.startFrame + 1 },
  (_, index) => CHEST_OPEN_ANIMATION.startFrame + index,
);
export const TREASURE_CHEST_FRAME_BOUNDS: Record<number, { top: number; baseline: number }> = CHEST_SHEET.frameBounds;

export function getTreasureChestFrameBounds(frameIndex: number) {
  return TREASURE_CHEST_FRAME_BOUNDS[frameIndex] ?? TREASURE_CHEST_FRAME_BOUNDS[0];
}

export function alignTreasureChestToGround(sprite: import("phaser").GameObjects.Sprite) {
  const { baseline } = getTreasureChestFrameBounds(Number(sprite.frame.name));
  sprite.setOrigin(0.5, baseline / sprite.frame.height);
}

export function registerTreasureChestAnimation(scene: import("phaser").Scene) {
  registerArpgSpriteSheetAnimations(scene, {
    textureKey: CHEST_SHEET.textureKey,
    animations: CHEST_SHEET.animations,
    keyPrefix: CHEST_SHEET.animationKeyPrefix!,
  });
}
