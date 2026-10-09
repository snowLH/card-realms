import {
  ARPG_WEAPON_VISUALS,
  type WeaponVisualDefinition,
  type WeaponVisualDesign,
} from "./weapon-visuals";

type Graphics = import("phaser").GameObjects.Graphics;

const PROJECTILE_TEXTURE_KEYS = [
  "arpg-weapon-projectile-arrow",
  "arpg-weapon-projectile-focus",
] as const;

export const WEAPON_RUNTIME_TEXTURE_KEYS = [
  ...ARPG_WEAPON_VISUALS.map((visual) => visual.textureKey),
  ...PROJECTILE_TEXTURE_KEYS,
] as const;

function rect(graphics: Graphics, x: number, y: number, width: number, height: number, color: number, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillRect(x, y, width, height);
}

function polygon(graphics: Graphics, points: Array<{ x: number; y: number }>, color: number, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillPoints(points, true);
}

function drawGrip(graphics: Graphics, guardColor: number, gripColor: number, gemColor?: number) {
  rect(graphics, 3, 14, 8, 5, 0x211d24);
  rect(graphics, 4, 15, 7, 3, gripColor);
  rect(graphics, 9, 11, 4, 11, 0x211d24);
  rect(graphics, 10, 12, 3, 9, guardColor);
  if (gemColor !== undefined) rect(graphics, 10, 15, 2, 3, gemColor);
}

function drawBow(graphics: Graphics, body: number, highlight: number, stringColor: number, accent: number, recurve = false) {
  const outline = 0x211d24;
  const outer = recurve
    ? [[18, 4], [23, 5], [26, 9], [27, 13], [26, 18], [24, 23], [19, 28]]
    : [[18, 4], [22, 6], [24, 10], [25, 16], [24, 22], [22, 26], [18, 28]];
  for (const [x, y] of outer) rect(graphics, x - 2, y - 2, 5, 5, outline);
  for (const [x, y] of outer) rect(graphics, x - 1, y - 1, 3, 3, body);
  rect(graphics, 18, 4, 2, 24, highlight);
  graphics.lineStyle(1, stringColor, 1);
  graphics.lineBetween(18, 5, 13, 16);
  graphics.lineBetween(13, 16, 18, 27);
  rect(graphics, 5, 15, 18, 3, outline);
  rect(graphics, 6, 16, 17, 1, stringColor);
  polygon(graphics, [{ x: 24, y: 13 }, { x: 30, y: 16 }, { x: 24, y: 19 }], outline);
  polygon(graphics, [{ x: 24, y: 14 }, { x: 28, y: 16 }, { x: 24, y: 18 }], accent);
  rect(graphics, 10, 13, 3, 2, accent);
  rect(graphics, 10, 18, 3, 2, accent);
}

function drawStaff(graphics: Graphics, shaft: number, shaftLight: number, accent: number, head: "orb" | "song" | "thunder") {
  const outline = 0x211d24;
  graphics.lineStyle(6, outline, 1);
  graphics.lineBetween(4, 22, 23, 11);
  graphics.lineStyle(3, shaft, 1);
  graphics.lineBetween(5, 22, 23, 11);
  graphics.lineStyle(1, shaftLight, 1);
  graphics.lineBetween(7, 20, 21, 12);

  if (head === "orb") {
    polygon(graphics, [{ x: 23, y: 4 }, { x: 30, y: 10 }, { x: 24, y: 17 }, { x: 18, y: 10 }], outline);
    polygon(graphics, [{ x: 23, y: 6 }, { x: 28, y: 10 }, { x: 24, y: 15 }, { x: 20, y: 10 }], accent);
    rect(graphics, 23, 8, 3, 3, 0xf3e9ff);
    return;
  }

  if (head === "song") {
    polygon(graphics, [{ x: 24, y: 3 }, { x: 30, y: 7 }, { x: 29, y: 14 }, { x: 24, y: 18 }, { x: 18, y: 14 }, { x: 19, y: 7 }], outline);
    polygon(graphics, [{ x: 24, y: 5 }, { x: 28, y: 8 }, { x: 27, y: 13 }, { x: 24, y: 16 }, { x: 20, y: 13 }, { x: 21, y: 8 }], accent);
    rect(graphics, 23, 7, 3, 7, 0xbff6f0);
    rect(graphics, 28, 4, 2, 3, 0xf0c2dc);
    return;
  }

  polygon(graphics, [
    { x: 22, y: 3 }, { x: 29, y: 3 }, { x: 25, y: 9 }, { x: 30, y: 9 },
    { x: 20, y: 19 }, { x: 23, y: 11 }, { x: 18, y: 11 },
  ], outline);
  polygon(graphics, [
    { x: 23, y: 5 }, { x: 27, y: 5 }, { x: 23, y: 10 }, { x: 27, y: 10 },
    { x: 21, y: 16 }, { x: 24, y: 10 }, { x: 20, y: 10 },
  ], accent);
  rect(graphics, 24, 5, 2, 4, 0xf8f3b2);
}

