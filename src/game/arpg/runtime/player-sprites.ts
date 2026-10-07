import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_ASSET_MANIFEST, registerArpgSpriteSheetAnimations } from "../assets";

const PLAYER_SHEET = ARPG_ASSET_MANIFEST.player;
export const CARTOGRAPHER_PLAYER_TEXTURE = PLAYER_SHEET.textureKey;
// The avatar sheet is already authored on a strict 3px grid; keep it intact so
// its smallest facial and armor clusters survive at the new in-game scale.
export const CARTOGRAPHER_PLAYER_PIXEL_TEXTURE = PLAYER_SHEET.textureKey;
export const CARTOGRAPHER_PLAYER_FRAME_SIZE = PLAYER_SHEET.frameWidth;
export const CARTOGRAPHER_PLAYER_SCALE = PLAYER_SHEET.scale;

const AVATAR_COLORS = {
  skin: { amber: "#d8a16d", copper: "#b9764d", umber: "#694638", rose: "#edb6a2" },
  hair: { braids: "#302119", short: "#43291d", waves: "#563421", mohawk: "#292027" },
  outfit: { traveler: "#47694a", scholar: "#446c76", ranger: "#637340", merchant: "#a25f3b" },
  armor: { none: null, leather: "#9b6841", runic: "#65518d", guardian: "#5c7681" },
  accent: { gold: "#e8b849", emerald: "#4bd199", azure: "#69c5ec", crimson: "#ec6671" },
} as const;

const PIXEL_SIZE = 3;
// The source sheet is large so Phaser can keep the original animation grid,
// but the character art itself is authored on a much smaller pixel grid. At
// the in-game scale, two source cells become one clearly visible pixel cluster.
const ART_PIXEL_BLOCK = 2;
const PIXEL_COLUMNS = CARTOGRAPHER_PLAYER_FRAME_SIZE / PIXEL_SIZE;
const PIXEL_ROWS = CARTOGRAPHER_PLAYER_FRAME_SIZE / PIXEL_SIZE;

type PixelPaint = { fill: string; opacity: number };
type PixelRect = { x: number; y: number; width: number; height: number; paint: PixelPaint };

/** A tiny indexed canvas keeps every edge and animation pose on the same pixel grid. */
function createPixelCanvas() {
  const pixels = new Uint16Array(PIXEL_COLUMNS * PIXEL_ROWS);
  const paints: PixelPaint[] = [{ fill: "#000000", opacity: 0 }];
  const paintIndexes = new Map<string, number>();

  function fillRect(x: number, y: number, width: number, height: number, fill: string, opacity = 1) {
    const key = `${fill}|${opacity}`;
    let paintIndex = paintIndexes.get(key);
    if (paintIndex === undefined) {
      paintIndex = paints.length;
      paintIndexes.set(key, paintIndex);
      paints.push({ fill, opacity });
    }

    const snap = (value: number) => Math.round(value / ART_PIXEL_BLOCK) * ART_PIXEL_BLOCK;
    const left = Math.max(0, Math.min(PIXEL_COLUMNS, snap(x)));
    const top = Math.max(0, Math.min(PIXEL_ROWS, snap(y)));
    const right = Math.min(PIXEL_COLUMNS, Math.max(left + ART_PIXEL_BLOCK, snap(x + width)));
    const bottom = Math.min(PIXEL_ROWS, Math.max(top + ART_PIXEL_BLOCK, snap(y + height)));
    if (right <= left || bottom <= top) return;
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) pixels[py * PIXEL_COLUMNS + px] = paintIndex;
    }
  }

  function toSvgRects() {
    const finished: PixelRect[] = [];
    let active = new Map<string, PixelRect>();

    for (let y = 0; y < PIXEL_ROWS; y += 1) {
      const runs: Array<{ x: number; width: number; paintIndex: number }> = [];
      let x = 0;
      while (x < PIXEL_COLUMNS) {
        const paintIndex = pixels[y * PIXEL_COLUMNS + x];
        if (paintIndex === 0) {
          x += 1;
          continue;
        }
        const start = x;
        while (x < PIXEL_COLUMNS && pixels[y * PIXEL_COLUMNS + x] === paintIndex) x += 1;
        runs.push({ x: start, width: x - start, paintIndex });
      }

      const next = new Map<string, PixelRect>();
      for (const run of runs) {
        const key = `${run.x}:${run.width}:${run.paintIndex}`;
        const prior = active.get(key);
        next.set(key, prior
          ? { ...prior, height: prior.height + 1 }
          : { x: run.x, y, width: run.width, height: 1, paint: paints[run.paintIndex] });
      }
      for (const [key, rect] of active) if (!next.has(key)) finished.push(rect);
      active = next;
    }
    finished.push(...active.values());

    return finished.map(({ x, y, width, height, paint }) => {
      const opacity = paint.opacity === 1 ? "" : ` opacity="${paint.opacity}"`;
      return `<rect x="${x * PIXEL_SIZE}" y="${y * PIXEL_SIZE}" width="${width * PIXEL_SIZE}" height="${height * PIXEL_SIZE}" fill="${paint.fill}"${opacity}/>`;
    }).join("");
  }

  return { fillRect, toSvgRects };
}

