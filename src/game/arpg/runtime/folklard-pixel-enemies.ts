import type { PixelCluster } from "./folklard-pixel-actors";

/** Original enemies drawn on a 32px grid, independently of the playable legends. */
export const FOLKLARD_PIXEL_ENEMIES = ["shade", "thorn", "corrupted-guardian", "mapinguari"] as const;
export type FolklardPixelEnemyId = typeof FOLKLARD_PIXEL_ENEMIES[number];
type Painter = { rect(x: number, y: number, width: number, height: number, color: string): void };
const INK = "#221f2c";
const IVORY = "#fff1ce";
const MINT = "#99d5b5";
const GOLD = "#e8bc63";
const BROWN = "#8c6245";
const BARK = "#4d3c38";
const LEAF = "#577e49";
const LEAF_LIGHT = "#a0b76b";
const VIOLET = "#a184b6";

function block(p: Painter, x: number, y: number, w: number, h: number, color: string) {
  if (w >= 6 && h >= 6) {
    p.rect(x + 2, y, w - 4, h, INK);
    p.rect(x + 1, y + 1, w - 2, h - 2, INK);
    p.rect(x, y + 2, w, h - 4, INK);
    p.rect(x + 2, y + 1, w - 4, h - 2, color);
    p.rect(x + 1, y + 2, w - 2, h - 4, color);
  } else {
    p.rect(x, y, w, h, INK);
    if (w > 2 && h > 2) p.rect(x + 1, y + 1, w - 2, h - 2, color);
  }
}
function spark(p: Painter, x: number, y: number, color: string) {
  p.rect(x + 1, y, 1, 3, color); p.rect(x, y + 1, 3, 1, color);
}
function shadow(p: Painter, width: number) {
  p.rect(16 - Math.floor(width / 2), 29, width, 1, INK);
}

function shade(p: Painter, row: number, frame: number) {
  const dark = "#38444f", body = "#587a79", light = "#84aba1";
  const float = row === 1 ? [0, -2, -1, 1][frame] : [0, 0, -1, 0][frame];
  shadow(p, 14);
  if (row === 5) {
    const vanish = [0, 4, 9, 14][frame];
    block(p, 9 + frame, 8 + vanish, 13 - frame * 2, 8 - frame, light);
    p.rect(12 + frame, 10 + vanish, 2, 1, INK);
    p.rect(18 - frame, 10 + vanish, 2, 1, INK);
    for (let i = 0; i < 4; i++) p.rect(5 + i * 6, 26 - (frame + i) % 3 * 2, 2, 1, MINT);
    return;
  }
  // An empty wooden face floats over ribbons of mist; there are no human feet.
  p.rect(11, 10 + float, 11, 14, INK);
  p.rect(9, 14 + float, 15, 9, INK);
  p.rect(7, 17 + float, 19, 5, INK);
  p.rect(12, 11 + float, 9, 13, dark);
  p.rect(10, 15 + float, 13, 7, dark);
  p.rect(8, 18 + float, 17, 3, body);
  p.rect(10, 16 + float, 3, 2, light);
  p.rect(10, 21 + float, 4, 6, body); p.rect(17, 22 + float, 5, 5, dark);
  p.rect(8 - frame % 2, 25 + float, 6, 2, body); p.rect(19 + frame % 2, 25, 5, 2, light);
  const reach = row === 2 ? [0, 2, 5, 1][frame] : row === 3 ? [1, 3, 4, 0][frame] : 0;
  p.rect(5, 14 + float, 5, 3, INK); p.rect(4, 17 + float, 5, 2, body);
  p.rect(22, 13 + float, 4 + reach, 3, INK); p.rect(23, 14 + float, 3 + reach, 1, MINT);
  block(p, 10, 5 + float, 13, 11, light);
  p.rect(12, 6 + float, 4, 7, MINT); p.rect(20, 8 + float, 2, 6, body);
  p.rect(10, 5 + float, 4, 2, dark); p.rect(19, 4 + float, 4, 2, dark);
  p.rect(12, 9 + float, 3, row === 0 && frame === 2 ? 1 : 2, INK);
  p.rect(18, 9 + float, 3, row === 0 && frame === 2 ? 1 : 2, INK);
  p.rect(16, 12 + float, 2, 3, INK);
  if (row === 2) {
    p.rect(26, 16 + float, 2, 4 + frame % 2, light);
    p.rect(23, 20 + float, 4, 1, MINT);
  }
  if (row === 3) {
    block(p, 23, 6 + frame % 2, 6, 6, dark); spark(p, 24, 7 + frame % 2, MINT);
    p.rect(7 + frame, 22, 3, 1, MINT);
  }
}