function drawWeaponDesign(graphics: Graphics, design: WeaponVisualDesign) {
  const outline = 0x211d24;

  switch (design) {
    case "iron-straight":
      drawGrip(graphics, 0xc69c55, 0x725036);
      polygon(graphics, [{ x: 12, y: 12 }, { x: 26, y: 12 }, { x: 31, y: 16 }, { x: 26, y: 20 }, { x: 12, y: 20 }], outline);
      polygon(graphics, [{ x: 13, y: 14 }, { x: 26, y: 14 }, { x: 29, y: 16 }, { x: 26, y: 18 }, { x: 13, y: 18 }], 0xb7c1c4);
      rect(graphics, 15, 14, 11, 2, 0xe8eee8);
      break;
    case "thorn-guardian":
      drawGrip(graphics, 0x98704a, 0x5c3c2e, 0x9fca68);
      polygon(graphics, [{ x: 12, y: 11 }, { x: 18, y: 12 }, { x: 21, y: 9 }, { x: 24, y: 12 }, { x: 31, y: 15 }, { x: 26, y: 20 }, { x: 21, y: 18 }, { x: 17, y: 21 }, { x: 12, y: 19 }], outline);
      polygon(graphics, [{ x: 13, y: 13 }, { x: 19, y: 14 }, { x: 21, y: 12 }, { x: 24, y: 14 }, { x: 28, y: 15 }, { x: 25, y: 18 }, { x: 20, y: 16 }, { x: 17, y: 19 }, { x: 13, y: 17 }], 0x5f924c);
      rect(graphics, 17, 14, 9, 2, 0xa8d56f);
      break;
    case "tide-wave":
      drawGrip(graphics, 0xd0b269, 0x6d4934, 0x74d9e5);
      polygon(graphics, [{ x: 12, y: 12 }, { x: 21, y: 11 }, { x: 27, y: 13 }, { x: 31, y: 16 }, { x: 26, y: 18 }, { x: 20, y: 21 }, { x: 12, y: 19 }], outline);
      polygon(graphics, [{ x: 13, y: 14 }, { x: 21, y: 13 }, { x: 26, y: 15 }, { x: 29, y: 16 }, { x: 25, y: 17 }, { x: 20, y: 19 }, { x: 13, y: 17 }], 0x4ba8b7);
      graphics.lineStyle(2, 0xa9f0e8, 1);
      graphics.lineBetween(15, 15, 25, 16);
      break;
    case "runic-sabre":
      drawGrip(graphics, 0xd4a64e, 0x66442e, 0x78d7e3);
      polygon(graphics, [{ x: 12, y: 13 }, { x: 21, y: 11 }, { x: 27, y: 10 }, { x: 31, y: 13 }, { x: 27, y: 17 }, { x: 20, y: 19 }, { x: 12, y: 19 }], outline);
      polygon(graphics, [{ x: 13, y: 15 }, { x: 21, y: 13 }, { x: 27, y: 12 }, { x: 29, y: 13 }, { x: 26, y: 15 }, { x: 20, y: 17 }, { x: 13, y: 17 }], 0x8ea4b5);
      rect(graphics, 18, 13, 2, 3, 0x77dbe8);
      rect(graphics, 23, 12, 2, 3, 0x77dbe8);
      break;
    case "frostfall-greatsword":
      drawGrip(graphics, 0x8fb5c7, 0x4b5965, 0xd8f7ff);
      polygon(graphics, [{ x: 12, y: 9 }, { x: 24, y: 9 }, { x: 31, y: 16 }, { x: 24, y: 23 }, { x: 12, y: 23 }], outline);
      polygon(graphics, [{ x: 13, y: 11 }, { x: 24, y: 11 }, { x: 29, y: 16 }, { x: 24, y: 21 }, { x: 13, y: 21 }], 0x91c9d9);
      polygon(graphics, [{ x: 15, y: 13 }, { x: 23, y: 13 }, { x: 27, y: 16 }, { x: 23, y: 18 }, { x: 15, y: 18 }], 0xd6f2f5);
      rect(graphics, 18, 10, 3, 12, 0xb7e8ef);
      break;
    case "forest-longbow":
      drawBow(graphics, 0x5d7e42, 0x9cc66c, 0xe7dfc5, 0xb7e07d, false);
      break;
    case "river-recurve":
      drawBow(graphics, 0x477d83, 0x78bec2, 0xe9efe6, 0xa7e2e3, true);
      rect(graphics, 20, 8, 3, 3, 0xcee9dd);
      rect(graphics, 22, 22, 3, 3, 0xcee9dd);
      break;
    case "coral-ward":
      drawBow(graphics, 0x9c5e63, 0xd88a8e, 0xf7e2ce, 0xf0b2a6, true);
      rect(graphics, 21, 5, 3, 4, 0xf1c58d);
      rect(graphics, 24, 23, 4, 3, 0xf1c58d);
      break;
    case "alicanto-mineral":
      drawBow(graphics, 0x7d6544, 0xc6a95e, 0xf4ead1, 0xf3d774, true);
      polygon(graphics, [{ x: 21, y: 5 }, { x: 24, y: 2 }, { x: 27, y: 5 }, { x: 24, y: 8 }], 0xe5c565);
      polygon(graphics, [{ x: 22, y: 24 }, { x: 25, y: 21 }, { x: 28, y: 24 }, { x: 25, y: 27 }], 0xf1df91);
      break;
    case "ritual-orb":
      drawStaff(graphics, 0x6d4b35, 0xa37851, 0xb398e0, "orb");
      break;
    case "iara-song":
      drawStaff(graphics, 0x52757a, 0x77a8a8, 0x72d8d6, "song");
      break;
    case "raiju-thunder":
      drawStaff(graphics, 0x596377, 0x8ca2b8, 0xe8d765, "thunder");
      break;
  }
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
  for (const visual of ARPG_WEAPON_VISUALS) {
    if (scene.textures.exists(visual.textureKey)) continue;
    graphics.clear();
    drawWeaponDesign(graphics, visual.design);
    graphics.generateTexture(visual.textureKey, 32, 32);
  }
  drawProjectileTextures(scene, graphics);
  graphics.destroy();
}

export function getWeaponRuntimeTextureKey(visual: WeaponVisualDefinition) {
  return visual.textureKey;
}