const SKIN_HIGHLIGHTS = { amber: "#f0bd83", copper: "#d99467", umber: "#956750", rose: "#ffd0bd" } as const;
const SKIN_SHADOWS = { amber: "#aa714b", copper: "#854d39", umber: "#49332e", rose: "#c77e75" } as const;
const OUTFIT_HIGHLIGHTS = { traveler: "#73905d", scholar: "#6f9ba1", ranger: "#8a9653", merchant: "#cf8351" } as const;
const OUTFIT_SHADOWS = { traveler: "#2e493d", scholar: "#2c4d5b", ranger: "#465232", merchant: "#70442f" } as const;
const ARMOR_HIGHLIGHTS = { leather: "#c58d55", runic: "#9276bd", guardian: "#8daab0" } as const;

function drawCartographerFrame(
  canvas: ReturnType<typeof createPixelCanvas>,
  row: number,
  frame: number,
  avatarConfig: AvatarConfig,
) {
  const { fillRect: rect } = canvas;
  const skin = AVATAR_COLORS.skin[avatarConfig.skin];
  const skinLight = SKIN_HIGHLIGHTS[avatarConfig.skin];
  const skinShade = SKIN_SHADOWS[avatarConfig.skin];
  const hair = AVATAR_COLORS.hair[avatarConfig.hair];
  const outfit = AVATAR_COLORS.outfit[avatarConfig.outfit];
  const outfitLight = OUTFIT_HIGHLIGHTS[avatarConfig.outfit];
  const outfitShade = OUTFIT_SHADOWS[avatarConfig.outfit];
  const armor = AVATAR_COLORS.armor[avatarConfig.armor];
  const armorLight = avatarConfig.armor === "none" ? outfitLight : ARMOR_HIGHLIGHTS[avatarConfig.armor];
  const accent = AVATAR_COLORS.accent[avatarConfig.accent];
  const ink = "#29272b";
  const darkLeather = "#493329";
  const trouser = "#4d3a32";
  const boot = "#302b2c";
  const isWalk = row >= 1 && row <= 4;
  const bob = row === 9 ? [0, -1, 0, -1][frame] : isWalk ? [0, 1, 0, -1][frame] : 0;
  const dodgeShift = row === 7 ? [-4, -2, 2, 4][frame] : 0;
  const hitShift = row === 6 ? [-1, 1, -1, 1][frame] : 0;
  const xShift = dodgeShift + hitShift;
  const yShift = bob;
  const fx = (x: number) => x + xShift;
  const fy = (y: number) => y + yShift;
  const fill = (x: number, y: number, width: number, height: number, color: string, opacity = 1) =>
    rect(fx(x), fy(y), width, height, color, opacity);

  // A compact oval shadow grounds the broad boots without lengthening the body.
  rect(23, 51, 17, 1, "#15221d", 0.5);
  rect(20, 52, 23, 1, "#15221d", 0.4);

  const gait = isWalk ? [-1, 1, 1, -1][frame] : 0;
  const facingBack = row === 2;
  const facingSide = row === 3 || row === 4;
  const armReach = row === 5 ? [0, 1, 2, 1][frame] : 0;
  const armY = row === 6 ? -1 : 0;

  // Short legs and oversized boots give the avatar the compact proportions of
  // a small dungeon adventurer; the stride remains readable in four frames.
  for (const [legX, sign] of [[26 + gait, -1], [36 - gait, 1]] as const) {
    const lift = isWalk && gait !== 0 && sign * gait > 0 ? 1 : 0;
    fill(legX, 37, 7, 8 - lift, ink);
    fill(legX + 1, 38, 5, 5 - lift, trouser);
    fill(legX + 2, 38, 2, 3, "#705346");
    fill(legX - 3, 44 - lift, 13, 7, ink);
    fill(legX - 2, 45 - lift, 10, 4, boot);
    fill(legX - 1, 45 - lift, 5, 2, "#665145");
  }

  // The arms sit behind the jacket. Skill casts use the same chunky proportions
  // and only stretch the hands enough to make each action pose easy to distinguish.
  if (row === 11) {
    fill(18, 28, 9, 12, ink);
    fill(19, 29, 7, 9, armor ?? outfit);
    fill(20, 30, 3, 5, armorLight);
    const handX = [45, 46, 47, 48][frame];
    const handY = [22, 19, 16, 13][frame];
    const armTop = [27, 24, 21, 18][frame];
    fill(38, 28, 9, 9, ink);
    fill(39, 29, 7, 7, armor ?? outfit);
    fill(40, 30, 3, 4, armorLight);
    fill(handX, armTop, 7, 15 - frame, ink);
    fill(handX + 1, armTop + 1, 5, 12 - frame, armor ?? outfit);
    fill(handX + 2, armTop + 2, 2, 7, armorLight);
    fill(handX, handY, 7, 6, ink);
    fill(handX + 1, handY + 1, 5, 4, skin);
  } else if (row === 12) {
    const spread = [0, 2, 4, 5][frame];
    const palmY = [34, 33, 32, 31][frame];
    fill(18 - spread, 29, 11 + spread, 10, ink);
    fill(19 - spread, 30, 9 + spread, 7, armor ?? outfit);
    fill(20 - spread, 31, 3, 4, armorLight);
    fill(36, 29, 11 + spread, 10, ink);
    fill(37, 30, 9 + spread, 7, armor ?? outfit);
    fill(38, 31, 3, 4, armorLight);
    for (const handX of [15 - spread, 43 + spread]) {
      fill(handX, palmY, 7, 6, ink);
      fill(handX + 1, palmY + 1, 5, 4, skin);
    }
  } else if (row === 8) {
    // Interact reads as a single raised greeting hand beside the oversized head.
    fill(18, 27, 9, 12, ink);
    fill(19, 28, 7, 9, armor ?? outfit);
    fill(20, 29, 3, 5, armorLight);
    fill(38, 27, 9, 7, ink);
    fill(39, 28, 7, 5, armor ?? outfit);
    fill(44, 22, 8, 9, ink);
    fill(45, 23, 6, 7, armor ?? outfit);
    fill(45, 17, 8, 7, ink);
    fill(46, 18, 6, 5, skin);
    fill(47, 18, 3, 2, skinLight);
  } else if (row === 9) {
    // Victory lifts both compact arms above the shoulders so the pose reads at a glance.
    fill(17, 27, 10, 8, ink);
    fill(18, 28, 8, 6, armor ?? outfit);
    fill(11, 20, 9, 10, ink);
    fill(12, 21, 7, 8, armor ?? outfit);
    fill(5, 14, 9, 8, ink);
    fill(6, 15, 7, 6, skin);
    fill(7, 15, 4, 3, skinLight);
    fill(37, 27, 10, 8, ink);
    fill(38, 28, 8, 6, armor ?? outfit);
    fill(42, 20, 9, 10, ink);
    fill(43, 21, 7, 8, armor ?? outfit);
    fill(47, 14, 9, 8, ink);
    fill(48, 15, 7, 6, skin);
    fill(49, 15, 4, 3, skinLight);
  } else {
    fill(18 - armReach, 28 + armY, 9, 12, ink);
    fill(19 - armReach, 29 + armY, 7, 9, armor ?? outfit);
    fill(20 - armReach, 30 + armY, 3, 5, armorLight);
    fill(37 + armReach, 28 + armY, 9, 12, ink);
    fill(38 + armReach, 29 + armY, 7, 9, armor ?? outfit);
    fill(39 + armReach, 30 + armY, 3, 5, armorLight);
    fill(18 - armReach, 38 + armY, 9, 6, ink);
    fill(19 - armReach, 39 + armY, 7, 4, skin);
    fill(20 - armReach, 39 + armY, 3, 2, skinLight);
    fill(37 + armReach, 38 + armY, 9, 6, ink);
    fill(38 + armReach, 39 + armY, 7, 4, skin);
    fill(39 + armReach, 39 + armY, 3, 2, skinLight);
  }

  // A wide, short jacket and a bold map pouch make the hero read as a compact
  // adventurer while keeping the original Folklard cartographer identity.
  fill(19, 25, 25, 19, ink);
  fill(17, 27, 29, 9, ink);
  fill(21, 28, 21, 13, outfit);
  fill(22, 27, 19, 3, outfitLight);
  fill(22, 31, 5, 7, outfitLight);
  fill(37, 31, 3, 7, outfitShade);
  fill(27, 31, 3, 6, outfitShade);
  fill(34, 31, 3, 6, outfitLight);
  fill(22, 39, 19, 4, darkLeather);
  fill(23, 39, 17, 2, accent);
  fill(30, 38, 5, 5, ink);
  fill(31, 39, 3, 2, accent);
  fill(39, 34, 7, 8, ink);
  fill(40, 35, 5, 6, "#9a6943");
  fill(41, 36, 3, 3, "#efd093");
  fill(21, 42, 21, 2, outfitShade);
  fill(29, 28, 6, 10, accent);
  fill(30, 29, 4, 6, outfitLight);

  // Armor changes the chest silhouette while leaving the chosen clothing and colors visible.
  if (avatarConfig.armor === "leather") {
    fill(18, 27, 11, 8, ink);
    fill(19, 28, 9, 6, "#9b6841");
    fill(34, 27, 11, 8, ink);
    fill(35, 28, 9, 6, "#9b6841");
    fill(24, 31, 17, 3, "#9b6841");
    fill(25, 32, 3, 6, "#c58d55");
    fill(36, 32, 3, 6, darkLeather);
  } else if (avatarConfig.armor === "runic") {
    fill(21, 27, 21, 14, ink);
    fill(22, 28, 19, 11, armor!);
    fill(23, 29, 5, 8, armorLight);
    fill(36, 29, 3, 8, "#443958");
    fill(29, 30, 7, 7, accent);
    fill(30, 31, 5, 5, "#332e4b");
    fill(31, 32, 3, 3, accent);
  } else if (avatarConfig.armor === "guardian") {
    fill(16, 27, 13, 10, ink);
    fill(17, 28, 11, 8, armor!);
    fill(18, 28, 6, 3, armorLight);
    fill(34, 27, 13, 10, ink);
    fill(35, 28, 11, 8, armor!);
    fill(40, 28, 5, 3, armorLight);
    fill(21, 28, 21, 13, "#354953");
    fill(23, 29, 17, 10, armor!);
    fill(24, 30, 5, 6, armorLight);
    fill(36, 30, 3, 6, "#475a62");
    fill(29, 31, 7, 6, accent);
    fill(30, 32, 5, 4, "#314550");
  }

  // A nearly hidden neck lets the helmet-sized head sit directly on the broad
  // shoulder line, reinforcing the three-quarter top-down chibi proportions.
  fill(27, 22, 10, 7, ink);
  fill(28, 23, 8, 5, skinShade);
  fill(29, 23, 6, 3, skin);
  fill(21, 25, 21, 5, ink);
  fill(22, 26, 19, 3, accent);
  fill(29, 27, 6, 3, outfitLight);

  // The large, stepped head/cap is the main silhouette: over two fifths of the
  // visible height, with broad cheek pixels that stay readable in motion.
  const headWidths = [8, 16, 22, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 28, 26, 24, 22, 18, 14, 8];
  for (let index = 0; index < headWidths.length; index += 1) {
    const width = headWidths[index];
    fill(32 - Math.floor(width / 2), 3 + index, width, 1, ink);
  }

  if (facingBack) {
    fill(20, 9, 24, 15, hair);
    fill(23, 7, 18, 5, hair);
    fill(21, 19, 4, 7, hair);
    fill(39, 19, 4, 7, hair);
    fill(26, 11, 4, 3, "#6c4f46");
    fill(34, 13, 4, 3, "#6c4f46");
  } else {
    // Face is deliberately simple and offset like a three-quarter view, with
    // no tiny illustrative marks that disappear at game scale.
    fill(22, 11, 20, 13, skin);
    fill(23, 10, 18, 2, skin);
    fill(23, 23, 18, 2, skinShade);
    fill(18, 15, 5, 5, skinShade);
    fill(20, 15, 3, 4, skin);
    fill(41, 15, 5, 5, skinShade);
    fill(41, 15, 3, 4, skin);
    fill(24, 12, 5, 3, skinLight);
    if (facingSide) {
      fill(24, 17, 3, 3, ink);
      fill(25, 17, 1, 1, "#f4e2b7");
      fill(28, 21, 3, 2, skinShade);
    } else {
      fill(27, 17, 3, 3, ink);
      fill(36, 17, 3, 3, ink);
      fill(28, 17, 1, 1, "#f4e2b7");
      fill(37, 17, 1, 1, "#f4e2b7");
      fill(32, 20, 3, 2, skinShade);
      fill(31, 23, 6, 2, "#794e49");
    }
  }

  // The selectable hair stays visible within the enlarged helmet-like head.
  if (avatarConfig.hair === "mohawk") {
    fill(25, 7, 14, 5, hair);
    fill(28, 3, 8, 7, hair);
    fill(29, 1, 6, 5, hair);
    fill(31, 1, 3, 3, accent);
    fill(29, 11, 4, 2, "#6c4f46");
  } else if (avatarConfig.hair === "waves") {
    fill(23, 7, 18, 5, hair);
    fill(20, 10, 24, 5, hair);
    fill(18, 13, 5, 9, hair);
    fill(41, 13, 5, 9, hair);
    fill(19, 19, 4, 7, hair);
    fill(40, 19, 4, 7, hair);
    fill(25, 11, 5, 3, "#755039");
  } else {
    fill(23, 7, 18, 5, hair);
    fill(20, 10, 24, 4, hair);
    fill(22, 12, 6, 3, hair);
    fill(36, 12, 6, 3, hair);
    if (avatarConfig.hair === "braids") {
      fill(18, 13, 5, 11, hair);
      fill(41, 13, 5, 11, hair);
      fill(17, 18, 5, 8, hair);
      fill(42, 18, 5, 8, hair);
      fill(17, 21, 5, 3, accent);
      fill(42, 21, 5, 3, accent);
      fill(18, 24, 4, 3, hair);
      fill(42, 24, 4, 3, hair);
    } else {
      fill(22, 13, 6, 3, hair);
      fill(36, 13, 6, 3, hair);
    }
  }

  if (row === 5) {
    // A stepped slash makes the weapon thrust readable without fixing a weapon type.
    fill(47 + armReach, 33, 8, 3, ink);
    fill(49 + armReach, 32, 5, 2, accent);
    fill(52 + armReach, 31, 4, 2, "#fff0ad");
    fill(45 + armReach, 37, 4, 2, darkLeather);
    fill(48 + armReach, 35, 2, 4, ink);
  }
  if (row === 8) {
    fill(51, 17, 2, 2, accent);
    fill(53, 15, 2, 4, "#fff0ad");
  }
  if (row === 9) {
    fill(8, 14, 2, 3, accent);
    fill(53, 14, 2, 3, "#fff0ad");
  }
  if (row === 11) {
    const handX = [45, 46, 47, 48][frame];
    const sparkY = [18, 15, 12, 9][frame];
    fill(handX + 2, sparkY, 3, 2, accent);
    fill(handX + 3, sparkY - 2, 1, 1, "#fff0ad");
    fill(handX - 2, sparkY + 3, 1, 2, accent);
  }
  if (row === 12) {
    const spread = [0, 2, 4, 5][frame];
    const pulse = [0, 1, 2, 1][frame];
    fill(10 - spread - pulse, 35, 2, 4, accent);
    fill(13 - spread - pulse, 32, 2, 2, "#d2fff0");
    fill(51 + spread + pulse, 35, 2, 4, accent);
    fill(48 + spread + pulse, 32, 2, 2, "#d2fff0");
    fill(28, 52 + pulse, 3, 2, accent);
    fill(32, 53 + pulse, 3, 2, "#d2fff0");
  }
}

