import type { Scene } from "phaser";
import { drawFolklardPixelActorFrame } from "./folklard-pixel-actors";

/** Folklard's small, hand-built runtime actor set. */
export const NATIVE_PIXEL_ACTORS = [
  "blacksmith",
  "merchant",
  "archivist",
  "bestiaryKeeper",
  "curupira",
  "amarok",
  "iara",
  "sprout",
  "boto",
  "raiju",
  "mapinguari",
  "kappa",
  "kelpie",
  "ahuizotl",
  "ratatoskr",
  "carbunclo",
  "alicanto",
  "yeti",
] as const;

export type NativePixelActorId = (typeof NATIVE_PIXEL_ACTORS)[number];

export const NATIVE_PIXEL_ACTOR_ANIMATION_ROWS = {
  idle: 0,
  walk: 1,
  attack: 2,
  shoot: 3,
  damage: 4,
  defeat: 5,
} as const;

export type NativePixelActorAnimation = keyof typeof NATIVE_PIXEL_ACTOR_ANIMATION_ROWS;

export const NATIVE_PIXEL_ACTOR_FRAME_COLUMNS = 4;
export const NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE = 4;

/** Every actor uses the same named 4-frame cycles in its six-row sheet. */
export const NATIVE_PIXEL_ACTOR_ANIMATION_MAP = Object.fromEntries(
  NATIVE_PIXEL_ACTORS.map((actor) => [actor, NATIVE_PIXEL_ACTOR_ANIMATION_ROWS]),
) as Readonly<Record<NativePixelActorId, typeof NATIVE_PIXEL_ACTOR_ANIMATION_ROWS>>;

const NATIVE_PIXEL_ACTOR_DATA_URL_CACHE = new Map<string, string>();

const GRID = 32;
// Keep the retained 32×32 grid at native resolution: the one-pixel ink edge and
// short color clusters stay crisp when Phaser scales the actors with nearest-neighbor.
const ACTOR_PIXEL_BLOCK = 1;
const COLUMNS = NATIVE_PIXEL_ACTOR_FRAME_COLUMNS;
const ROWS = Object.keys(NATIVE_PIXEL_ACTOR_ANIMATION_ROWS).length;
const FRAME_COUNT = COLUMNS * ROWS;

export type NativePixelWalkPose = Readonly<{
  stride: -2 | 0 | 2;
  leftLift: 0 | 1 | 2;
  rightLift: 0 | 1 | 2;
  bodyBob: -1 | 0;
}>;

const NATIVE_PIXEL_WALK_CYCLE: readonly NativePixelWalkPose[] = [
  { stride: -2, leftLift: 0, rightLift: 2, bodyBob: 0 },
  { stride: 0, leftLift: 1, rightLift: 1, bodyBob: -1 },
  { stride: 2, leftLift: 2, rightLift: 0, bodyBob: 0 },
  { stride: 0, leftLift: 1, rightLift: 1, bodyBob: -1 },
];

/** A readable four-frame stride with alternating foot lift at the native 32px grid. */
export function getNativePixelWalkPose(frame: number): NativePixelWalkPose {
  const wrappedFrame = ((Math.trunc(frame) % NATIVE_PIXEL_WALK_CYCLE.length) + NATIVE_PIXEL_WALK_CYCLE.length)
    % NATIVE_PIXEL_WALK_CYCLE.length;
  return NATIVE_PIXEL_WALK_CYCLE[wrappedFrame];
}

type ActorKind = "npc" | "curupira" | "amarok" | "iara" | "sprout" | "boto" | "raiju" | "nativeCreature";

type ActorDesign = Readonly<{
  kind: ActorKind;
  ink: string;
  body: string;
  bodyLight: string;
  bodyDark: string;
  face: string;
  hair: string;
  accent: string;
  metal: string;
  eye: string;
}>;

const DESIGNS: Readonly<Record<NativePixelActorId, ActorDesign>> = {
  blacksmith: {
    kind: "npc", ink: "#211b20", body: "#8f4c32", bodyLight: "#c77740", bodyDark: "#58352e",
    face: "#d99b6a", hair: "#30252b", accent: "#f0bd51", metal: "#9fb4b2", eye: "#211b20",
  },
  merchant: {
    kind: "npc", ink: "#20231e", body: "#637346", bodyLight: "#91a35b", bodyDark: "#3e5038",
    face: "#c98d63", hair: "#3e5038", accent: "#e7c05c", metal: "#e7c05c", eye: "#20231e",
  },
  archivist: {
    kind: "npc", ink: "#212329", body: "#4d6178", bodyLight: "#7890a0", bodyDark: "#35475d",
    face: "#dfb995", hair: "#c9c3ae", accent: "#c4b17a", metal: "#c4b17a", eye: "#212329",
  },
  bestiaryKeeper: {
    kind: "npc", ink: "#1e241f", body: "#49684f", bodyLight: "#779365", bodyDark: "#334b3b",
    face: "#ba8158", hair: "#334b3b", accent: "#c6b576", metal: "#779365", eye: "#1e241f",
  },
  curupira: {
    kind: "curupira", ink: "#24201e", body: "#466344", bodyLight: "#789254", bodyDark: "#344536",
    face: "#d88b58", hair: "#e05236", accent: "#f2ad49", metal: "#789254", eye: "#f2ad49",
  },
  amarok: {
    kind: "amarok", ink: "#20232a", body: "#46515e", bodyLight: "#91a2a8", bodyDark: "#303640",
    face: "#b9c7c7", hair: "#303640", accent: "#70d7df", metal: "#91a2a8", eye: "#70d7df",
  },
  iara: {
    kind: "iara", ink: "#20282b", body: "#24788a", bodyLight: "#55b4ae", bodyDark: "#195465",
    face: "#e0aa91", hair: "#263f56", accent: "#f09277", metal: "#55b4ae", eye: "#f7eac1",
  },
  sprout: {
    kind: "sprout", ink: "#202820", body: "#5b963f", bodyLight: "#9dca58", bodyDark: "#3b692f",
    face: "#80b947", hair: "#3b692f", accent: "#d8dc69", metal: "#d8dc69", eye: "#9dca58",
  },
  boto: {
    kind: "boto", ink: "#282127", body: "#c46f78", bodyLight: "#e69c98", bodyDark: "#874c65",
    face: "#e8a49a", hair: "#874c65", accent: "#e9cb75", metal: "#e9cb75", eye: "#282127",
  },
  raiju: {
    kind: "raiju", ink: "#20242d", body: "#8999a6", bodyLight: "#c6d4d6", bodyDark: "#536575",
    face: "#bac9c9", hair: "#536575", accent: "#f5d25b", metal: "#c6d4d6", eye: "#f5d25b",
  },
  mapinguari: {
    kind: "nativeCreature", ink: "#211e20", body: "#74513b", bodyLight: "#a47a4e", bodyDark: "#49372f",
    face: "#9c704e", hair: "#49372f", accent: "#8ca06b", metal: "#8ca06b", eye: "#e8bd63",
  },
  kappa: {
    kind: "nativeCreature", ink: "#1d2828", body: "#4f927d", bodyLight: "#8bc5a5", bodyDark: "#32675e",
    face: "#74ae91", hair: "#32675e", accent: "#7edbd0", metal: "#9b7d4d", eye: "#fff0a3",
  },
  kelpie: {
    kind: "nativeCreature", ink: "#20242b", body: "#344c5e", bodyLight: "#628a99", bodyDark: "#273644",
    face: "#829da0", hair: "#273644", accent: "#69c9c2", metal: "#628a99", eye: "#e7df9c",
  },
  ahuizotl: {
    kind: "nativeCreature", ink: "#241f25", body: "#68534a", bodyLight: "#a17d68", bodyDark: "#463b3a",
    face: "#bd9274", hair: "#463b3a", accent: "#65c4bc", metal: "#a17d68", eye: "#f1d78c",
  },
  ratatoskr: {
    kind: "nativeCreature", ink: "#29201d", body: "#b66b3f", bodyLight: "#e2a35d", bodyDark: "#724233",
    face: "#d28a58", hair: "#724233", accent: "#ecd078", metal: "#ecd078", eye: "#29201d",
  },
  carbunclo: {
    kind: "nativeCreature", ink: "#292021", body: "#a84e47", bodyLight: "#df8467", bodyDark: "#673542",
    face: "#d8896c", hair: "#673542", accent: "#72d9df", metal: "#c9e9d9", eye: "#f8e8ac",
  },
  alicanto: {
    kind: "nativeCreature", ink: "#29221c", body: "#bc8738", bodyLight: "#f0cf70", bodyDark: "#73502c",
    face: "#e5ba53", hair: "#73502c", accent: "#f3e59b", metal: "#e6bb59", eye: "#29221c",
  },
  yeti: {
    kind: "nativeCreature", ink: "#202630", body: "#adc4cc", bodyLight: "#e2f0ed", bodyDark: "#718d9b",
    face: "#91b4bf", hair: "#e2f0ed", accent: "#7bd4e7", metal: "#7bd4e7", eye: "#202630",
  },
};

type PixelPainter = {
  rect(x: number, y: number, width: number, height: number, color: string, alpha?: number): void;
};

function createPainter(context: CanvasRenderingContext2D): PixelPainter {
  return {
    rect(x, y, width, height, color, alpha = 1) {
      if (width <= 0 || height <= 0) return;
      const snap = (value: number) => Math.round(value / ACTOR_PIXEL_BLOCK) * ACTOR_PIXEL_BLOCK;
      const left = Math.max(0, Math.min(GRID, snap(x)));
      const top = Math.max(0, Math.min(GRID, snap(y)));
      const right = Math.min(GRID, Math.max(left + ACTOR_PIXEL_BLOCK, snap(x + width)));
      const bottom = Math.min(GRID, Math.max(top + ACTOR_PIXEL_BLOCK, snap(y + height)));
      if (right <= left || bottom <= top) return;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(left, top, right - left, bottom - top);
      context.globalAlpha = 1;
    },
  };
}

function drawShadow(p: PixelPainter) {
  p.rect(10, 27, 12, 1, "#101811", 0.55);
  p.rect(8, 28, 16, 1, "#101811", 0.4);
}