function thorn(p: Painter, row: number, frame: number) {
  const red = "#ad5d4f", petal = "#d49563";
  const stride = row === 1 ? [-2, 0, 2, 0][frame] : 0;
  shadow(p, 24);
  if (row === 5) {
    const fall = frame * 4;
    block(p, 10, 8 + fall, 14, 7, red);
    p.rect(12, 10 + fall, 5, 2, petal);
    p.rect(5 + frame, 25, 9, 2, LEAF); p.rect(20, 26 - frame % 2, 7, 2, LEAF);
    p.rect(9, 23, 3, 3, BROWN); p.rect(20, 22 + frame % 2, 3, 3, BROWN);
    return;
  }
  // A thorned flower hunts on a tripod of roots; the bud opens to fire seeds.
  p.rect(8 + stride, 24, 5, 4, INK); p.rect(20 - stride, 24, 6, 4, INK);
  p.rect(8 + stride, 25, 4, 2, BROWN); p.rect(21 - stride, 25, 5, 2, BROWN);
  p.rect(15, 21, 4, 8, INK); p.rect(16, 23, 2, 5, BROWN);
  block(p, 12, 15, 10, 11, LEAF);
  p.rect(13, 16, 3, 7, LEAF_LIGHT); p.rect(19, 19, 2, 6, BARK);
  p.rect(10, 20, 4, 2, LEAF); p.rect(9, 19, 2, 2, LEAF_LIGHT);
  p.rect(20, 21, 5, 2, LEAF); p.rect(23, 19, 2, 3, LEAF_LIGHT);
  const reach = row === 2 ? [0, 3, 5, 1][frame] : 0;
  p.rect(5, 16, 9, 3, INK); p.rect(6, 17, 7, 1, LEAF);
  p.rect(3, 13, 3, 5, INK); p.rect(4, 14, 1, 3, LEAF_LIGHT);
  p.rect(20, 15, 5 + reach, 3, INK); p.rect(21, 16, 4 + reach, 1, LEAF_LIGHT);
  p.rect(25 + Math.min(reach, 2), 11, 2, 5, INK);
  p.rect(7, 14, 1, 3, GOLD); p.rect(23, 13, 1, 3, GOLD);
  const opening = row === 3 ? [0, 1, 3, 1][frame] : row === 2 ? 1 : 0;
  block(p, 8 - opening, 6, 7, 11, red); block(p, 20 + opening, 6, 7, 11, red);
  block(p, 12, 3, 12, 7, petal); block(p, 12, 14, 12, 6, red);
  p.rect(9 - opening, 7, 3, 5, petal); p.rect(22 + opening, 7, 3, 4, petal);
  block(p, 13, 8, 10, 9, BARK);
  const blink = row === 0 && frame === 2;
  p.rect(15, 10, 2, blink ? 1 : 2, GOLD); p.rect(20, 10, 2, blink ? 1 : 2, GOLD);
  p.rect(16, 14, 5, row === 3 ? 2 : 1, INK);
  if (row === 3) {
    spark(p, 25, 18 - frame % 2 * 3, LEAF_LIGHT);
    p.rect(6 + frame, 22, 2, 2, GOLD);
  }
}

