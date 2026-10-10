import type { WeaponVisualDefinition } from "./weapon-visuals";

type Graphics = import("phaser").GameObjects.Graphics;

const PROJECTILE_TEXTURE_KEYS = [
  "arpg-weapon-projectile-arrow",
  "arpg-weapon-projectile-focus",
] as const;

/** Only auxiliary projectile effects are generated at runtime; equipable weapons are external PNG art. */
export const WEAPON_RUNTIME_TEXTURE_KEYS = PROJECTILE_TEXTURE_KEYS;

function rect(graphics: Graphics, x: number, y: number, width: number, height: number, color: number, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillRect(x, y, width, height);
}

function polygon(graphics: Graphics, points: Array<{ x: number; y: number }>, color: number, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillPoints(points, true);
}

function drawProjectileTextures(scene: import("phaser").Scene, graphics: Graphics) {
  if (!scene.textures.exists("arpg-weapon-projectile-arrow")) {
    graphics.clear();
    rect(graphics, 1, 2, 13, 3, 0x2b2324);
    rect(graphics, 2, 3, 12, 1, 0xe9dfc1);
    polygon(graphics, [{ x: 13, y: 0 }, { x: 18, y: 3 }, { x: 13, y: 7 }], 0x2b2324);
    polygon(graphics, [{ x: 14, y: 1 }, { x: 17, y: 3 }, { x: 14, y: 6 }], 0xf2d57e);
    polygon(graphics, [{ x: 3, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 3 }, { x: 0, y: 6 }, { x: 3, y: 5 }], 0x8a6847);
    graphics.generateTexture("arpg-weapon-projectile-arrow", 18, 7);
  }

  if (!scene.textures.exists("arpg-weapon-projectile-focus")) {
    graphics.clear();
    polygon(graphics, [{ x: 6, y: 0 }, { x: 13, y: 6 }, { x: 6, y: 13 }, { x: 0, y: 6 }], 0x2a2430);
    polygon(graphics, [{ x: 6, y: 2 }, { x: 11, y: 6 }, { x: 6, y: 11 }, { x: 2, y: 6 }], 0xffffff);
    rect(graphics, 5, 5, 3, 3, 0xffffff);
    graphics.generateTexture("arpg-weapon-projectile-focus", 13, 13);
  }
}

export function createWeaponRuntimeTextures(scene: import("phaser").Scene) {
  if (WEAPON_RUNTIME_TEXTURE_KEYS.every((key) => scene.textures.exists(key))) return;

  const graphics = scene.add.graphics();
  drawProjectileTextures(scene, graphics);
  graphics.destroy();
}

export function getWeaponRuntimeTextureKey(visual: WeaponVisualDefinition) {
  return visual.textureKey;
}
