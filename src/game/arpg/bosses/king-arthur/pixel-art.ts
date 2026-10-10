import type { BossPose } from "../boss-intro-controller";

export type ArthurPixel = { x: number; y: number; width: number; height: number; color: number };
/** Original TEMPORARY 64px chibi drawing; no borrowed sprites. Keep scars after restoration. */
export function arthurPixels(pose: BossPose, restored = false, frame = 0): ArthurPixel[] {
  const pixels: ArthurPixel[] = [];
  const rect = (x: number, y: number, width: number, height: number, color: number) => pixels.push({ x, y, width, height, color });
  const ink = 0x202332, gold = restored ? 0xdab877 : 0x9d865e;
  const blue = restored ? 0x46698c : 0x364456, silver = restored ? 0xa9bbc7 : 0x73848f;
  const skin = restored ? 0xc89e88 : 0x8f847f, light = restored ? 0xe2e5dd : 0xaab0ab;
  const seated = pose === "seated" || pose === "hand" || pose === "head" || pose === "eyes";
  const kneeling = pose === "kneeling" || pose === "reaching";
  const slump = pose === "stumble" ? 4 : seated ? 2 : kneeling ? 8 : 0;
  const head = slump + (pose === "seated" ? 3 : 0);
  // Stepped royal shroud, clean silhouette and short armored limbs.
  rect(16, 27 + slump, 31, 25 - slump, ink);
  rect(13, 31 + slump, 7, 21 - slump, ink); rect(46, 31 + slump, 7, 19 - slump, ink);
  rect(16, 30 + slump, 4, 20 - slump, blue); rect(46, 31 + slump, 4, 15 - slump, blue);
  rect(19, 31 + slump, 28, 23 - slump, blue); rect(22, 48, 4, 7, gold);
  rect(39, 47, 5, 7, gold); rect(16, 49, 5, 4, 0x344259); rect(46, 46, 6, 5, 0x344259);
  const footY = seated || kneeling ? 50 : 54;
  rect(22, footY, 9, 7, ink); rect(35, footY, 10, 7, ink);
  rect(23, footY, 6, 4, silver); rect(36, footY, 7, 4, silver);
  rect(21, footY + 5, 10, 2, silver); rect(35, footY + 5, 11, 2, silver);
  rect(22, 31 + slump, 24, 17, ink); rect(25, 33 + slump, 19, 13 - slump, silver);
  rect(26, 33 + slump, 7, 3, light); rect(38, 34 + slump, 4, 8 - slump, 0x53647c);
  rect(28, 43, 14, 4, gold); rect(32, 43, 5, 3, ink);
  // Dents and old fracture stay in both palettes.
  rect(33, 35 + slump, 2, 4, ink); rect(35, 39 + slump, 2, 2, ink); rect(30, 40 + slump, 3, 1, ink);
  rect(16, 29 + slump, 11, 9, ink); rect(17, 30 + slump, 8, 6, silver);
  rect(41, 29 + slump, 11, 9, ink); rect(42, 31 + slump, 8, 5, silver);
  rect(18, 31 + slump, 5, 2, light); rect(45, 31 + slump, 3, 2, gold);
  const reach = pose === "reaching" || pose === "draw" ? 7 : pose === "hand" ? 2 : 0;
  rect(17, 38 + slump, 7, 10 - slump, ink); rect(18, 39 + slump, 5, 6, silver);
  rect(43, 38 + slump, 6 + reach, 7, ink); rect(44, 39 + slump, 4 + reach, 5, silver);
  rect(18, 45 + slump, 5, 4, skin); rect(46 + reach, 42 + slump, 4, 4, skin);
  // Large recognizable human face with a damaged crown and short beard.
  rect(20, 8 + head, 26, 23, ink); rect(18, 12 + head, 30, 15, ink);
  rect(21, 10 + head, 23, 18, skin); rect(20, 13 + head, 26, 11, skin);
  rect(20, 8 + head, 25, 6, 0x63584e); rect(20, 13 + head, 4, 7, 0x63584e);
  rect(42, 12 + head, 3, 8, 0x63584e); rect(22, 25 + head, 20, 4, 0x63584e);
  rect(26, 28 + head, 13, 3, 0x63584e); rect(30, 24 + head, 7, 2, ink);
  rect(24, 16 + head, 5, 4, ink); rect(36, 16 + head, 5, 4, ink);
  rect(25, 17 + head, 2, pose === "seated" ? 1 : 2, restored ? light : 0xa8a0dc);
  rect(37, 17 + head, 2, pose === "seated" ? 1 : 2, restored ? light : 0xa8a0dc);
  rect(33, 20 + head, 2, 2, 0x735e5a); rect(39, 21 + head, 3, 1, 0x675459);
  rect(40, 22 + head, 1, 3, 0x675459);
  rect(19, 7 + head, 27, 4, ink); rect(20, 7 + head, 24, 2, gold);
  rect(20, 3 + head, 4, 5, gold); rect(29, 1 + head, 4, 6, gold);
  rect(39, 4 + head, 4, 4, gold); rect(30, 4 + head, 2, 2, 0x608ea4);
  // Excalibur is a boss prop. The playable hero keeps the floating-weapon system.
  if (!restored && !kneeling) {
    const swordY = pose === "draw" || pose === "ready" ? 17 : 36;
    rect(53, swordY, 4, 39, ink); rect(54, swordY + 1, 2, 30, light);
    rect(49, swordY + 31, 12, 3, gold); rect(54, swordY + 34, 2, 6, blue);
  }
  if (!restored) {
    rect(26, 34 + slump, 3, 6, 0x494258); rect(36, 40, 4, 3, 0x494258);
    rect(11 + frame % 3, 20, 2, 2, 0x8d849d); rect(50, 9 + frame % 4, 2, 3, 0x635e77);
  }
  return pixels;
}
export function createArthurSpriteSvg() {
  const frames: string[] = [];
  for (let row = 0; row < 6; row++) for (let frame = 0; frame < 4; frame++) {
    const pose: BossPose = row === 5 ? "kneeling" : row === 2 || row === 3 ? (["ready", "hand", "draw", "head"] as const)[frame] : "restored";
    const bob = row === 1 ? frame % 2 : 0;
    const rects = arthurPixels(pose, true, frame).map((p) =>
      '<rect x="' + (Math.round(p.x * 0.85) + 4 + frame * 64) + '" y="' + (Math.round(p.y * 0.85) + 6 + row * 64 - bob) + '" width="' + Math.max(1, Math.round(p.width * 0.85)) + '" height="' + Math.max(1, Math.round(p.height * 0.85)) + '" fill="#' + p.color.toString(16).padStart(6, "0") + '"/>');
    frames.push(...rects);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 256 384" shape-rendering="crispEdges">' + frames.join("") + '</svg>';
}
