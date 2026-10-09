/** Original 32px actor drawings. Every rectangle is one intentional pixel cluster. */
export const FOLKLARD_PIXEL_ACTORS = [
  "curupira", "iara", "boto", "amarok", "raiju", "mapinguari", "kappa", "kelpie",
  "ahuizotl", "ratatoskr", "carbunclo", "alicanto", "yeti", "sprout",
  "blacksmith", "merchant", "archivist", "bestiaryKeeper",
] as const;
export type FolklardPixelActorId = typeof FOLKLARD_PIXEL_ACTORS[number];
export type PixelCluster = Readonly<{ x: number; y: number; width: number; height: number; color: string }>;
type Painter = { rect(x: number, y: number, width: number, height: number, color: string): void };
type Palette = Readonly<{ dark: string; main: string; light: string; accent: string; skin: string; shade: string }>;
const INK = "#221f2c";
const WHITE = "#fff1ce";
const WATER = "#68d8d1";
const PALETTES: Record<FolklardPixelActorId, Palette> = {
  curupira: { dark: "#663b32", main: "#ca7244", light: "#efaa65", accent: "#ef5035", skin: "#c77f4e", shade: "#497047" },
  iara: { dark: "#233d66", main: "#3264a4", light: "#68b5c9", accent: WATER, skin: "#cb8759", shade: "#a95f42" },
  boto: { dark: "#873f61", main: "#c9758a", light: "#e9abb0", accent: "#e9c57b", skin: "#d68b83", shade: "#597587" },
  amarok: { dark: "#374450", main: "#637681", light: "#a1b6bb", accent: "#a5e0cf", skin: "#81989f", shade: "#4b5c69" },
  raiju: { dark: "#54607d", main: "#9eabb9", light: "#d7e2d6", accent: "#e9c65a", skin: "#c0ced1", shade: "#7589a0" },
  mapinguari: { dark: "#493635", main: "#7b543f", light: "#af8152", accent: "#d4b468", skin: "#a2734f", shade: "#604237" },
  kappa: { dark: "#315952", main: "#598f71", light: "#92ba88", accent: WATER, skin: "#83aa78", shade: "#967447" },
  kelpie: { dark: "#253b50", main: "#426376", light: "#7897a1", accent: WATER, skin: "#638590", shade: "#304858" },
  ahuizotl: { dark: "#4d3940", main: "#826052", light: "#b68b68", accent: WATER, skin: "#bb9474", shade: "#63473f" },
  ratatoskr: { dark: "#744233", main: "#b77443", light: "#e2ac69", accent: "#97b56a", skin: "#edc085", shade: "#965b39" },
  carbunclo: { dark: "#703945", main: "#ac5d5a", light: "#db9776", accent: WATER, skin: "#e7b991", shade: "#87484d" },
  alicanto: { dark: "#725333", main: "#bd944c", light: "#ead18a", accent: "#f3e2a6", skin: "#d6b76c", shade: "#99713c" },
  yeti: { dark: "#637d93", main: "#aec8d0", light: "#e2e5d5", accent: "#8ac5d5", skin: "#7e9fab", shade: "#89aaba" },
  sprout: { dark: "#375944", main: "#6b954d", light: "#a6bf6a", accent: "#dfc982", skin: "#8fae63", shade: "#517646" },
  blacksmith: { dark: "#643d37", main: "#ae6744", light: "#d39557", accent: "#e6c171", skin: "#c78c61", shade: "#65727b" },
  merchant: { dark: "#3d5141", main: "#67834f", light: "#9bab67", accent: "#e6c171", skin: "#c78c61", shade: "#795743" },
  archivist: { dark: "#354562", main: "#657a97", light: "#9aabb6", accent: "#e6c171", skin: "#d9ac82", shade: "#9d9482" },
  bestiaryKeeper: { dark: "#34483e", main: "#5b7961", light: "#8eac81", accent: "#dab77a", skin: "#b78058", shade: "#775647" },
};