function drawHeadOutline(p: PixelPainter, ink: string, y: number) {
  const rows = [
    [13, 6], [11, 10], [9, 14], [8, 16], [7, 18], [7, 18], [7, 18],
    [7, 18], [7, 18], [8, 16], [9, 14], [10, 12], [12, 8],
  ] as const;
  for (let index = 0; index < rows.length; index += 1) {
    const [x, width] = rows[index];
    p.rect(x, y + index, width, 1, ink);
  }
}

function drawHumanoidHead(
  p: PixelPainter,
  actor: NativePixelActorId,
  design: ActorDesign,
  row: number,
  y: number,
) {
  drawHeadOutline(p, design.ink, y);
  p.rect(11, y + 1, 10, 2, design.face);
  p.rect(9, y + 3, 14, 7, design.face);
  p.rect(10, y + 10, 12, 3, design.face);
  p.rect(11, y + 3, 3, 2, design.bodyLight, 0.55);
  p.rect(8, y + 4, 1, 5, design.ink);
  p.rect(23, y + 4, 1, 5, design.ink);

  if (actor === "blacksmith") {
    p.rect(10, y + 1, 12, 2, design.hair);
    p.rect(8, y + 3, 4, 5, design.hair);
    p.rect(20, y + 3, 4, 5, design.hair);
    p.rect(13, y + 6, 2, 1, design.eye);
    p.rect(18, y + 6, 2, 1, design.eye);
    p.rect(15, y + 8, 3, 1, design.bodyDark);
    p.rect(8, y - 1, 16, 3, design.ink);
    p.rect(10, y - 4, 12, 4, design.bodyDark);
    p.rect(12, y - 3, 8, 1, design.bodyLight);
    p.rect(14, y - 4, 4, 1, design.accent);
  } else if (actor === "merchant") {
    p.rect(10, y + 1, 12, 2, design.hair);
    p.rect(8, y + 3, 4, 6, design.hair);
    p.rect(20, y + 3, 4, 6, design.hair);
    p.rect(13, y + 6, 2, 1, design.eye);
    p.rect(18, y + 6, 2, 1, design.eye);
    p.rect(15, y + 7, 3, 2, design.face);
    p.rect(4, y, 24, 3, design.ink);
    p.rect(8, y - 4, 16, 5, design.bodyDark);
    p.rect(10, y - 3, 12, 2, design.accent);
    p.rect(12, y - 2, 8, 1, design.bodyLight);
  } else if (actor === "archivist") {
    p.rect(10, y + 1, 12, 2, design.hair);
    p.rect(8, y + 3, 4, 7, design.hair);
    p.rect(20, y + 3, 4, 7, design.hair);
    p.rect(9, y - 2, 14, 4, design.ink);
    p.rect(11, y - 3, 10, 3, design.bodyDark);
    p.rect(12, y - 2, 8, 1, design.bodyLight);
    p.rect(9, y + 5, 6, 3, design.ink);
    p.rect(17, y + 5, 6, 3, design.ink);
    p.rect(10, y + 6, 4, 1, design.accent);
    p.rect(18, y + 6, 4, 1, design.accent);
    p.rect(15, y + 6, 2, 1, design.ink);
    p.rect(15, y + 8, 2, 1, design.bodyDark);
  } else if (actor === "bestiaryKeeper") {
    p.rect(9, y + 1, 14, 3, design.bodyDark);
    p.rect(8, y + 3, 4, 7, design.bodyDark);
    p.rect(20, y + 3, 4, 7, design.bodyDark);
    p.rect(10, y + 2, 12, 6, design.face);
    p.rect(13, y + 6, 2, 1, design.eye);
    p.rect(18, y + 6, 2, 1, design.eye);
    p.rect(15, y + 8, 3, 1, design.bodyDark);
    p.rect(8, y - 1, 5, 3, design.accent);
    p.rect(19, y - 1, 5, 3, design.accent);
    p.rect(12, y - 3, 8, 3, design.bodyLight);
    p.rect(14, y - 2, 4, 2, design.accent);
  } else if (actor === "curupira") {
    p.rect(9, y - 1, 14, 3, design.hair);
    p.rect(10, y - 2, 12, 2, design.accent);
    p.rect(8, y + 1, 5, 4, design.hair);
    p.rect(19, y + 1, 5, 4, design.hair);
    p.rect(12, y + 6, 2, 1, design.ink);
    p.rect(18, y + 6, 2, 1, design.ink);
    p.rect(15, y + 8, 3, 1, design.bodyDark);
    p.rect(11, y + 1, 3, 2, design.accent);
    p.rect(18, y + 1, 3, 2, design.accent);
  } else {
    p.rect(10, y + 1, 12, 2, design.hair);
    p.rect(8, y + 3, 4, 5, design.hair);
    p.rect(20, y + 3, 4, 5, design.hair);
    p.rect(13, y + 6, 2, 1, design.eye);
    p.rect(18, y + 6, 2, 1, design.eye);
    p.rect(15, y + 8, 3, 1, design.bodyDark);
  }

  if ((row === 2 && actor !== "curupira") || (row === 3 && design.kind === "npc")) {
    p.rect(15, y + 9, 3, 1, design.bodyDark);
  }
}

function drawHumanActor(
  p: PixelPainter,
  actor: NativePixelActorId,
  design: ActorDesign,
  row: number,
  frame: number,
) {
  const isNpc = design.kind === "npc";
  const walking = row === 1;
  const working = isNpc && row === 2;
  const talking = isNpc && row === 3;
  const attacking = actor === "curupira" && row === 2;
  const shooting = actor === "curupira" && row === 3;
  const damaged = row === 4;
  const walkPose = walking ? getNativePixelWalkPose(frame) : null;
  const stride = walkPose?.stride ?? 0;
  const bob = row === 0
    ? [0, -1, 0, -1][frame]
    : walking
      ? walkPose!.bodyBob
      : damaged
        ? [0, -1, 1, 0][frame]
        : 0;

  if (row === 5) {
    // Defeat pose: the compact silhouette lies across the floor with the signature
    // hair/crown color still visible, rather than shrinking a painted illustration.
    drawShadow(p);
    p.rect(6, 23, 21, 5, design.ink);
    p.rect(9, 24, 13, 3, design.body);
    p.rect(21, 21, 8, 7, design.ink);
    p.rect(22, 22, 6, 4, design.face);
    p.rect(23, 23, 2, 1, design.ink);
    p.rect(26, 25, 2, 1, design.bodyDark);
    p.rect(6, 20, 7, 3, design.ink);
    p.rect(7, 21, 5, 1, design.body);
    p.rect(22, 26, 7, 2, design.bodyDark);
    if (actor === "curupira") p.rect(20, 20, 8, 2, design.hair);
    return;
  }

  drawShadow(p);

  const leftLegX = 12 + stride;
  const rightLegX = 18 - stride;
  const leftLegY = 23 + bob + (walkPose?.leftLift ?? 0);
  const rightLegY = 23 + bob + (walkPose?.rightLift ?? 0);
  p.rect(leftLegX, leftLegY, 4, 5, design.ink);
  p.rect(leftLegX + 1, leftLegY + 1, 2, 3, design.bodyDark);
  p.rect(leftLegX - 1, leftLegY + 4, 6, 2, design.ink);
  p.rect(leftLegX, leftLegY + 4, 4, 1, design.bodyLight);
  p.rect(rightLegX, rightLegY, 4, 5, design.ink);
  p.rect(rightLegX + 1, rightLegY + 1, 2, 3, design.bodyDark);
  p.rect(rightLegX - 1, rightLegY + 4, 6, 2, design.ink);
  p.rect(rightLegX, rightLegY + 4, 4, 1, design.bodyLight);

  const raisedArm = working || talking || attacking || shooting;
  const leftArmSwing = walking ? -stride : 0;
  p.rect(8 + leftArmSwing, 15 + bob, 6, 9, design.ink);
  p.rect(9 + leftArmSwing, 16 + bob, 4, 7, design.bodyDark);
  p.rect(9 + leftArmSwing, 21 + bob, 4, 3, design.ink);
  p.rect(10 + leftArmSwing, 22 + bob, 2, 1, design.face);

  if (raisedArm) {
    const handY = working
      ? 11 - (frame % 2)
      : attacking
        ? 13 + [0, 2, 1, 0][frame]
        : shooting
          ? 10 + [2, 0, -1, 1][frame]
          : 12 + (frame === 3 ? -1 : 0);
    p.rect(20, 14 + bob, 5, 7, design.ink);
    p.rect(21, 15 + bob, 3, 5, design.bodyDark);
    p.rect(21, handY, 4, 5, design.ink);
    p.rect(22, handY + 1, 2, 3, design.face);
  } else {
    const swing = walking ? stride : 0;
    p.rect(20 + swing, 15 + bob, 5, 9, design.ink);
    p.rect(21 + swing, 16 + bob, 3, 6, design.bodyDark);
    p.rect(20 + swing, 22 + bob, 5, 3, design.ink);
    p.rect(21 + swing, 23 + bob, 3, 1, design.face);
  }

  // The shoulders and short tunic make the head the dominant read at game scale.
  p.rect(10, 15 + bob, 12, 10, design.ink);
  p.rect(11, 16 + bob, 10, 7, design.body);
  p.rect(12, 16 + bob, 8, 2, design.bodyLight);
  p.rect(11, 22 + bob, 10, 2, design.bodyDark);
  p.rect(14, 17 + bob, 4, 1, design.accent);
  p.rect(15, 18 + bob, 2, 3, design.bodyLight);
  p.rect(12, 23 + bob, 8, 3, design.bodyDark);
  p.rect(13, 24 + bob, 6, 1, design.accent);

  const headY = 3 + bob;
  drawHumanoidHead(p, actor, design, row, headY);

  if (actor === "blacksmith") {
    p.rect(12, 17 + bob, 8, 8, design.bodyDark);
    p.rect(13, 18 + bob, 6, 6, design.bodyLight);
    p.rect(14, 19 + bob, 4, 4, design.bodyDark);
    p.rect(14, 18 + bob, 4, 1, design.accent);
    if (working) {
      p.rect(24, 10 - (frame % 2), 2, 8, design.bodyDark);
      p.rect(22, 9 - (frame % 2), 6, 3, design.metal);
      p.rect(24, 8 - (frame % 2), 4, 2, design.bodyLight);
      p.rect(25, 8 - (frame % 2), 1, 1, design.accent);
      p.rect(8, 21, 5, 2, design.metal);
      if (frame % 2 === 1) p.rect(27, 8, 1, 1, design.accent);
    } else {
      p.rect(23, 18, 2, 7, design.bodyDark);
      p.rect(22, 17, 4, 2, design.metal);
    }
  } else if (actor === "merchant") {
    p.rect(21, 19, 7, 7, design.ink);
    p.rect(22, 20, 5, 5, design.accent);
    p.rect(23, 21, 3, 3, design.bodyLight);
    p.rect(12, 20, 6, 1, design.bodyLight);
    p.rect(17, 20, 2, 4, design.bodyDark);
    if (working) {
      p.rect(25, 10, 3, 3, design.ink);
      p.rect(26, 11, 1, 1, design.accent);
      p.rect(24, 9, 1, 1, design.bodyLight);
    }
  } else if (actor === "archivist") {
    p.rect(10, 19, 4, 4, design.metal);
    p.rect(11, 20, 2, 2, design.bodyLight);
    p.rect(22, 18, 6, 7, design.ink);
    p.rect(23, 19, 4, 5, design.bodyLight);
    p.rect(24, 20, 1, 3, design.bodyDark);
    if (working) {
      p.rect(25, 13, 5, 7, design.ink);
      p.rect(26, 14, 3, 5, design.face);
      p.rect(26, 15, 2, 1, design.accent);
      p.rect(26, 17, 2, 1, design.bodyLight);
    }
  } else if (actor === "bestiaryKeeper") {
    p.rect(21, 19, 7, 7, design.ink);
    p.rect(22, 20, 5, 5, design.bodyLight);
    p.rect(24, 21, 2, 3, design.bodyDark);
    p.rect(23, 22, 4, 1, design.accent);
    p.rect(12, 19, 6, 4, design.bodyDark);
    p.rect(13, 20, 4, 2, design.bodyLight);
    if (working) {
      p.rect(23, 13, 5, 7, design.ink);
      p.rect(24, 14, 3, 5, design.accent);
      p.rect(25, 15, 1, 3, design.bodyDark);
    }
  } else if (actor === "curupira") {
    // The Curupira's backward heels are its unmistakable Folklard silhouette cue.
    p.rect(10, 27 + bob, 5, 2, design.ink);
    p.rect(8, 27 + bob, 3, 1, design.accent);
    p.rect(18, 27 + bob, 5, 2, design.ink);
    p.rect(21, 27 + bob, 3, 1, design.accent);
    p.rect(12, 18 + bob, 2, 3, design.accent);
    p.rect(18, 18 + bob, 2, 3, design.accent);
    if (attacking) {
      const sweep = [0, 1, 2, 1][frame];
      p.rect(20, 15 + sweep, 8, 5, design.ink);
      p.rect(22, 16 + sweep, 6, 3, design.bodyDark);
      p.rect(26, 13 + sweep, 5, 4, design.ink);
      p.rect(27, 14 + sweep, 4, 2, design.accent);
      p.rect(28 - sweep, 10, 3, 3, design.hair);
      p.rect(25 - sweep, 9, 3, 2, design.accent);
    }
    if (shooting) {
      const emberX = 22 + frame * 2;
      p.rect(21, 12, 5, 4, design.ink);
      p.rect(22, 13, 3, 2, design.bodyDark);
      p.rect(emberX, 11 - (frame % 2), 4, 4, design.ink);
      p.rect(emberX + 1, 12 - (frame % 2), 2, 2, design.hair);
      p.rect(emberX + 1, 12 - (frame % 2), 1, 1, design.accent);
    }
  }

  if (talking) {
    p.rect(26, 11, 1, 1, design.accent);
    p.rect(28, 9, 1, 1, design.bodyLight);
  }

  if (damaged) {
    p.rect(24 + frame % 2, 6, 3, 3, design.accent);
    p.rect(26, 9 + frame % 2, 2, 2, design.bodyLight);
    p.rect(6, 14, 2, 2, design.ink);
  }
}