function fitChibiSilhouette(content: string) {
  const center = CARTOGRAPHER_PLAYER_FRAME_SIZE / 2;
  const scaleX = 1.18;
  const scaleY = 0.85;
  const offsetX = center * (1 - scaleX);
  const offsetY = center * (1 - scaleY);
  return `<g transform="translate(${offsetX} ${offsetY}) scale(${scaleX} ${scaleY})">${content}</g>`;
}

/** Returns the animated Phaser spritesheet for a configured player avatar. */
export function createCartographerAvatarSpritesheet(avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG) {
  const frames = Array.from({ length: PLAYER_SHEET.frameCount }, (_, frameIndex) => {
    const column = frameIndex % PLAYER_SHEET.columns;
    const row = Math.floor(frameIndex / PLAYER_SHEET.columns);
    const canvas = createPixelCanvas();
    drawCartographerFrame(canvas, row, column, avatarConfig);
    const pose = canvas.toSvgRects();
    const transform = row === 10
      ? "rotate(90 " + CARTOGRAPHER_PLAYER_FRAME_SIZE / 2 + " " + CARTOGRAPHER_PLAYER_FRAME_SIZE / 2 + ")"
      : row === 4
        ? "translate(" + CARTOGRAPHER_PLAYER_FRAME_SIZE + " 0) scale(-1 1)"
        : "";
    const content = fitChibiSilhouette(transform ? "<g transform=\"" + transform + "\">" + pose + "</g>" : pose);
    return "<g transform=\"translate(" + column * CARTOGRAPHER_PLAYER_FRAME_SIZE + " " + row * CARTOGRAPHER_PLAYER_FRAME_SIZE + ")\">" + content + "</g>";
  }).join("");

  const sheetWidth = CARTOGRAPHER_PLAYER_FRAME_SIZE * PLAYER_SHEET.columns;
  const sheetHeight = CARTOGRAPHER_PLAYER_FRAME_SIZE * PLAYER_SHEET.rows;
  const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + sheetWidth + "\" height=\"" + sheetHeight
    + "\" viewBox=\"0 0 " + sheetWidth + " " + sheetHeight + "\" shape-rendering=\"crispEdges\">" + frames + "</svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/** Returns a compact four-frame idle strip for UI portraits and previews. */
export function createCartographerAvatarIdleSpritesheet(avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG) {
  const frames = Array.from({ length: PLAYER_SHEET.columns }, (_, column) => {
    const canvas = createPixelCanvas();
    drawCartographerFrame(canvas, 0, column, avatarConfig);
    return `<g transform="translate(${column * CARTOGRAPHER_PLAYER_FRAME_SIZE} 0)">${fitChibiSilhouette(canvas.toSvgRects())}</g>`;
  }).join("");

  const sheetWidth = CARTOGRAPHER_PLAYER_FRAME_SIZE * PLAYER_SHEET.columns;
  const sheetHeight = CARTOGRAPHER_PLAYER_FRAME_SIZE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}" shape-rendering="crispEdges">${frames}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

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