function outlined(p: Painter, x: number, y: number, w: number, h: number, color: string) {
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
function shadow(p: Painter, width = 19) { p.rect(16 - Math.floor(width / 2), 29, width, 1, INK); }
function eye(p: Painter, x: number, y: number, blink: boolean) {
  p.rect(x, y, 2, blink ? 1 : 3, INK);
  if (!blink) p.rect(x, y, 1, 1, WHITE);
}
function impact(p: Painter, d: Palette, row: number, frame: number) {
  if (row === 4) {
    p.rect(3 + frame, 9, 2, 1, WHITE); p.rect(5 + frame, 7, 1, 2, d.accent);
    p.rect(26 - frame, 12, 2, 1, WHITE);
  }
}
function waterArc(p: Painter, frame: number) {
  const x = [21, 23, 25, 23][frame];
  p.rect(x, 12, 2, 2, WATER); p.rect(x + 2, 14, 2, 5, WATER);
  p.rect(x, 19, 2, 2, WATER); p.rect(x + 1, 14, 1, 2, WHITE);
  p.rect(5 + frame, 23, 2, 1, WATER);
}

function curupira(p: Painter, d: Palette, row: number, frame: number) {
  const walk = row === 1;
  const bob = walk ? [0, -1, 0, -1][frame] : row === 0 ? [0, 0, -1, 0][frame] : row === 4 ? [0, -1, 0, 1][frame] : 0;
  shadow(p, 18);
  if (row === 5 && frame > 1) {
    outlined(p, 5, 24, 16, 4, d.skin); p.rect(11, 23, 8, 4, d.shade);
    outlined(p, 20, 20, 8, 8, d.skin); p.rect(20, 19, 8, 3, d.accent);
    p.rect(22, 24, 3, 1, INK); p.rect(3, 25, 6, 2, d.skin); return;
  }
  const fall = row === 5 ? frame + 1 : 0;
  const stride = walk ? [-2, 0, 2, 0][frame] : 0;
  // Both ankles have their heel on the right and their toes on the left.
  for (const [legX, lift] of [[14 + stride, walk && frame === 2 ? 1 : 0], [21 - stride, walk && frame === 0 ? 1 : 0]]) {
    outlined(p, legX, 23 - lift, 3, 5, d.skin);
    p.rect(legX - 4, 27 - lift, 7, 2, INK);
    p.rect(legX - 3, 27 - lift, 5, 1, d.light);
  }
  outlined(p, 13, 14 + bob + fall, 9, 10 - fall, d.skin);
  p.rect(12, 21 + bob + fall, 11, 3, d.shade);
  p.rect(13, 22 + bob + fall, 2, 3, d.shade); p.rect(18, 22 + bob + fall, 3, 3, d.shade);
  p.rect(14, 21 + bob + fall, 7, 1, "#87a75a");
  const reach = row === 2 ? [0, 3, 5, 1][frame] : row === 3 ? [1, 3, 2, 0][frame] : walk ? [1, 0, -1, 0][frame] : 0;
  outlined(p, 9, 16 + bob + fall, 5, 7, d.skin);
  outlined(p, 20, 16 + bob + fall, 5 + reach, 4, d.skin);
  outlined(p, 11, 5 + bob + fall, 13, 12, d.skin);
  p.rect(10, 4 + bob + fall, 14, 5, INK); p.rect(9, 5 + bob + fall, 13, 4, d.accent);
  p.rect(7, 7 + bob + fall, 7, 5, d.accent); p.rect(8, 3 + bob + fall, 3, 3, d.accent);
  p.rect(13, 2 + bob + fall, 3, 5, d.accent); p.rect(18, 2 + bob + fall, 3, 5, d.accent);
  p.rect(12, 5 + bob + fall, 6, 2, "#ff9151");
  p.rect(21, 11 + bob + fall, 4, 2, d.skin); eye(p, 20, 9 + bob + fall, row === 0 && frame === 2 || row === 4);
  p.rect(18, 14 + bob + fall, 3, 1, d.dark);
  if (row === 3) {
    for (const [x, y] of [[25, 11], [27, 15], [23, 6], [7, 20]]) {
      p.rect(x + frame % 2, y - frame % 2, 2, 2, d.shade); p.rect(x, y, 1, 1, "#87a75a");
    }
  }
}

function iara(p: Painter, d: Palette, row: number, frame: number) {
  const bob = row === 1 ? [0, -1, 0, 1][frame] : row === 0 ? [0, 0, -1, 0][frame] : 0;
  const fall = row === 5 ? [0, 4, 8, 9][frame] : 0;
  const hair = row === 1 ? [0, 1, 2, 1][frame] : frame % 2;
  shadow(p, 23);
  if (row === 5 && frame > 1) {
    outlined(p, 9, 23, 17, 6, d.main); outlined(p, 4, 25, 9, 4, d.light);
    p.rect(5, 26, 5, 1, WATER); outlined(p, 22, 20, 8, 8, d.skin);
    p.rect(16 - frame % 2, 23, 9, 4, d.dark); p.rect(10 - frame % 2, 25, 9, 2, d.main);
    p.rect(24, 24, 3, 1, INK); p.rect(23, 20, 6, 2, d.dark); return;
  }
  // One fish tail; no human legs or feet appear in any action, including defeat.
  outlined(p, 14, 21 + Math.min(fall, 2), 10, 6, d.main);
  p.rect(11, 25, 10, 3, d.dark); outlined(p, 4, 24 + bob, 10, 5, d.light);
  p.rect(2, 23 + bob, 4, 2, INK); p.rect(3, 24 + bob, 5, 1, WATER);
  p.rect(6, 27 + bob, 7, 2, WATER); p.rect(15, 23 + Math.min(fall, 2), 4, 1, d.light);
  outlined(p, 13, 13 + fall, 9, Math.max(4, 10 - fall), d.skin);
  p.rect(13, 17 + fall, 8, 2, d.accent);
  const reach = row === 2 || row === 3 ? [0, 3, 5, 1][frame] : 0;
  outlined(p, 9, 14 + fall, 5, 7, d.skin); outlined(p, 20, (row === 3 ? 12 : 15) + fall, 5 + reach, 4, d.skin);
  // Hair is drawn behind the face in clear staggered ribbon clusters.
  p.rect(8 - hair, 7 + fall, 11, 14, INK); p.rect(9 - hair, 8 + fall, 9, 12, d.dark);
  p.rect(5 - hair, 12 + fall, 5, 10, INK); p.rect(6 - hair, 13 + fall, 4, 8, d.main);
  p.rect(3 - hair, 17 + fall, 4, 6, d.dark);
  outlined(p, 12, 4 + fall, 13, 12, d.skin);
  p.rect(10, 3 + fall, 14, 6, INK); p.rect(11, 4 + fall, 12, 4, d.dark);
  p.rect(13, 4 + fall, 6, 2, d.main); p.rect(11, 7 + fall, 3, 6, d.dark);
  p.rect(21, 10 + fall, 5, 2, d.skin);
  eye(p, 21, 8 + fall, row === 5 || row === 0 && frame === 2);
  p.rect(19, 13 + fall, 3, 1, d.shade);
  p.rect(10, 7 + fall, 3, 3, d.accent); p.rect(11, 7 + fall, 1, 1, WHITE);
  if (row === 2) waterArc(p, frame);
  if (row === 3) {
    p.rect(5 + frame % 2, 21, 20, 1, WATER); p.rect(6 + frame % 2, 22, 18, 1, d.light);
    p.rect(5 + frame % 2, 17, 1, 4, WATER); p.rect(25 - frame % 2, 17, 1, 4, WATER);
    p.rect(10 + frame, 25, 2, 1, WHITE); p.rect(19 - frame, 27, 2, 1, WATER);
    p.rect(24, 6 + frame % 2, 2, 2, WATER); p.rect(6, 9 - frame % 2, 2, 2, d.light);
  }
}

function boto(p: Painter, d: Palette, row: number, frame: number) {
  const bob = row === 1 ? [0, -1, 0, -1][frame] : frame === 2 && row === 0 ? -1 : 0;
  const stride = row === 1 ? [-1, 0, 1, 0][frame] : 0;
  shadow(p);
  if (row === 5 && frame > 1) {
    outlined(p, 7, 23, 19, 5, d.light); outlined(p, 22, 21, 7, 7, d.skin);
    p.rect(24, 25, 3, 1, INK); p.rect(2 + frame, 25, 9, 2, d.accent); return;
  }
  const fall = row === 5 ? frame * 3 : 0;
  outlined(p, 12 + stride, 23, 4, 6, d.dark); outlined(p, 19 - stride, 23, 4, 6, d.dark);
  p.rect(12 + stride, 28, 6, 1, INK); p.rect(19 - stride, 28, 6, 1, INK);
  outlined(p, 11, 15 + bob + fall, 13, 10 - fall, d.light);
  p.rect(16, 17 + bob + fall, 4, 6, WHITE); p.rect(17, 18 + bob + fall, 2, 3, d.dark);
  const reach = row === 2 || row === 3 ? [0, 3, 5, 1][frame] : 0;
  outlined(p, 8, 16 + bob + fall, 5, 8, d.light); outlined(p, 22, 16 + bob + fall, Math.min(9, 5 + reach), 4, d.light);
  p.rect(6 + frame % 2, 23, 6, 4, d.main); p.rect(4 + frame % 2, 25, 5, 2, d.light);
  outlined(p, 12, 6 + bob + fall, 12, 12, d.skin);
  // Short dolphin muzzle and pink tail reveal the elegant human disguise.
  p.rect(22, 11 + bob + fall, 7, 4, INK); p.rect(23, 12 + bob + fall, 6, 2, d.light);
  eye(p, 20, 9 + bob + fall, row === 0 && frame === 2 || row === 4);
  p.rect(9, 5 + bob + fall, 18, 3, INK); p.rect(10, 6 + bob + fall, 17, 1, WHITE);
  outlined(p, 12, 2 + bob + fall, 12, 5, WHITE); p.rect(13, 4 + bob + fall, 10, 1, d.accent);
  if (row === 2) waterArc(p, frame);
  if (row === 3) {
    const x = 25 + frame % 2;
    outlined(p, x, 10 - frame % 2, 5, 5, WATER);
    p.rect(x + 1, 11 - frame % 2, 1, 1, WHITE);
    p.rect(7 + frame, 12, 2, 2, d.accent); p.rect(6 + frame, 15, 1, 2, d.light);
    p.rect(18, 25, 5, 1, WATER); p.rect(16, 26, 4, 1, WATER);
  }
}

function quadruped(p: Painter, actor: FolklardPixelActorId, d: Palette, row: number, frame: number) {
  const wolf = actor === "amarok";
  const thunder = actor === "raiju";
  const horse = actor === "kelpie";
  const handTail = actor === "ahuizotl";
  const jewel = actor === "carbunclo";
  const bob = row === 1 ? [0, -1, 0, -1][frame] : row === 0 && frame === 2 ? -1 : 0;
  const stride = row === 1 ? [-2, 0, 2, 0][frame] : 0;
  const crouch = row === 5 ? [0, 2, 5, 6][frame] : 0;
  const low = jewel ? 2 : thunder ? 1 : 0;
  const y = 16 + low + bob + crouch;
  shadow(p, 26);
  if (row !== 5 || frame < 2) {
    for (const [x, dx] of [[10, stride], [13, -stride], [21, -stride], [24, stride]]) {
      outlined(p, x + dx, 22 + low, 3, 7 - low, d.shade);
      p.rect(x + dx, 28, horse ? 3 : 4, 1, horse ? d.accent : d.light);
    }
  }
  outlined(p, 8, y, horse ? 16 : jewel ? 14 : 17, jewel ? 7 : 8, d.main);
  p.rect(10, y + 1, horse ? 10 : 12, 2, d.light); p.rect(11, y + 6, 12, 1, d.dark);
  if (wolf) {
    outlined(p, 18, y - 3, 7, 10, d.main);
    p.rect(18, y - 3, 2, 3, d.light); p.rect(20, y - 4, 2, 3, d.main);
    p.rect(17, y + 4, 3, 3, d.light); p.rect(23, 23, 4, 5, d.main);
  }
  const tail = row === 1 ? [0, 1, 2, 1][frame] : frame % 2;
  if (handTail) {
    p.rect(2, y - 5, 3, 11, INK); p.rect(3, y - 4, 1, 9, d.light);
    outlined(p, 1, y - 8 - tail, 6, 5, d.skin);
    p.rect(1, y - 10 - tail, 1, 3, d.light); p.rect(3, y - 11 - tail, 1, 4, d.light);
    p.rect(5, y - 10 - tail, 1, 3, d.light); p.rect(6, y - 7 - tail, 2, 1, d.skin);
    p.rect(4, y + 3, 6, 3, INK); p.rect(4, y + 4, 6, 1, d.main);
  } else if (thunder) {
    p.rect(2, y - 5 + tail, 3, 4, INK); p.rect(3, y - 4 + tail, 5, 3, d.light);
    p.rect(5, y - 1 + tail, 4, 3, d.light); p.rect(3, y - 4 + tail, 1, 2, d.accent);
  } else if (horse) {
    p.rect(3, y - 2 + tail, 6, 3, INK); p.rect(2, y + tail, 5, 6, d.dark);
    p.rect(2, y + 5 + tail, 2, Math.min(4, 30 - (y + 5 + tail)), d.accent);
  } else if (jewel) {
    outlined(p, 4, y + 2, 6, 4, d.light);
  } else {
    p.rect(3, y - 3 + tail, 7, 4, INK); p.rect(4, y - 2 + tail, 5, 2, d.main);
    p.rect(2, y - 5 + tail, 4, 3, INK); p.rect(3, y - 4 + tail, 2, 2, d.light);
  }
  const headY = (horse ? 7 : wolf ? 10 : jewel ? 13 : thunder ? 13 : 11) + Math.min(crouch, 9) + bob;
  if (horse) {
    outlined(p, 20, headY + 3, 6, 12 - Math.min(crouch, 4), d.main);
    p.rect(19, headY + 3, 3, 11 - Math.min(crouch, 4), d.dark);
    p.rect(18, headY + 7, 2, 6, d.accent);
  }
  outlined(p, horse ? 21 : 19, headY, horse ? 8 : 10, horse ? 9 : 11, d.main);
  const jaw = row === 2 ? [0, 1, 3, 1][frame] : 0;
  p.rect(25, headY + 4, jewel ? 4 : 6, 4 + jaw, INK); p.rect(26, headY + 5, jewel ? 3 : 5, 2 + jaw, d.light);
  p.rect(29, headY + 4, 2, 2, INK); eye(p, 25, headY + 2, row === 5 && frame > 1 || row === 0 && frame === 2);
  p.rect(20, headY - 3, 3, 5, INK); p.rect(21, headY - 2, 1, 3, d.shade);
  if (wolf || thunder) { p.rect(25, headY - 3, 3, 5, INK); p.rect(26, headY - 2, 1, 3, d.light); }
  if (wolf) { p.rect(19, headY + 8, 6, 4, d.light); p.rect(21, headY + 11, 2, 3, d.light); }
  if (jewel) {
    p.rect(22, headY - 2, 5, 6, INK); p.rect(23, headY - 1, 3, 4, d.accent);
    p.rect(24, headY - 1, 1, 2, WHITE); p.rect(16, y + 3, 2, 2, d.skin);
    p.rect(19, headY - 5, 3, 7, INK); p.rect(20, headY - 4, 1, 5, d.light);
  }
  if (row === 3) {
    if (thunder) {
      const x = 26 + frame % 2;
      p.rect(x, 4, 2, 5, d.accent); p.rect(x - 2, 8, 3, 2, WHITE); p.rect(x - 2, 10, 2, 4, d.accent);
      p.rect(7, 24 - frame % 2, 2, 2, d.accent);
    } else if (jewel) {
      p.rect(17 + frame, 6, 2, 2, d.accent); p.rect(27, 8 - frame % 2, 2, 2, WHITE);
    } else if (wolf) {
      p.rect(25, 5 - frame % 2, 1, 4, d.accent); p.rect(28, 7 - frame % 2, 1, 4, WHITE);
      p.rect(12 + frame, 26, 2, 1, d.accent);
    } else waterArc(p, frame);
  }
}

function giant(p: Painter, actor: FolklardPixelActorId, d: Palette, row: number, frame: number) {
  const yeti = actor === "yeti";
  const bob = row === 1 ? [0, -1, 0, 1][frame] : row === 0 && frame === 2 ? -1 : 0;
  const stride = row === 1 ? [-1, 0, 1, 0][frame] : 0;
  const fall = row === 5 ? [0, 3, 7, 8][frame] : 0;
  shadow(p, 26);
  if (row === 5 && frame > 1) {
    outlined(p, 4, 23, 23, 6, d.main); p.rect(8, 24, 15, 2, d.light);
    outlined(p, 21, 20, 9, 8, d.main); p.rect(24, 24, 3, 1, INK); return;
  }
  outlined(p, 9 + stride, 23, 6, 6, d.shade); outlined(p, 19 - stride, 23, 6, 6, d.shade);
  p.rect(8 + stride, 28, 7, 1, d.light); p.rect(18 - stride, 28, 7, 1, d.light);
  outlined(p, 7, 12 + bob + fall, 20, 14 - fall, d.main);
  p.rect(10, 14 + bob + fall, 14, 3, d.light); p.rect(8, 20 + bob, 3, 4, d.shade);
  const arm = row === 2 ? [2, -4, -6, 1][frame] : row === 3 ? [-2, -3, -2, 0][frame] : row === 1 ? [-stride, 0, stride, 0][frame] : 0;
  outlined(p, 2, 13 + bob + arm + fall, 8, 12 - fall, d.main);
  outlined(p, 25, 13 + bob - arm + fall, 6, 12 - fall, d.main);
  p.rect(3, 22 + bob + arm, 6, 2, d.light); p.rect(26, 22 + bob - arm, 4, 2, d.light);
  outlined(p, 10, 4 + bob + fall, 15, 12, d.main);
  p.rect(11, 4 + bob + fall, 3, 4, d.light); p.rect(21, 3 + bob + fall, 3, 4, d.light);
  if (yeti) {
    p.rect(8, 13 + bob, 3, 4, d.light); p.rect(23, 13 + bob, 3, 4, d.light);
    p.rect(10, 16 + bob, 2, 4, d.light); p.rect(23, 17 + bob, 2, 3, d.light);
    p.rect(14, 8 + bob + fall, 8, 6, d.skin);
    eye(p, 14, 9 + bob + fall, row === 0 && frame === 2 || row === 4);
    eye(p, 20, 9 + bob + fall, row === 0 && frame === 2 || row === 4);
    p.rect(16, 13 + bob + fall, 4, 1, INK); p.rect(13, 5 + bob + fall, 9, 2, d.light);
  } else {
    outlined(p, 14, 7 + bob + fall, 8, 6, d.accent); eye(p, 17, 8 + bob + fall, row === 0 && frame === 2 || row === 4);
    p.rect(12, 18 + bob + fall, 11, 6 - fall, INK); p.rect(14, 20 + bob + fall, 7, 3 - fall, d.dark);
    p.rect(13, 18 + bob + fall, 2, 2, WHITE); p.rect(18, 18 + bob + fall, 2, 2, WHITE);
    p.rect(15, 23 + bob, 5, 1, d.skin);
  }
  if (row === 3 || row === 2 && frame === 2) {
    p.rect(3 + frame, 27, 3, 2, d.accent); p.rect(25 - frame, 26, 3, 2, d.accent);
    p.rect(6 + frame, 25, 1, 2, WHITE); p.rect(27 - frame, 24, 1, 2, d.light);
  }
}

function kappa(p: Painter, d: Palette, row: number, frame: number) {
  const bob = row === 1 ? [0, -1, 0, -1][frame] : row === 0 && frame === 2 ? -1 : 0;
  shadow(p, 21);
  if (row === 5 && frame > 1) {
    outlined(p, 7, 21, 19, 8, d.shade); p.rect(10, 23, 7, 3, d.dark);
    outlined(p, 21, 23, 8, 5, d.skin); p.rect(24, 25, 3, 1, INK); return;
  }
  const stride = row === 1 ? [-1, 0, 1, 0][frame] : 0;
  outlined(p, 12 + stride, 23, 5, 6, d.main); outlined(p, 21 - stride, 23, 5, 6, d.main);
  // Shell sits behind the head and torso, rather than recoloring a humanoid body.
  outlined(p, 5, 12 + bob, 13, 14, d.shade); p.rect(7, 15 + bob, 6, 7, d.dark);
  p.rect(8, 14 + bob, 7, 1, d.light); p.rect(12, 15 + bob, 1, 8, INK);
  outlined(p, 15, 14 + bob, 10, 12, d.main);
  const reach = row === 2 || row === 3 ? [0, 3, 5, 0][frame] : 0;
  outlined(p, 21, 16 + bob, 5 + reach, 4, d.skin);
  outlined(p, 14, 6 + bob, 13, 11, d.skin);
  p.rect(24, 11 + bob, 6, 3, INK); p.rect(25, 12 + bob, 5, 1, d.shade);
  eye(p, 23, 8 + bob, row === 0 && frame === 2 || row === 4);
  p.rect(13, 5 + bob, 14, 3, INK); p.rect(14, 5 + bob, 12, 1, d.shade);
  p.rect(16, 4 + bob, 8, 2, WATER); p.rect(18, 4 + bob, 3, 1, WHITE);
  if (row === 3) waterArc(p, frame);
}

function ratatoskr(p: Painter, d: Palette, row: number, frame: number) {
  const bob = row === 1 ? [0, -2, 0, -1][frame] : row === 0 && frame === 2 ? -1 : 0;
  shadow(p, 23);
  if (row === 5 && frame > 1) {
    outlined(p, 5, 22, 17, 7, d.main); outlined(p, 21, 21, 8, 7, d.light); p.rect(24, 24, 2, 1, INK); return;
  }
  const sway = frame % 2;
  outlined(p, 3 + sway, 7 + bob, 11, 17, d.main);
  p.rect(4 + sway, 9 + bob, 8, 11, d.light); p.rect(8 + sway, 11 + bob, 5, 10, d.shade);
  p.rect(5 + sway, 8 + bob, 5, 2, d.skin);
  outlined(p, 14, 17 + bob, 10, 10, d.main); p.rect(17, 20 + bob, 5, 5, d.skin);
  outlined(p, 14, 25 + bob, 5, 4, d.main); outlined(p, 20, 25 + bob, 6, 4, d.main);
  outlined(p, 13, 7 + bob, 13, 12, d.main); p.rect(21, 13 + bob, 8, 4, INK); p.rect(22, 14 + bob, 6, 2, d.skin);
  p.rect(14, 3 + bob, 3, 6, INK); p.rect(15, 4 + bob, 1, 4, d.light);
  p.rect(21, 4 + bob, 3, 5, INK); p.rect(22, 5 + bob, 1, 3, d.light);
  eye(p, 22, 10 + bob, row === 0 && frame === 2 || row === 4);
  const reach = row === 2 || row === 3 ? [0, 2, 4, 0][frame] : 0;
  outlined(p, 20, (row === 3 ? 17 : 20) + bob, 5 + reach, 4, d.main);
  if (row === 2 || row === 3) {
    outlined(p, 25 + frame % 2, 16 - frame, 4, 4, d.light); p.rect(25 + frame % 2, 16 - frame, 4, 1, d.dark);
    p.rect(8 + frame, 25, 2, 1, d.accent);
    if (row === 3) { p.rect(7 + frame, 4, 2, 2, d.accent); p.rect(27 - frame, 6, 2, 2, d.light); }
  }
}

function alicanto(p: Painter, d: Palette, row: number, frame: number) {
  const flap = row === 1 || row === 3 ? [0, -3, -1, 2][frame] : row === 2 ? [0, -2, -4, 0][frame] : 0;
  shadow(p, 22);
  if (row === 5 && frame > 1) {
    outlined(p, 6, 23, 18, 6, d.main); p.rect(5, 22, 13, 2, d.light);
    outlined(p, 21, 22, 8, 5, d.light); p.rect(25, 24, 2, 1, INK); return;
  }
  p.rect(14, 24, 2, 5, INK); p.rect(21, 24, 2, 5, INK);
  p.rect(12, 28, 5, 1, d.accent); p.rect(19, 28, 5, 1, d.accent);
  outlined(p, 12, 14, 12, 12, d.main); p.rect(17, 17, 5, 7, d.light);
  p.rect(4, 20, 10, 4, INK); p.rect(5, 21, 9, 2, d.shade); p.rect(2, 22, 9, 3, INK);
  outlined(p, 4, 12 + flap, 13, 8, d.main); p.rect(5, 13 + flap, 9, 2, d.light);
  p.rect(3, 17 + flap, 11, 2, INK); p.rect(4, 17 + flap, 8, 1, d.accent);
  outlined(p, 17, 7, 11, 12, d.main); p.rect(18, 9, 8, 3, d.light);
  p.rect(25, 13, 6, 4, INK); p.rect(26, 14, 5, 2, d.accent);
  p.rect(18, 4, 3, 5, INK); p.rect(19, 5, 1, 3, d.accent); p.rect(22, 5, 3, 3, d.main);
  eye(p, 24, 10, row === 0 && frame === 2 || row === 4);
  if (row === 3) {
    p.rect(26 + frame % 2, 6, 2, 3, d.accent); p.rect(28, 4 + frame % 2, 1, 2, WHITE);
    p.rect(7 + frame, 26, 2, 2, d.light);
  }
}

function sprout(p: Painter, d: Palette, row: number, frame: number) {
  const bob = row === 1 ? [0, -2, 0, -1][frame] : row === 0 && frame === 2 ? -1 : 0;
  shadow(p, 18);
  if (row === 5 && frame > 1) {
    outlined(p, 6, 23, 20, 6, d.main); p.rect(11, 25, 3, 1, INK); p.rect(20, 25, 3, 1, INK);
    p.rect(13, 20, 7, 3, d.dark); p.rect(17, 18, 8, 3, d.light); return;
  }
  outlined(p, 9, 15 + bob, 15, 13, d.main); p.rect(11, 17 + bob, 10, 4, d.light);
  p.rect(10, 26 + bob, 5, 3, d.dark); p.rect(19, 26 + bob, 5, 3, d.dark);
  p.rect(15, 10 + bob, 3, 7, d.dark); p.rect(9, 9 + bob, 8, 4, INK);
  p.rect(10, 10 + bob, 6, 2, d.light); p.rect(17, 7 + bob, 8, 5, INK); p.rect(18, 8 + bob, 6, 3, d.main);
  eye(p, 13, 20 + bob, row === 5 || row === 0 && frame === 2); eye(p, 20, 20 + bob, row === 5 || row === 0 && frame === 2);
  if (row === 2 || row === 3) { p.rect(4 + frame, 22, 6, 3, d.main); p.rect(23, 21 - frame, 6, 3, d.light); }
}

function npc(p: Painter, actor: FolklardPixelActorId, d: Palette, row: number, frame: number) {
  const smith = actor === "blacksmith";
  const scholar = actor === "archivist";
  const bob = row === 1 ? [0, -1, 0, -1][frame] : row === 0 && frame === 2 ? -1 : 0;
  shadow(p);
  outlined(p, 12, 23, 4, 6, d.dark); outlined(p, 20, 23, 4, 6, d.dark);
  outlined(p, 10, 14 + bob, 14, 12, d.main); p.rect(12, 15 + bob, 10, 2, d.light);
  outlined(p, 7, 15 + bob, 5, 9, d.main); outlined(p, 22, 15 + bob, 5, 9, d.main);
  p.rect(8, 22 + bob, 3, 2, d.skin); p.rect(23, 22 + bob, 3, 2, d.skin);
  outlined(p, 12, 5 + bob, 13, 12, d.skin); p.rect(12, 6 + bob, 4, 6, d.dark);
  eye(p, 21, 9 + bob, row === 0 && frame === 2); p.rect(20, 14 + bob, 3, row === 3 ? 1 + frame % 2 : 1, INK);
  if (smith) {
    p.rect(14, 18 + bob, 8, 7, d.dark); p.rect(15, 19 + bob, 6, 1, d.accent);
    p.rect(11, 4 + bob, 15, 4, INK); p.rect(13, 3 + bob, 10, 4, d.dark);
    const hammerY = row === 2 ? [17, 9, 7, 18][frame] : 18;
    p.rect(26, hammerY, 2, 8, d.shade); outlined(p, 24, hammerY - 2, 7, 4, d.light);
    if (row === 2 && frame === 3) { p.rect(25, 25, 2, 1, d.accent); p.rect(29, 24, 1, 2, WHITE); }
  } else if (scholar) {
    p.rect(11, 4 + bob, 15, 3, INK); p.rect(13, 2 + bob, 11, 4, d.main);
    p.rect(19, 8 + bob, 6, 4, INK); p.rect(20, 9 + bob, 4, 2, d.light);
    outlined(p, 23, row === 2 ? 13 + frame % 2 : 20, 7, 7, d.accent);
    p.rect(24, row === 2 ? 14 + frame % 2 : 21, 1, 5, WHITE);
  } else if (actor === "merchant") {
    p.rect(8, 5 + bob, 21, 3, INK); p.rect(10, 6 + bob, 18, 1, d.accent);
    outlined(p, 13, 2 + bob, 12, 5, d.main);
    outlined(p, 23, row === 2 ? 13 + frame % 2 : 20, 7, 7, d.accent);
    p.rect(26, row === 2 ? 15 + frame % 2 : 22, 2, 2, d.dark);
  } else {
    p.rect(11, 5 + bob, 16, 4, d.dark); p.rect(11, 8 + bob, 4, 5, d.dark);
    outlined(p, 22, row === 2 ? 13 + frame % 2 : 20, 8, 7, d.light);
    p.rect(24, row === 2 ? 15 + frame % 2 : 22, 4, 2, d.main);
  }
}

/** The same pure drawings feed the checked-in sheets and Phaser's offline fallback. */
export function drawFolklardPixelActorFrame(p: Painter, actor: string, row: number, frame: number): boolean {
  if (!Object.hasOwn(PALETTES, actor)) return false;
  const id = actor as FolklardPixelActorId;
  const d = PALETTES[id];
  switch (id) {
    case "curupira": curupira(p, d, row, frame); break;
    case "iara": iara(p, d, row, frame); break;
    case "boto": boto(p, d, row, frame); break;
    case "amarok": case "raiju": case "kelpie": case "ahuizotl": case "carbunclo": quadruped(p, id, d, row, frame); break;
    case "mapinguari": case "yeti": giant(p, id, d, row, frame); break;
    case "kappa": kappa(p, d, row, frame); break;
    case "ratatoskr": ratatoskr(p, d, row, frame); break;
    case "alicanto": alicanto(p, d, row, frame); break;
    case "sprout": sprout(p, d, row, frame); break;
    default: npc(p, id, d, row, frame);
  }
  impact(p, d, row, frame);
  return true;
}

export function getFolklardPixelActorFrame(actor: FolklardPixelActorId, row: number, frame: number): readonly PixelCluster[] {
  if (!Number.isInteger(row) || row < 0 || row > 5 || !Number.isInteger(frame) || frame < 0 || frame > 3) throw new RangeError("Invalid actor animation frame");
  const pixels: PixelCluster[] = [];
  const found = drawFolklardPixelActorFrame({ rect(x, y, width, height, color) {
    const left = Math.max(0, Math.min(32, Math.round(x)));
    const top = Math.max(0, Math.min(32, Math.round(y)));
    const right = Math.min(32, Math.round(x + width));
    const bottom = Math.min(32, Math.round(y + height));
    if (right > left && bottom > top) pixels.push({ x: left, y: top, width: right - left, height: bottom - top, color });
  } }, actor, row, frame);
  if (!found) throw new Error("Unknown folklore actor");
  return pixels;
}