function guardian(p: Painter, row: number, frame: number) {
  const wood = "#6e5744", light = "#b49362", purpleDark = "#56415d";
  const stride = row === 1 ? [-2, 0, 2, 0][frame] : 0;
  shadow(p, 24);
  if (row === 5) {
    // The stolen core extinguishes as the hollow trunk breaks into root pieces.
    block(p, 9, 16 + frame * 2, 15, 7, wood);
    p.rect(11, 18 + frame * 2, 3, 3, light);
    p.rect(20, 17 + frame * 2, 2, 3, BARK);
    block(p, 4 + frame, 24, 6, 4, BARK); block(p, 24 - frame, 23, 5, 5, BARK);
    if (frame < 3) spark(p, 16, 17 + frame * 2, VIOLET);
    p.rect(8, 25, 2, 3, LEAF); p.rect(24, 26, 2, 2, LEAF_LIGHT);
    return;
  }
  block(p, 9 + stride, 23, 6, 6, wood); block(p, 20 - stride, 23, 6, 6, wood);
  p.rect(10 + stride, 25, 2, 3, light); p.rect(23 - stride, 24, 2, 3, BARK);
  block(p, 10, 12, 15, 14, wood);
  p.rect(11, 14, 3, 10, light); p.rect(21, 14, 3, 10, BARK);
  p.rect(14, 19, 3, 1, BARK); p.rect(17, 23, 3, 1, light);
  const reach = row === 2 ? [0, 1, 4, 2][frame] : 0;
  block(p, 3, 13 + frame % 2, 8, 11, wood);
  p.rect(4, 15, 2, 6, light); p.rect(6, 22, 4, 3, BARK);
  block(p, 23, 12, 5 + Math.min(reach, 2), 10, wood);
  p.rect(24, 13, 2, 6, light);
  if (row === 2) { p.rect(25, 20, 4, 3 + reach, BARK); p.rect(26, 23 + reach, 3, 1, light); }
  // A broken antler mask and a violet fissure separate it from the flower enemies.
  p.rect(8, 3, 3, 9, INK); p.rect(9, 4, 1, 6, wood);
  p.rect(5, 4, 4, 2, BARK); p.rect(23, 2, 3, 9, INK); p.rect(24, 3, 1, 6, light);
  p.rect(25, 5, 4, 2, BARK);
  block(p, 10, 6, 15, 10, wood);
  p.rect(12, 7, 4, 7, light); p.rect(22, 8, 2, 5, BARK);
  p.rect(12, 10, 3, 2, INK); p.rect(20, 10, 3, 2, INK);
  p.rect(13, 10, 2, 1, VIOLET); p.rect(20, 10, 2, 1, VIOLET);
  p.rect(17, 9, 1, 4, BARK); p.rect(16, 14, 4, 1, INK);
  block(p, 15, 16, 6, row === 3 ? 8 : 6, purpleDark);
  spark(p, 16, 17 + frame % 2, VIOLET);
  p.rect(5, 11, 4, 2, LEAF); p.rect(25, 9, 3, 2, LEAF_LIGHT);
  if (row === 3) { spark(p, 26, 23 - frame, VIOLET); spark(p, 5 + frame, 6, VIOLET); }
}