function drawSprout(p: PixelPainter, design: ActorDesign, row: number, frame: number) {
  const bob = row === 0 ? [0, -1, 0, -1][frame] : row === 1 ? [0, 1, 0, -1][frame] : row === 4 ? [0, -1, 1, 0][frame] : 0;
  const leafTilt = row === 1 || row === 2 || row === 3 ? [-1, 0, 1, 0][frame] : 0;
  const raisedArm = row === 2 ? [2, 4, 4, 1][frame] : row === 3 ? [1, 3, 2, 0][frame] : 0;
  if (row === 5) {
    drawShadow(p);
    p.rect(7, 22, 18, 5, design.ink);
    p.rect(10, 23, 12, 3, design.bodyDark);
    p.rect(11, 21, 9, 2, design.bodyLight);
    p.rect(8, 19, 5, 3, design.ink);
    p.rect(20, 19, 5, 3, design.ink);
    p.rect(10, 18, 3, 2, design.bodyLight);
    p.rect(21, 18, 3, 2, design.bodyLight);
    p.rect(12, 22, 2, 1, design.ink);
    p.rect(18, 22, 2, 1, design.ink);
    p.rect(14, 10, 5, 8, design.ink);
    p.rect(15, 11, 3, 5, design.bodyDark);
    p.rect(15, 6, 3, 4, design.bodyLight);
    return;
  }
  drawShadow(p);
  p.rect(10, 23 + bob, 5, 6, design.ink);
  p.rect(17, 23 + bob, 5, 6, design.ink);
  p.rect(12, 24 + bob, 2, 4, design.bodyDark);
  p.rect(18, 24 + bob, 2, 4, design.bodyDark);
  p.rect(8, 12 + bob, 16, 14, design.ink);
  p.rect(9, 13 + bob, 14, 11, design.bodyDark);
  p.rect(10, 15 + bob, 12, 8, design.body);
  p.rect(11, 15 + bob, 9, 2, design.bodyLight);
  p.rect(12, 18 + bob, 2, 3, design.ink);
  p.rect(18, 18 + bob, 2, 3, design.ink);
  p.rect(13, 18 + bob, 1, 1, design.eye);
  p.rect(19, 18 + bob, 1, 1, design.eye);
  p.rect(14, 21 + bob, 5, 1, design.bodyDark);
  p.rect(14, 13 + bob, 4, 2, design.bodyDark);
  p.rect(5, 16 + bob - raisedArm, 5, 6, design.ink);
  p.rect(6, 18 + bob - raisedArm, 4, 3, design.body);
  p.rect(23, 16 + bob - raisedArm, 5, 6, design.ink);
  p.rect(23, 18 + bob - raisedArm, 4, 3, design.bodyLight);
  p.rect(8 - leafTilt, 8 + bob, 8, 5, design.ink);
  p.rect(9 - leafTilt, 7 + bob, 6, 5, design.bodyLight);
  p.rect(8 - leafTilt, 5 + bob, 4, 4, design.accent);
  p.rect(17 + leafTilt, 8 + bob, 8, 5, design.ink);
  p.rect(18 + leafTilt, 7 + bob, 6, 5, design.bodyLight);
  p.rect(21 + leafTilt, 5 + bob, 4, 4, design.accent);
  p.rect(14, 4 + bob, 5, 9, design.ink);
  p.rect(15, 5 + bob, 3, 7, design.bodyLight);
  p.rect(15, 7 + bob, 3, 1, design.accent);
  if (row === 2) {
    const swipe = [0, 2, 4, 2][frame];
    p.rect(22, 16 - swipe, 7, 4, design.ink);
    p.rect(24, 15 - swipe, 7, 2, design.bodyLight);
    p.rect(27, 14 - swipe, 4, 2, design.accent);
  } else if (row === 3) {
    p.rect(15 + frame * 2, 12 - (frame % 2), 4, 4, design.ink);
    p.rect(16 + frame * 2, 13 - (frame % 2), 2, 2, design.accent);
    p.rect(4, 11 + (frame % 2), 3, 3, design.accent);
    p.rect(27, 10 + (frame % 2), 3, 3, design.bodyLight);
  } else if (row === 4) {
    p.rect(24 + frame % 2, 8, 3, 3, design.accent);
    p.rect(5, 15 + frame % 2, 2, 2, design.bodyLight);
  }
}

function drawAmarok(p: PixelPainter, design: ActorDesign, row: number, frame: number) {
  const gait = row === 1 ? [-1, 0, 1, 0][frame] : 0;
  const bob = row === 0 ? [0, -1, 0, -1][frame] : row === 1 ? [0, 1, 0, -1][frame] : row === 4 ? [0, -1, 1, 0][frame] : 0;
  if (row === 5) {
    drawShadow(p);
    p.rect(6, 21, 21, 7, design.ink);
    p.rect(9, 22, 12, 4, design.body);
    p.rect(20, 20, 9, 7, design.ink);
    p.rect(23, 22, 6, 3, design.bodyLight);
    p.rect(26, 21, 2, 1, design.eye);
    return;
  }
  drawShadow(p);
  // Low, front-facing wolf cub: broad ruff, paired ears, pale mask and four paws.
  p.rect(21, 20 + bob, 8, 4, design.ink);
  p.rect(23, 21 + bob, 6, 2, design.accent);
  p.rect(8 + gait, 23 + bob, 5, 6, design.ink);
  p.rect(9 + gait, 24 + bob, 3, 4, design.bodyDark);
  p.rect(14 - gait, 23 + bob, 5, 6, design.ink);
  p.rect(15 - gait, 24 + bob, 3, 4, design.bodyDark);
  p.rect(20 + gait, 23 + bob, 5, 6, design.ink);
  p.rect(21 + gait, 24 + bob, 3, 4, design.bodyDark);
  p.rect(6, 15 + bob, 20, 12, design.ink);
  p.rect(8, 17 + bob, 16, 8, design.body);
  p.rect(10, 17 + bob, 12, 3, design.bodyLight);
  p.rect(7, 18 + bob, 18, 5, design.bodyDark);
  p.rect(9, 21 + bob, 14, 4, design.bodyLight);
  p.rect(8, 7 + bob, 16, 15, design.ink);
  p.rect(10, 9 + bob, 12, 11, design.body);
  p.rect(11, 10 + bob, 10, 4, design.bodyLight);
  p.rect(6, 5 + bob, 7, 9, design.ink);
  p.rect(8, 7 + bob, 4, 6, design.bodyDark);
  p.rect(19, 5 + bob, 7, 9, design.ink);
  p.rect(20, 7 + bob, 4, 6, design.bodyDark);
  p.rect(11, 14 + bob, 3, 3, design.eye);
  p.rect(18, 14 + bob, 3, 3, design.eye);
  p.rect(12, 17 + bob, 8, 4, design.ink);
  p.rect(13, 17 + bob, 6, 3, design.face);
  p.rect(15, 18 + bob, 3, 2, design.ink);
  p.rect(5, 14 + bob, 4, 5, design.bodyLight);
  p.rect(23, 14 + bob, 4, 5, design.bodyLight);
  if (row === 2) {
    const lunge = [0, 1, 2, 1][frame];
    p.rect(11, 17 + bob + lunge, 10, 5, design.ink);
    p.rect(13, 18 + bob + lunge, 6, 3, design.face);
    p.rect(15, 19 + bob + lunge, 4, 3, design.ink);
    p.rect(8, 21 + bob + lunge, 6, 4, design.ink);
    p.rect(18, 21 + bob + lunge, 6, 4, design.ink);
    p.rect(3, 12 + (frame % 2), 3, 3, design.accent);
    p.rect(26, 10 + (frame % 2), 4, 4, design.bodyLight);
  } else if (row === 3) {
    const howl = [0, 1, 2, 1][frame];
    p.rect(12, 15 + bob, 9, 6 + howl, design.ink);
    p.rect(14, 16 + bob, 5, 4 + howl, design.face);
    p.rect(15, 19 + bob + howl, 4, 2, design.ink);
    p.rect(21 + frame * 2, 12 - (frame % 2), 4, 4, design.ink);
    p.rect(22 + frame * 2, 13 - (frame % 2), 2, 2, design.accent);
    p.rect(26, 10 + (frame % 2), 3, 3, design.bodyLight);
  } else if (row === 4) {
    p.rect(25 + frame % 2, 7, 3, 3, design.accent);
    p.rect(3, 13 + frame % 2, 3, 3, design.bodyLight);
  }
}

function drawIara(p: PixelPainter, design: ActorDesign, row: number, frame: number) {
  if (row === 5) {
    drawShadow(p);
    p.rect(9, 23, 15, 5, design.ink);
    p.rect(11, 24, 10, 3, design.bodyDark);
    p.rect(21, 22, 7, 5, design.ink);
    p.rect(22, 23, 5, 3, design.body);
    p.rect(24, 24, 1, 1, design.eye);
    return;
  }
  const bob = row === 0 ? [0, -1, 0, -1][frame] : row === 1 ? [0, 1, 0, -1][frame] : row === 4 ? [0, -1, 1, 0][frame] : 0;
  const hairShift = row === 1 ? [-1, 0, 1, 0][frame] : row === 2 ? [0, 1, 2, 1][frame] : 0;
  drawShadow(p);
  // Front-facing mermaid: a shell crown, framed face and broad twin tail flukes.
  p.rect(11, 23 + bob, 10, 5, design.ink);
  p.rect(13, 24 + bob, 6, 3, design.bodyDark);
  p.rect(7, 25 + bob, 8, 4, design.ink);
  p.rect(8, 26 + bob, 6, 2, design.bodyLight);
  p.rect(17, 25 + bob, 8, 4, design.ink);
  p.rect(18, 26 + bob, 6, 2, design.bodyLight);
  p.rect(10, 15 + bob, 12, 11, design.ink);
  p.rect(12, 16 + bob, 8, 8, design.body);
  p.rect(13, 17 + bob, 6, 5, design.bodyLight);
  p.rect(8, 14 + bob, 4, 9, design.ink);
  p.rect(9, 16 + bob, 3, 6, design.bodyDark);
  p.rect(20, 14 + bob, 4, 9, design.ink);
  p.rect(20, 16 + bob, 3, 6, design.bodyDark);
  p.rect(9 + hairShift, 7 + bob, 14, 13, design.ink);
  p.rect(10 + hairShift, 8 + bob, 12, 10, design.hair);
  p.rect(11 + hairShift, 9 + bob, 9, 2, design.bodyLight);
  p.rect(7 + hairShift, 11 + bob, 5, 12, design.ink);
  p.rect(8 + hairShift, 12 + bob, 3, 10, design.hair);
  p.rect(20 + hairShift, 11 + bob, 5, 12, design.ink);
  p.rect(21 + hairShift, 12 + bob, 3, 10, design.hair);
  p.rect(11, 11 + bob, 10, 7, design.face);
  p.rect(12, 13 + bob, 2, 2, design.ink);
  p.rect(18, 13 + bob, 2, 2, design.ink);
  p.rect(14, 16 + bob, 5, 1, design.bodyDark);
  p.rect(8, 5 + bob, 4, 4, design.ink);
  p.rect(9, 6 + bob, 2, 2, design.accent);
  p.rect(13, 5 + bob, 6, 4, design.ink);
  p.rect(14, 6 + bob, 4, 2, design.accent);
  p.rect(14, 7 + bob, 2, 1, design.bodyLight);
  if (row === 2) {
    p.rect(6, 15 + frame % 2, 6, 3, design.ink);
    p.rect(7, 16 + frame % 2, 4, 2, design.body);
    p.rect(20, 15 + frame % 2, 6, 3, design.ink);
    p.rect(21, 16 + frame % 2, 4, 2, design.body);
    p.rect(4, 13 + frame % 2, 4, 5, design.bodyLight);
    p.rect(25, 12 + frame % 2, 4, 5, design.accent);
    p.rect(10 + frame, 4, 3, 3, design.bodyLight);
  } else if (row === 3) {
    // Iara casts a bright river pearl after the close water-whip attack.
    p.rect(24 + (frame % 2), 10 - (frame % 2), 5, 5, design.ink);
    p.rect(25 + (frame % 2), 11 - (frame % 2), 3, 3, design.accent);
    p.rect(26 + (frame % 2), 11 - (frame % 2), 1, 1, design.bodyLight);
    p.rect(5, 12 + (frame % 2), 3, 2, design.bodyLight);
  }
}

function drawBoto(p: PixelPainter, design: ActorDesign, row: number, frame: number) {
  if (row === 5) {
    drawShadow(p);
    p.rect(7, 22, 21, 6, design.ink);
    p.rect(9, 23, 15, 4, design.bodyDark);
    p.rect(22, 21, 7, 6, design.ink);
    p.rect(24, 22, 4, 3, design.bodyLight);
    p.rect(25, 23, 1, 1, design.ink);
    return;
  }
  const bob = row === 0 ? [0, -1, 0, -1][frame] : row === 1 ? [0, 1, 0, -1][frame] : row === 4 ? [0, -1, 1, 0][frame] : 0;
  const tailShift = row === 1 ? [-1, 1, -1, 1][frame] : row === 2 ? [0, 1, 2, 1][frame] : 0;
  drawShadow(p);
  // The pink river dolphin's short suit, long beak and straw hat keep its human
  // disguise recognizable without turning it into a generic villager.
  p.rect(11, 23 + bob, 4, 6, design.ink);
  p.rect(17, 23 + bob, 4, 6, design.ink);
  p.rect(12, 24 + bob, 2, 4, design.bodyDark);
  p.rect(18, 24 + bob, 2, 4, design.bodyDark);
  p.rect(9, 16 + bob, 14, 10, design.ink);
  p.rect(11, 17 + bob, 10, 7, design.body);
  p.rect(12, 18 + bob, 8, 4, design.bodyLight);
  p.rect(13, 21 + bob, 6, 2, design.bodyDark);
  p.rect(7, 17 + bob, 5, 7, design.ink);
  p.rect(8, 18 + bob, 3, 5, design.body);
  p.rect(21, 17 + bob, 5, 7, design.ink);
  p.rect(22, 18 + bob, 3, 5, design.body);
  p.rect(9, 8 + bob, 15, 12, design.ink);
  p.rect(11, 9 + bob, 11, 9, design.face);
  p.rect(19, 12 + bob, 9, 5, design.ink);
  p.rect(21, 13 + bob, 8, 3, design.bodyLight);
  p.rect(25, 12 + bob, 4, 2, design.face);
  p.rect(18, 11 + bob, 2, 2, design.ink);
  p.rect(12, 12 + bob, 2, 2, design.ink);
  p.rect(8, 6 + bob, 18, 3, design.ink);
  p.rect(10, 2 + bob, 14, 5, design.bodyDark);
  p.rect(11, 3 + bob, 12, 2, design.accent);
  p.rect(13, 3 + bob, 7, 1, design.bodyLight);
  p.rect(13 + tailShift, 25 + bob, 6, 4, design.ink);
  p.rect(14 + tailShift, 26 + bob, 4, 2, design.bodyDark);
  if (row === 2) {
    p.rect(21, 18, 8, 4, design.ink);
    p.rect(23, 19, 6, 2, design.body);
    p.rect(28, 15 + frame % 2, 3, 3, design.ink);
    p.rect(29, 16 + frame % 2, 2, 1, design.face);
    p.rect(27 + tailShift, 11 - (frame % 2), 3, 3, design.accent);
    p.rect(29 + tailShift, 10 - (frame % 2), 2, 2, design.bodyLight);
  } else if (row === 3) {
    // The ranged cycle launches bubbles from the dolphin's long beak.
    p.rect(26 + frame, 13 - (frame % 2), 4, 4, design.ink);
    p.rect(27 + frame, 14 - (frame % 2), 2, 2, design.bodyLight);
    p.rect(24 + frame, 11 - (frame % 2), 2, 2, design.accent);
  }
}