function mapinguari(p: Painter, row: number, frame: number) {
  const fur = "#81543c", light = "#bd8b55", shade = "#573b34", red = "#a44946";
  const step = row === 1 ? [-2, 0, 2, 0][frame] : 0;
  shadow(p, 27);
  if (row === 5) {
    block(p, 5, 20 + frame, 22, 8 - frame % 2, fur);
    block(p, 20, 15 + frame * 2, 8, 8, fur);
    p.rect(22, 18 + frame * 2, 4, 1, INK);
    p.rect(8, 23, 7, 3, shade); p.rect(9, 24, 5, 1, red);
    p.rect(2 + frame, 25, 5, 3, light); p.rect(25, 26, 4, 2, light);
    p.rect(13 + frame, 19 + frame, 4, 1, light);
    return;
  }
  // One forehead eye and the toothed belly-mouth of the forest giant.
  block(p, 8 + step, 23, 7, 6, shade); block(p, 20 - step, 23, 7, 6, shade);
  p.rect(9 + step, 25, 4, 2, fur); p.rect(21 - step, 25, 4, 2, fur);
  for (const x of [9 + step, 12 + step, 21 - step, 24 - step]) p.rect(x, 28, 1, 1, IVORY);
  block(p, 9, 11, 17, 15, fur);
  p.rect(10, 12, 4, 8, light); p.rect(23, 13, 2, 10, shade);
  const reach = row === 2 ? [0, -3, -5, -1][frame] : row === 3 ? -2 : 0;
  block(p, 3, 12 + Math.min(reach, 0), 7, 14 + Math.max(reach, -4), fur);
  p.rect(4, 14 + Math.min(reach, 0), 2, 8, light);
  block(p, 25, 12 + Math.min(reach, 0), 5, 14 + Math.max(reach, -4), fur);
  p.rect(26, 14 + Math.min(reach, 0), 2, 8, shade);
  p.rect(3, 25 + reach, 5, 2, light); p.rect(25, 25 + reach, 4, 2, light);
  block(p, 11, 3, 14, 12, fur);
  p.rect(10, 5, 4, 8, shade); p.rect(21, 4, 4, 8, shade);
  p.rect(13, 2, 4, 3, light); p.rect(18, 2, 4, 3, fur);
  block(p, 15, 5, 7, 7, IVORY);
  p.rect(17, 7, 2, row === 0 && frame === 2 ? 1 : 3, INK);
  p.rect(17, 7, 1, 1, GOLD);
  p.rect(15, 12, 7, 2, shade); p.rect(17, 12, 2, 1, light);
  const opening = row === 3 ? [3, 5, 7, 4][frame] : row === 2 ? 5 : 3;
  block(p, 12, 17, 12, opening + 2, shade);
  p.rect(14, 19, 8, Math.max(1, opening - 1), red);
  for (const x of [14, 17, 20]) p.rect(x, 18, 2, 2, IVORY);
  for (const x of [15, 18, 21]) p.rect(x, 18 + opening, 1, 1, IVORY);
  p.rect(10, 15, 3, 1, light); p.rect(24, 16, 2, 2, light);
  if (row === 2 && frame === 2) { p.rect(3, 5, 3, 1, IVORY); p.rect(27, 6, 2, 1, IVORY); }
  if (row === 3) {
    p.rect(5 + frame % 2, 26, 22, 1, GOLD);
    p.rect(4 + frame % 2, 24, 1, 3, GOLD); p.rect(27 - frame % 2, 24, 1, 3, GOLD);
  }
}

export function getFolklardPixelEnemyFrame(enemy: FolklardPixelEnemyId, row: number, frame: number): PixelCluster[] {
  const clusters: PixelCluster[] = [];
  const recoil = row === 4 ? [-1, 0, 1, 0][frame] : 0;
  const painter: Painter = {
    rect(x, y, width, height, color) {
      // Never bleed into the neighbouring cell, including enlarged attack poses.
      const left = Math.max(1, x + recoil), top = Math.max(1, y);
      const right = Math.min(31, x + recoil + width), bottom = Math.min(31, y + height);
      if (right > left && bottom > top) clusters.push({ x: left, y: top, width: right - left, height: bottom - top, color });
    },
  };
  const renderers = { shade, thorn, "corrupted-guardian": guardian, mapinguari };
  renderers[enemy](painter, row, frame);
  if (row === 4) { spark(painter, 3 + frame, 8, IVORY); spark(painter, 26 - frame, 18, GOLD); }
  return clusters;
}

export function getOriginalPixelEnemyId(profile: string): FolklardPixelEnemyId | null {
  return FOLKLARD_PIXEL_ENEMIES.find((enemy) => `${enemy}-enemy` === profile) ?? null;
}