function drawRaiju(p: PixelPainter, design: ActorDesign, row: number, frame: number) {
  const gait = row === 1 ? [-1, 0, 1, 0][frame] : 0;
  const bob = row === 0 ? [0, -1, 0, -1][frame] : row === 4 ? [0, -1, 1, 0][frame] : 0;
  if (row === 5) {
    drawShadow(p);
    p.rect(7, 22, 20, 6, design.ink);
    p.rect(10, 23, 13, 3, design.body);
    p.rect(21, 20, 8, 7, design.ink);
    p.rect(23, 22, 5, 3, design.bodyLight);
    p.rect(26, 23, 2, 1, design.eye);
    p.rect(5, 18, 6, 3, design.ink);
    return;
  }
  drawShadow(p);
  // A front-facing electric fox with a lightning-split tail and tall alert ears.
  p.rect(3, 17 + bob, 7, 6, design.ink);
  p.rect(2, 15 + bob, 7, 7, design.bodyDark);
  p.rect(4, 16 + bob, 4, 4, design.bodyLight);
  p.rect(21, 17 + bob, 8, 6, design.ink);
  p.rect(24, 14 + bob, 6, 7, design.bodyDark);
  p.rect(26, 15 + bob, 4, 4, design.bodyLight);
  p.rect(8 + gait, 23 + bob, 5, 6, design.ink);
  p.rect(9 + gait, 24 + bob, 3, 4, design.bodyDark);
  p.rect(19 - gait, 23 + bob, 5, 6, design.ink);
  p.rect(20 - gait, 24 + bob, 3, 4, design.bodyDark);
  p.rect(8, 15 + bob, 16, 12, design.ink);
  p.rect(10, 17 + bob, 12, 8, design.body);
  p.rect(12, 17 + bob, 8, 3, design.bodyLight);
  p.rect(10, 7 + bob, 12, 14, design.ink);
  p.rect(12, 9 + bob, 8, 10, design.body);
  p.rect(7, 4 + bob, 8, 11, design.ink);
  p.rect(9, 6 + bob, 4, 7, design.bodyDark);
  p.rect(17, 4 + bob, 8, 11, design.ink);
  p.rect(19, 6 + bob, 4, 7, design.bodyDark);
  p.rect(12, 12 + bob, 2, 2, design.eye);
  p.rect(18, 12 + bob, 2, 2, design.eye);
  p.rect(13, 15 + bob, 6, 4, design.ink);
  p.rect(14, 16 + bob, 4, 2, design.face);
  p.rect(15, 16 + bob, 2, 2, design.ink);
  p.rect(14, 20 + bob, 4, 3, design.accent);
  p.rect(24, 10 + bob, 4, 2, design.accent);
  p.rect(26, 8 + bob, 3, 2, design.bodyLight);
  if (row === 2) {
    const bolt = frame % 2;
    p.rect(13, 18 + bolt, 6, 5, design.ink);
    p.rect(14, 19 + bolt, 4, 3, design.face);
    p.rect(15, 19 + bolt, 2, 4, design.ink);
    p.rect(3, 10 + frame, 4, 5, design.accent);
    p.rect(26 - frame, 9 + frame % 2, 4, 5, design.bodyLight);
    p.rect(1 + frame, 16, 4, 2, design.accent);
  } else if (row === 3) {
    // Raiju channels a bolt through the fork of its tail.
    p.rect(25 + (frame % 2), 7 + (frame % 2), 5, 3, design.ink);
    p.rect(27 + (frame % 2), 4 + (frame % 2), 3, 8, design.accent);
    p.rect(25 + (frame % 2), 9 + (frame % 2), 6, 3, design.bodyLight);
    p.rect(29 + (frame % 2), 7 + (frame % 2), 2, 6, design.accent);
  }
}

function drawNativeFolkloreCreature(
  p: PixelPainter,
  actor: NativePixelActorId,
  design: ActorDesign,
  row: number,
  frame: number,
) {
  const bob = row === 0 ? [0, -1, 0, -1][frame] : row === 1 ? [0, 1, 0, -1][frame] : row === 4 ? [0, -1, 1, 0][frame] : 0;
  const step = row === 1 ? [-1, 0, 1, 0][frame] : 0;
  const strike = row === 2;

  switch (actor) {
    case "mapinguari": {
      if (row === 5) {
        drawShadow(p);
        p.rect(4, 22, 25, 7, design.ink);
        p.rect(7, 23, 18, 4, design.body);
        p.rect(19, 21, 9, 7, design.ink);
        p.rect(21, 22, 6, 4, design.bodyLight);
        p.rect(24, 23, 2, 1, design.ink);
        p.rect(20, 21, 3, 1, design.hair);
        return;
      }
      drawShadow(p);
      // Compact front view with the lone eye above a huge belly mouth.
      p.rect(10 + step, 23 + bob, 5, 6, design.ink);
      p.rect(11 + step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(18 - step, 23 + bob, 5, 6, design.ink);
      p.rect(19 - step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(7, 14 + bob, 18, 13, design.ink);
      p.rect(9, 16 + bob, 14, 9, design.body);
      p.rect(10, 16 + bob, 11, 3, design.bodyLight);
      p.rect(10, 19 + bob, 12, 5, design.bodyDark);
      p.rect(4, 14 + bob, 7, 11, design.ink);
      p.rect(5, 17 + bob, 6, 7, design.body);
      p.rect(3, 22 + bob, 5, 3, design.bodyDark);
      p.rect(22, 14 + bob, 7, 11, design.ink);
      p.rect(23, 17 + bob, 6, 7, design.body);
      p.rect(24, 22 + bob, 5, 3, design.bodyDark);
      p.rect(9, 7 + bob, 14, 12, design.ink);
      p.rect(11, 9 + bob, 10, 8, design.face);
      p.rect(14, 10 + bob, 5, 5, design.eye);
      p.rect(16, 11 + bob, 2, 3, design.ink);
      p.rect(10, 7 + bob, 4, 4, design.hair);
      p.rect(19, 7 + bob, 4, 4, design.hair);
      p.rect(11, 19 + bob, 10, 5, design.ink);
      p.rect(12, 20 + bob, 8, 3, design.bodyDark);
      p.rect(13, 20 + bob, 2, 1, design.bodyLight);
      p.rect(17, 20 + bob, 2, 1, design.bodyLight);
      p.rect(12, 22 + bob, 8, 1, design.accent);
      if (strike) {
        const lift = frame < 2 ? 3 : 0;
        p.rect(2, 11 - lift + bob, 7, 7, design.ink);
        p.rect(3, 12 - lift + bob, 5, 5, design.body);
        p.rect(23, 11 - lift + bob, 7, 7, design.ink);
        p.rect(24, 12 - lift + bob, 5, 5, design.body);
        p.rect(1, 8 - lift + bob, 3, 3, design.accent);
        p.rect(28, 8 - lift + bob, 3, 3, design.accent);
      } else if (row === 3) {
        p.rect(23, 17 + bob, 6, 5, design.ink);
        p.rect(25, 18 + bob, 5, 3, design.accent);
        p.rect(28 + frame % 2, 17 + frame % 2, 3, 3, design.bodyLight);
        p.rect(30, 16 + frame % 2, 2, 2, design.accent);
      }
      break;
    }
    case "kappa": {
      if (row === 5) {
        drawShadow(p);
        p.rect(7, 23, 19, 6, design.ink);
        p.rect(10, 24, 12, 3, design.bodyDark);
        p.rect(19, 21, 9, 7, design.ink);
        p.rect(21, 22, 6, 4, design.body);
        p.rect(23, 23, 2, 1, design.eye);
        p.rect(11, 22, 12, 2, design.metal);
        return;
      }
      drawShadow(p);
      // Front-facing turtle child: bowl, flat face and a domed shell are its read.
      p.rect(9 + step, 22 + bob, 5, 7, design.ink);
      p.rect(10 + step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(18 - step, 22 + bob, 5, 7, design.ink);
      p.rect(19 - step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(7, 16 + bob, 18, 12, design.ink);
      p.rect(9, 18 + bob, 14, 8, design.body);
      p.rect(11, 19 + bob, 10, 5, design.bodyDark);
      p.rect(12, 20 + bob, 8, 3, design.bodyLight);
      p.rect(8, 14 + bob, 4, 8, design.ink);
      p.rect(9, 17 + bob, 4, 4, design.bodyLight);
      p.rect(20, 14 + bob, 4, 8, design.ink);
      p.rect(20, 17 + bob, 4, 4, design.bodyLight);
      p.rect(9, 9 + bob, 14, 12, design.ink);
      p.rect(11, 11 + bob, 10, 8, design.face);
      p.rect(12, 13 + bob, 2, 2, design.ink);
      p.rect(18, 13 + bob, 2, 2, design.ink);
      p.rect(13, 13 + bob, 1, 1, design.eye);
      p.rect(19, 13 + bob, 1, 1, design.eye);
      p.rect(14, 17 + bob, 5, 1, design.bodyDark);
      // A broad rim and bright pool make the water dish legible at sprite size.
      p.rect(7, 7 + bob, 18, 4, design.ink);
      p.rect(9, 6 + bob, 14, 3, design.metal);
      p.rect(10, 6 + bob, 12, 2, design.accent);
      p.rect(12, 5 + bob, 8, 2, design.bodyLight);
      p.rect(13, 5 + bob, 6, 1, design.accent);
      if (strike) {
        p.rect(5, 8 + frame % 2, 3, 4, design.accent);
        p.rect(24, 8 + frame % 2, 3, 4, design.accent);
        p.rect(13, 2 + frame % 2, 6, 3, design.bodyLight);
        p.rect(15 + frame, 1, 2, 2, design.accent);
      } else if (row === 3) {
        p.rect(23 + frame % 2, 9, 5, 5, design.ink);
        p.rect(24 + frame % 2, 10, 3, 3, design.bodyLight);
        p.rect(28 + frame % 2, 12, 2, 2, design.accent);
      }
      break;
    }
    case "kelpie": {
      if (row === 5) {
        drawShadow(p);
        p.rect(4, 22, 25, 6, design.ink);
        p.rect(7, 23, 17, 4, design.body);
        p.rect(20, 20, 9, 7, design.ink);
        p.rect(22, 21, 6, 4, design.face);
        p.rect(25, 22, 2, 1, design.eye);
        p.rect(18, 20, 6, 2, design.hair);
        return;
      }
      drawShadow(p);
      // A little water horse facing forward; the mane is a dark wave crown.
      p.rect(9 + step, 22 + bob, 5, 7, design.ink);
      p.rect(10 + step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(18 - step, 22 + bob, 5, 7, design.ink);
      p.rect(19 - step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(7, 16 + bob, 18, 11, design.ink);
      p.rect(9, 18 + bob, 14, 7, design.body);
      p.rect(11, 18 + bob, 10, 3, design.bodyLight);
      p.rect(7, 13 + bob, 6, 9, design.ink);
      p.rect(8, 15 + bob, 4, 6, design.body);
      p.rect(19, 13 + bob, 6, 9, design.ink);
      p.rect(20, 15 + bob, 4, 6, design.body);
      p.rect(9, 7 + bob, 14, 14, design.ink);
      p.rect(11, 9 + bob, 10, 10, design.body);
      p.rect(12, 10 + bob, 8, 4, design.bodyLight);
      p.rect(10, 5 + bob, 4, 7, design.ink);
      p.rect(11, 6 + bob, 2, 5, design.bodyLight);
      p.rect(18, 5 + bob, 4, 7, design.ink);
      p.rect(19, 6 + bob, 2, 5, design.bodyLight);
      p.rect(9, 14 + bob, 14, 5, design.bodyDark);
      p.rect(11, 15 + bob, 10, 5, design.bodyLight);
      p.rect(12, 16 + bob, 2, 2, design.eye);
      p.rect(18, 16 + bob, 2, 2, design.eye);
      p.rect(14, 19 + bob, 5, 2, design.ink);
      p.rect(15, 19 + bob, 3, 1, design.face);
      p.rect(23, 19 + bob, 6, 5, design.ink);
      p.rect(25, 20 + bob, 4, 3, design.bodyDark);
      p.rect(27, 20 + bob, 3, 2, design.accent);
      if (strike) {
        p.rect(4, 12 + frame % 2, 5, 5, design.accent);
        p.rect(24, 11 + frame % 2, 5, 5, design.bodyLight);
        p.rect(11 + frame % 2, 4, 10, 2, design.accent);
      } else if (row === 3) {
        p.rect(24 + frame % 2, 14, 6, 5, design.ink);
        p.rect(25 + frame % 2, 15, 4, 3, design.bodyLight);
        p.rect(28 + frame % 2, 13, 3, 3, design.accent);
      }
      break;
    }
    case "ahuizotl": {
      if (row === 5) {
        drawShadow(p);
        p.rect(5, 23, 22, 5, design.ink);
        p.rect(8, 24, 13, 3, design.body);
        p.rect(20, 22, 8, 6, design.ink);
        p.rect(22, 23, 5, 3, design.bodyLight);
        p.rect(4, 21, 5, 2, design.ink);
        p.rect(2, 19, 5, 3, design.bodyDark);
        p.rect(1, 18, 2, 2, design.bodyLight);
        p.rect(0, 17, 2, 2, design.bodyLight);
        return;
      }
      drawShadow(p);
      // Front-facing otter with its signature extra hand curled above one shoulder.
      p.rect(22, 18 + bob, 5, 4, design.ink);
      p.rect(24, 14 + bob, 5, 6, design.ink);
      p.rect(26, 10 + bob, 5, 6, design.ink);
      p.rect(27, 9 + bob, 3, 5, design.bodyLight);
      p.rect(26, 7 + bob, 2, 4, design.bodyLight);
      p.rect(28, 7 + bob, 2, 4, design.bodyLight);
      p.rect(30, 8 + bob, 2, 4, design.bodyLight);
      p.rect(9, 22 + bob, 5, 7, design.ink);
      p.rect(10, 24 + bob, 3, 4, design.bodyDark);
      p.rect(18, 22 + bob, 5, 7, design.ink);
      p.rect(19, 24 + bob, 3, 4, design.bodyDark);
      p.rect(8, 15 + bob, 16, 12, design.ink);
      p.rect(10, 17 + bob, 12, 8, design.body);
      p.rect(11, 18 + bob, 10, 3, design.bodyLight);
      p.rect(7, 16 + bob, 5, 8, design.ink);
      p.rect(8, 19 + bob, 5, 4, design.body);
      p.rect(21, 16 + bob, 5, 8, design.ink);
      p.rect(21, 19 + bob, 5, 4, design.body);
      p.rect(9, 7 + bob, 14, 13, design.ink);
      p.rect(11, 9 + bob, 10, 9, design.face);
      p.rect(7, 7 + bob, 6, 7, design.ink);
      p.rect(8, 9 + bob, 4, 4, design.bodyDark);
      p.rect(19, 7 + bob, 6, 7, design.ink);
      p.rect(20, 9 + bob, 4, 4, design.bodyDark);
      p.rect(12, 12 + bob, 2, 2, design.eye);
      p.rect(18, 12 + bob, 2, 2, design.eye);
      p.rect(13, 15 + bob, 6, 3, design.ink);
      p.rect(14, 16 + bob, 4, 1, design.bodyLight);
      p.rect(10, 6 + bob, 5, 3, design.hair);
      if (strike) {
        p.rect(27 + (frame % 2), 5 + (frame % 2), 3, 3, design.accent);
        p.rect(23, 8 + (frame % 2), 4, 3, design.bodyLight);
        p.rect(4, 12 + frame % 2, 3, 3, design.accent);
      } else if (row === 3) {
        p.rect(27 + frame % 2, 7, 4, 4, design.ink);
        p.rect(28 + frame % 2, 8, 3, 2, design.accent);
        p.rect(24 + frame % 2, 10, 4, 3, design.bodyLight);
      }
      break;
    }
    case "ratatoskr": {
      if (row === 5) {
        drawShadow(p);
        p.rect(9, 23, 16, 6, design.ink);
        p.rect(11, 24, 11, 3, design.bodyDark);
        p.rect(20, 21, 8, 7, design.ink);
        p.rect(22, 22, 5, 4, design.face);
        p.rect(24, 23, 1, 1, design.eye);
        p.rect(5, 18, 8, 6, design.ink);
        p.rect(6, 19, 6, 4, design.bodyDark);
        p.rect(26, 18, 4, 4, design.bodyLight);
        return;
      }
      const hop = row === 1 ? [0, -2, -1, 0][frame] : bob;
      drawShadow(p);
      // Courier squirrel: enormous curled tail frames a compact front-facing body.
      p.rect(2, 15 + hop, 8, 10, design.ink);
      p.rect(3, 13 + hop, 7, 12, design.bodyDark);
      p.rect(5, 14 + hop, 6, 8, design.body);
      p.rect(3, 20 + hop, 6, 4, design.bodyLight);
      p.rect(10 + step, 23 + hop, 5, 6, design.ink);
      p.rect(11 + step, 24 + hop, 3, 4, design.bodyDark);
      p.rect(17 - step, 23 + hop, 5, 6, design.ink);
      p.rect(18 - step, 24 + hop, 3, 4, design.bodyDark);
      p.rect(10, 17 + hop, 13, 10, design.ink);
      p.rect(12, 18 + hop, 9, 7, design.body);
      p.rect(13, 18 + hop, 7, 3, design.bodyLight);
      p.rect(8, 7 + hop, 16, 14, design.ink);
      p.rect(10, 9 + hop, 12, 10, design.face);
      p.rect(7, 4 + hop, 7, 10, design.ink);
      p.rect(9, 6 + hop, 4, 7, design.bodyDark);
      p.rect(18, 4 + hop, 7, 10, design.ink);
      p.rect(19, 6 + hop, 4, 7, design.bodyDark);
      p.rect(11, 12 + hop, 2, 2, design.ink);
      p.rect(19, 12 + hop, 2, 2, design.ink);
      p.rect(12, 12 + hop, 1, 1, design.accent);
      p.rect(20, 12 + hop, 1, 1, design.accent);
      p.rect(14, 15 + hop, 4, 2, design.bodyDark);
      p.rect(13, 19 + hop, 7, 5, design.ink);
      p.rect(14, 20 + hop, 5, 3, design.accent);
      p.rect(15, 20 + hop, 2, 1, design.bodyLight);
      if (row === 2) {
        p.rect(4, 15 + hop, 7, 5, design.ink);
        p.rect(5, 16 + hop, 5, 3, design.bodyDark);
        p.rect(21, 14 + hop, 5, 4, design.accent);
        p.rect(25, 12 + hop, 4, 4, design.bodyLight);
      } else if (row === 3) {
        const shot = frame;
        p.rect(22 + shot, 12 - (shot % 2), 5, 5, design.ink);
        p.rect(23 + shot, 13 - (shot % 2), 3, 3, design.accent);
        p.rect(24 + shot, 13 - (shot % 2), 1, 1, design.bodyLight);
      }
      break;
    }
    case "carbunclo": {
      if (row === 5) {
        drawShadow(p);
        p.rect(5, 22, 23, 6, design.ink);
        p.rect(8, 23, 15, 4, design.body);
        p.rect(20, 21, 9, 7, design.ink);
        p.rect(22, 22, 6, 4, design.face);
        p.rect(24, 23, 1, 1, design.eye);
        p.rect(15, 21, 5, 2, design.ink);
        p.rect(16, 21, 3, 1, design.accent);
        return;
      }
      drawShadow(p);
      p.rect(8 + step, 22 + bob, 5, 7, design.ink);
      p.rect(9 + step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(19 - step, 22 + bob, 5, 7, design.ink);
      p.rect(20 - step, 24 + bob, 3, 4, design.bodyDark);
      p.rect(9, 14 + bob, 14, 13, design.ink);
      p.rect(11, 16 + bob, 10, 9, design.body);
      p.rect(12, 17 + bob, 8, 4, design.bodyLight);
      p.rect(8, 13 + bob, 5, 7, design.ink);
      p.rect(9, 15 + bob, 4, 4, design.bodyDark);
      p.rect(19, 13 + bob, 5, 7, design.ink);
      p.rect(20, 15 + bob, 4, 4, design.bodyDark);
      p.rect(9, 7 + bob, 14, 13, design.ink);
      p.rect(11, 9 + bob, 10, 9, design.face);
      p.rect(12, 12 + bob, 2, 2, design.eye);
      p.rect(18, 12 + bob, 2, 2, design.eye);
      p.rect(14, 16 + bob, 5, 2, design.bodyDark);
      p.rect(12, 6 + bob, 8, 5, design.ink);
      // The large forehead jewel and segmented shell define the Carbunclo.
      p.rect(13, 3 + bob, 6, 7, design.ink);
      p.rect(14, 4 + bob, 4, 5, design.accent);
      p.rect(15, 4 + bob, 2, 2, design.metal);
      p.rect(10, 19 + bob, 12, 5, design.bodyDark);
      p.rect(11, 20 + bob, 3, 2, design.bodyLight);
      p.rect(17, 20 + bob, 3, 2, design.bodyLight);
      if (strike) {
        p.rect(14 + frame, 1, 4, 3, design.accent);
        p.rect(17 + frame, 2, 3, 3, design.bodyLight);
        p.rect(5, 12 + frame % 2, 3, 3, design.accent);
      } else if (row === 3) {
        p.rect(18 + frame, 5, 5, 5, design.ink);
        p.rect(19 + frame, 6, 3, 3, design.accent);
        p.rect(22 + frame, 5, 3, 3, design.bodyLight);
      }
      break;
    }
    case "alicanto": {
      if (row === 5) {
        drawShadow(p);
        p.rect(7, 22, 20, 6, design.ink);
        p.rect(10, 23, 13, 3, design.bodyDark);
        p.rect(19, 20, 9, 7, design.ink);
        p.rect(21, 21, 6, 4, design.body);
        p.rect(24, 22, 2, 1, design.eye);
        p.rect(6, 19, 8, 4, design.ink);
        p.rect(7, 20, 6, 2, design.bodyLight);
        return;
      }
      drawShadow(p);
      const flap = row === 1 ? [0, -2, 0, 2][frame] : strike ? [0, -2, -4, -2][frame] : 0;
      p.rect(12, 23 + bob, 4, 6, design.ink);
      p.rect(13, 25 + bob, 2, 3, design.bodyDark);
      p.rect(18, 23 + bob, 4, 6, design.ink);
      p.rect(19, 25 + bob, 2, 3, design.bodyDark);
      p.rect(10, 15 + bob, 13, 11, design.ink);
      p.rect(12, 17 + bob, 9, 7, design.body);
      p.rect(13, 17 + bob, 7, 3, design.bodyLight);
      p.rect(4, 10 - flap + bob, 10, 13 + flap, design.ink);
      p.rect(6, 11 - flap + bob, 7, 10 + flap, design.bodyDark);
      p.rect(7, 12 - flap + bob, 5, 6, design.bodyLight);
      p.rect(3, 16 - flap + bob, 4, 4, design.accent);
      p.rect(21, 10 + flap + bob, 10, 13 - flap, design.ink);
      p.rect(22, 11 + flap + bob, 7, 10 - flap, design.bodyDark);
      p.rect(23, 12 + flap + bob, 5, 6, design.bodyLight);
      p.rect(27, 16 + flap + bob, 4, 4, design.accent);
      p.rect(10, 6 + bob, 13, 13, design.ink);
      p.rect(12, 8 + bob, 9, 9, design.body);
      p.rect(13, 9 + bob, 7, 5, design.bodyLight);
      p.rect(11, 4 + bob, 3, 6, design.ink);
      p.rect(12, 5 + bob, 2, 4, design.accent);
      p.rect(18, 4 + bob, 4, 6, design.ink);
      p.rect(19, 5 + bob, 2, 4, design.accent);
      p.rect(11, 13 + bob, 11, 5, design.face);
      p.rect(13, 14 + bob, 2, 2, design.ink);
      p.rect(18, 14 + bob, 2, 2, design.ink);
      p.rect(14, 16 + bob, 5, 2, design.ink);
      p.rect(14, 17 + bob, 4, 1, design.bodyDark);
      p.rect(14, 26 + bob, 2, 3, design.ink);
      p.rect(19, 26 + bob, 2, 3, design.ink);
      p.rect(12, 28 + bob, 5, 1, design.accent);
      p.rect(18, 28 + bob, 5, 1, design.accent);
      if (strike) {
        p.rect(14, 2 + frame % 2, 4, 3, design.accent);
        p.rect(6, 8 - (frame % 2), 3, 3, design.bodyLight);
        p.rect(25, 8 - (frame % 2), 3, 3, design.bodyLight);
      } else if (row === 3) {
        p.rect(22 + frame % 2, 7, 5, 6, design.ink);
        p.rect(23 + frame % 2, 8, 3, 4, design.accent);
        p.rect(27 + frame % 2, 10, 3, 2, design.bodyLight);
      }
      break;
    }
    case "yeti": {
      if (row === 5) {
        drawShadow(p);
        p.rect(4, 22, 25, 7, design.ink);
        p.rect(7, 23, 19, 4, design.body);
        p.rect(19, 20, 10, 8, design.ink);
        p.rect(21, 22, 7, 4, design.face);
        p.rect(25, 23, 2, 1, design.eye);
        p.rect(8, 20, 6, 3, design.ink);
        return;
      }
      drawShadow(p);
      const stomp = strike && frame % 2 === 0 ? 1 : 0;
      // Broad front-facing snow brute with a short face, heavy mittens and icy crown.
      p.rect(7 + step, 23 + bob + stomp, 7, 6, design.ink);
      p.rect(9 + step, 25 + bob + stomp, 4, 3, design.bodyDark);
      p.rect(19 - step, 23 + bob, 7, 6, design.ink);
      p.rect(20 - step, 25 + bob, 4, 3, design.bodyDark);
      p.rect(5, 13 + bob, 22, 16, design.ink);
      p.rect(7, 15 + bob, 18, 12, design.body);
      p.rect(8, 16 + bob, 16, 6, design.bodyLight);
      p.rect(10, 22 + bob, 12, 4, design.bodyDark);
      p.rect(2, 16 + bob, 8, 10, design.ink);
      p.rect(3, 19 + bob, 7, 6, design.body);
      p.rect(1, 22 + bob, 8, 5, design.ink);
      p.rect(22, 16 + bob, 8, 10, design.ink);
      p.rect(22, 19 + bob, 7, 6, design.body);
      p.rect(23, 22 + bob, 8, 5, design.ink);
      p.rect(9, 7 + bob, 14, 13, design.ink);
      p.rect(11, 9 + bob, 10, 9, design.bodyLight);
      p.rect(10, 11 + bob, 12, 5, design.face);
      p.rect(12, 12 + bob, 2, 2, design.eye);
      p.rect(18, 12 + bob, 2, 2, design.eye);
      p.rect(14, 16 + bob, 5, 2, design.bodyDark);
      p.rect(8, 5 + bob, 5, 5, design.bodyLight);
      p.rect(13, 4 + bob, 6, 5, design.bodyLight);
      p.rect(19, 5 + bob, 5, 5, design.bodyLight);
      p.rect(13, 6 + bob, 6, 2, design.accent);
      if (strike) {
        p.rect(2, 11 + (frame % 2), 5, 6, design.bodyLight);
        p.rect(25, 11 + (frame % 2), 5, 6, design.bodyLight);
        p.rect(13, 2 + (frame % 2), 6, 3, design.accent);
        p.rect(14, 1 + frame % 2, 4, 2, design.bodyLight);
      } else if (row === 3) {
        p.rect(24 + frame, 12, 6, 6, design.ink);
        p.rect(25 + frame, 13, 4, 4, design.bodyLight);
        p.rect(27 + frame, 14, 2, 2, design.accent);
      }
      break;
    }
  }
}

/**
 * Per-creature pixel embellishments. Kept inside the 32px sprite so they
 * survive nearest-neighbour scaling and never affect combat hitboxes.
 */
function drawFolkloreIdentity(p: PixelPainter, actor: NativePixelActorId, d: ActorDesign, row: number, frame: number) {
  if (row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.defeat) return;
  const flutter = frame % 2;
  switch (actor) {
    case "curupira":
      // Ember hair and a trail of forest fireflies.
      p.rect(11, 2 + flutter, 3, 2, "#ffb64e");
      p.rect(17, 1 + flutter, 2, 3, "#f66d36");
      p.rect(4 + frame, 23, 2, 2, "#b8e27b", .8);
      break;
    case "amarok":
      // Crescent moon crest and glacial breath.
      p.rect(13, 2, 7, 2, "#d7eff5");
      p.rect(15, 2, 5, 1, d.bodyDark);
      p.rect(25 + flutter, 15, 3, 1, "#a6edf0", .8);
      break;
    case "iara":
      // Coral tiara and pearlescent water droplets.
      p.rect(12, 3, 2, 3, "#f4c88c");
      p.rect(18, 3, 2, 3, "#f4c88c");
      p.rect(26, 21 - flutter, 2, 3, "#a3f2e4", .8);
      break;
    case "sprout":
      // Two asymmetrical sprouting leaves.
      p.rect(11, 3 - flutter, 5, 2, "#b7df67");
      p.rect(17, 1 + flutter, 3, 4, "#6cae4a");
      break;
    case "boto":
      // Pink river sparkles and a golden hat band.
      p.rect(9, 6, 14, 1, "#f1d58a");
      p.rect(5, 21 - flutter, 2, 2, "#f5a4bc", .8);
      break;
    case "raiju":
      // Forked lightning horns.
      p.rect(10, 2, 2, 4, "#f7e88c");
      p.rect(8, 1 + flutter, 3, 2, "#f5cf52");
      p.rect(22, 2, 2, 4, "#f7e88c");
      p.rect(24, 1 + flutter, 2, 2, "#f5cf52");
      break;
    case "mapinguari":
      // Single cyclopean eye and bark scars.
      p.rect(14, 12, 5, 4, "#211a19");
      p.rect(16, 13, 2, 2, "#f4cf79");
      p.rect(6, 19, 2, 6, "#bc8c5a", .8);
      break;
    case "kappa":
      // Crown bowl with rippling water.
      p.rect(12, 3, 9, 2, "#2e6d67");
      p.rect(14, 3 + flutter, 5, 1, "#9cf1d9");
      break;
    case "kelpie":
      // Riverweed mane and luminous foam.
      p.rect(9, 6, 2, 6, "#65b7a5");
      p.rect(23, 18 - flutter, 4, 2, "#b3efe5", .8);
      break;
    case "ahuizotl":
      // Distinctive hand-like tail tip.
      p.rect(27, 18, 3, 3, "#31252c");
      p.rect(28, 16 - flutter, 2, 3, "#b9957d");
      break;
    case "ratatoskr":
      // Acorn charm and twitching tail highlight.
      p.rect(26, 9 + flutter, 3, 2, "#e7b96c");
      p.rect(5, 17, 3, 3, "#8a5132");
      break;
    case "carbunclo":
      // A glowing gemstone mounted on its forehead.
      p.rect(14, 5, 5, 4, "#173e48");
      p.rect(15, 5 + flutter, 3, 2, "#80f7ef");
      break;
    case "alicanto":
      // Ore-encrusted feathers and a gold shimmer.
      p.rect(7, 12, 3, 2, "#f5d987");
      p.rect(22, 14, 3, 2, "#f5d987");
      p.rect(16, 3 - flutter, 2, 2, "#fff3b6");
      break;
    case "yeti":
      // Jagged ice crown and snowy breath.
      p.rect(10, 4, 3, 3, "#ecfbff");
      p.rect(19, 4, 3, 3, "#ecfbff");
      p.rect(26, 17 + flutter, 3, 2, "#b7e9f5", .85);
      break;
    default:
      break;
  }
}

function drawActorFrame(
  context: CanvasRenderingContext2D,
  actor: NativePixelActorId,
  row: number,
  frame: number,
) {
  const p = createPainter(context);
  if (drawFolklardPixelActorFrame(p, actor, row, frame)) return;
  const design = DESIGNS[actor];

  switch (design.kind) {
    case "npc":
    case "curupira":
      drawHumanActor(p, actor, design, row, frame);
      break;
    case "sprout":
      drawSprout(p, design, row, frame);
      break;
    case "amarok":
      drawAmarok(p, design, row, frame);
      break;
    case "iara":
      drawIara(p, design, row, frame);
      break;
    case "boto":
      drawBoto(p, design, row, frame);
      break;
    case "raiju":
      drawRaiju(p, design, row, frame);
      break;
    case "nativeCreature":
      drawNativeFolkloreCreature(p, actor, design, row, frame);
      break;
  }

  if (design.kind !== "npc") drawFolkloreIdentity(p, actor, design, row, frame);

  // Unique animated crest for every folklore actor, excluding the guild NPCs.
  if (design.kind !== "npc" && row !== NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.defeat) {
    const shimmer = frame % 2 === 0;
    p.rect(15, 1, 3, 2, design.ink);
    p.rect(16, 1, 1, 2, design.accent);
    if (shimmer) {
      p.rect(12, 3, 2, 1, design.accent, 0.75);
      p.rect(20, 3, 2, 1, design.accent, 0.75);
    }
    if (actor === "raiju" || actor === "amarok" || actor === "yeti") {
      p.rect(11, 4, 2, 2, design.accent, 0.8);
      p.rect(21, 4, 2, 2, design.accent, 0.8);
    } else if (actor === "iara" || actor === "boto" || actor === "kelpie" || actor === "kappa") {
      p.rect(12, 5, 2, 1, design.bodyLight, 0.85);
      p.rect(20, 5, 2, 1, design.bodyLight, 0.85);
    }
  }

  // Action-readable magical impact accents, animated independently of silhouette.
  if (design.kind !== "npc" && (row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.attack || row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.shoot)) {
    const swing = frame % 4;
    const x = row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.shoot ? 24 + swing : 25 - swing;
    p.rect(x, 13 - (swing % 2), 3, 2, design.accent, 0.95);
    p.rect(x + 1, 11 - (swing % 2), 1, 2, design.bodyLight, 0.9);
    p.rect(4 + swing, 16, 2, 1, design.accent, 0.75);
  }
  if (design.kind !== "npc" && row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.idle && frame % 2 === 0) {
    p.rect(5, 19, 2, 2, design.accent, 0.55);
    p.rect(25, 21, 2, 2, design.bodyLight, 0.6);
  }

  if (row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.damage) {
    // A compact hit flash gives every silhouette a readable damage reaction.
    const recoil = frame % 2;
    p.rect(3 + recoil, 9, 3, 2, design.bodyLight);
    p.rect(5, 7 + recoil, 2, 3, design.accent);
    p.rect(25 - recoil, 11, 3, 2, design.accent);
    p.rect(27, 9 + recoil, 2, 3, design.bodyLight);
  } else if (row === NATIVE_PIXEL_ACTOR_ANIMATION_ROWS.defeat) {
    // Small drifting stars keep the four-frame knockout cycle alive after the
    // actor's own folklore silhouette has fallen into its distinct pose.
    const drift = frame;
    p.rect(3 + drift, 19 - (drift % 2), 2, 1, design.bodyLight, 0.9);
    p.rect(27 - drift, 17 + (drift % 2), 1, 2, design.accent, 0.8);
  }
}

function validateNativePixelActorRequest(
  actorId: NativePixelActorId,
  frameWidth: number,
  frameHeight: number,
) {
  if (!Object.hasOwn(DESIGNS, actorId)) {
    throw new Error(`Ator pixelado de Folklard desconhecido: ${String(actorId)}`);
  }
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight) || frameWidth < 1 || frameHeight < 1) {
    throw new RangeError("Os quadros do ator precisam ter largura e altura inteiras maiores que zero.");
  }
}

function createNativePixelActorSheetCanvas(
  actorId: NativePixelActorId,
  frameWidth: number,
  frameHeight: number,
): HTMLCanvasElement {
  validateNativePixelActorRequest(actorId, frameWidth, frameHeight);
  if (typeof document === "undefined") {
    throw new Error("A spritesheet pixelada precisa ser gerada em um navegador com canvas.");
  }

  const sheetWidth = frameWidth * COLUMNS;
  const sheetHeight = frameHeight * ROWS;
  const sheet = document.createElement("canvas");
  sheet.width = sheetWidth;
  sheet.height = sheetHeight;
  const sheetContext = sheet.getContext("2d", { alpha: true });
  if (!sheetContext) throw new Error(`Não foi possível criar o canvas do ator: ${actorId}`);
  sheetContext.imageSmoothingEnabled = false;
  sheetContext.clearRect(0, 0, sheetWidth, sheetHeight);

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = GRID;
  frameCanvas.height = GRID;
  const frameContext = frameCanvas.getContext("2d", { alpha: true });
  if (!frameContext) throw new Error(`Não foi possível criar os quadros do ator: ${actorId}`);
  frameContext.imageSmoothingEnabled = false;

  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    frameContext.clearRect(0, 0, GRID, GRID);
    drawActorFrame(frameContext, actorId, row, column);
    sheetContext.drawImage(frameCanvas, column * frameWidth, row * frameHeight, frameWidth, frameHeight);
  }

  return sheet;
}

/**
 * Returns a browser data URL for a complete transparent 4×6 actor sheet.
 * Six rows map to idle, walk, attack, shoot, damage, and defeat; each has four
 * frames. This helper uses Canvas directly and does not require a Phaser Scene.
 */
export function createNativePixelActorDataUrl(
  actorId: NativePixelActorId,
  frameWidth = GRID,
  frameHeight = GRID,
): string {
  const cacheKey = `${actorId}:${frameWidth}x${frameHeight}`;
  const cached = NATIVE_PIXEL_ACTOR_DATA_URL_CACHE.get(cacheKey);
  if (cached) return cached;

  const dataUrl = createNativePixelActorSheetCanvas(actorId, frameWidth, frameHeight).toDataURL("image/png");
  NATIVE_PIXEL_ACTOR_DATA_URL_CACHE.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * Generates and registers the same transparent actor sheet in Phaser.
 * Use NATIVE_PIXEL_ACTOR_ANIMATION_MAP to look up the named animation rows.
 */
export function createNativePixelActorSheet(
  scene: Scene,
  actorId: NativePixelActorId,
  textureKey: string,
  frameWidth: number,
  frameHeight: number,
): string {
  validateNativePixelActorRequest(actorId, frameWidth, frameHeight);
  if (!textureKey.trim()) throw new Error("A textura do ator precisa de uma chave.");

  const sheetWidth = frameWidth * COLUMNS;
  const sheetHeight = frameHeight * ROWS;
  if (scene.textures.exists(textureKey)) {
    const current = scene.textures.get(textureKey);
    const source = current.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    if (
      current.frameTotal === FRAME_COUNT + 1
      && current.has(String(FRAME_COUNT - 1))
      && source.width === sheetWidth
      && source.height === sheetHeight
    ) {
      return textureKey;
    }
    scene.textures.remove(textureKey);
  }

  const sheet = createNativePixelActorSheetCanvas(actorId, frameWidth, frameHeight);

  const texture = scene.textures.addSpriteSheet(textureKey, sheet as unknown as HTMLImageElement, {
    frameWidth,
    frameHeight,
    endFrame: FRAME_COUNT - 1,
  });
  if (!texture) throw new Error(`Não foi possível registrar a textura do ator: ${textureKey}`);
  if (texture.frameTotal !== FRAME_COUNT + 1 || !texture.has(String(FRAME_COUNT - 1))) {
    scene.textures.remove(textureKey);
    throw new Error(`A grade 4×6 da textura do ator ficou incompleta: ${textureKey}`);
  }
  return textureKey;
}
