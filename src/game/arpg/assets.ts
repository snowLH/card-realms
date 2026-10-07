import type { Scene } from "phaser";

export type ArpgAnimationDefinition = {
  frameRate: number;
  repeat: number;
} & (
  | { row: number; startFrame?: never; endFrame?: never }
  | { row?: never; startFrame: number; endFrame: number }
);

export type ArpgSpriteSheetDefinition = {
  textureKey: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns?: number;
  rows?: number;
  scale: number;
  animationKeyPrefix?: string;
  animations?: Readonly<Record<string, ArpgAnimationDefinition>>;
};

const GENERATED_PIXEL_ENEMY_ANIMATIONS = {
  idle: { row: 0, frameRate: 5, repeat: -1 },
  walk: { row: 1, frameRate: 9, repeat: -1 },
  attack: { row: 2, frameRate: 12, repeat: 0 },
  shoot: { row: 3, frameRate: 12, repeat: 0 },
  damage: { row: 4, frameRate: 10, repeat: 0 },
  defeat: { row: 5, frameRate: 7, repeat: 0 },
} as const satisfies Readonly<Record<string, ArpgAnimationDefinition>>;

const STANDARD_GUILD_NPC_ANIMATIONS = {
  idle: { row: 0, frameRate: 5, repeat: -1 },
  walking: { row: 1, frameRate: 8, repeat: -1 },
  talking: { row: 2, frameRate: 5, repeat: -1 },
  working: { row: 3, frameRate: 6, repeat: -1 },
  studying: { row: 3, frameRate: 6, repeat: -1 },
} as const satisfies Readonly<Record<string, ArpgAnimationDefinition>>;

export const ARPG_ASSET_MANIFEST = {
  runtimeTextureKeys: {
    dungeonBackground: "dungeon-arena",
  },
  environments: {
    mataEncounter: { path: "/art/dungeon-forest-background-v3.webp" },
    archipelago: { path: "/art/dungeon-archipelago-background-v3.webp" },
    runicMountains: { path: "/art/dungeon-mountain-background-v3.webp" },
  },
  player: {
    textureKey: "folklard-cartographer-player",
    animationKeyPrefix: "cartographer-player",
    frameWidth: 189,
    frameHeight: 189,
    frameCount: 52,
    columns: 4,
    rows: 13,
    scale: 0.46,
    animations: {
      idle: { row: 0, frameRate: 5, repeat: -1 },
      "walk-down": { row: 1, frameRate: 9, repeat: -1 },
      "walk-up": { row: 2, frameRate: 9, repeat: -1 },
      "walk-left": { row: 3, frameRate: 9, repeat: -1 },
      "walk-right": { row: 4, frameRate: 9, repeat: -1 },
      attack: { row: 5, frameRate: 12, repeat: 0 },
      hit: { row: 6, frameRate: 12, repeat: 0 },
      dodge: { row: 7, frameRate: 14, repeat: 0 },
      interact: { row: 8, frameRate: 7, repeat: 0 },
      victory: { row: 9, frameRate: 8, repeat: 0 },
      ko: { row: 10, frameRate: 7, repeat: 0 },
      "cast-skill-1": { row: 11, frameRate: 10, repeat: 0 },
      "cast-skill-2": { row: 12, frameRate: 10, repeat: 0 },
    },
  },
  characterAtlases: {
    folkloreCreatures: {
      textureKey: "folklore-atlas",
      path: "/art/folklore-creatures-chibi-portraits-v1.webp",
      frameWidth: 250,
      frameHeight: 250,
      frameCount: 25,
      scale: 1,
    },
    folkloreCreaturesSecond: {
      textureKey: "folklore-atlas-2",
      path: "/art/folklore-creatures-second-atlas-chibi-portraits-v1.webp",
      frameWidth: 250,
      frameHeight: 250,
      frameCount: 25,
      scale: 1,
    },
  },
  enemies: {
    "curupira-boss": {
      textureKey: "folklard-curupira-boss",
      animationKeyPrefix: "curupira-boss",
      path: "/art/monster-curupira-ancestral-spritesheet-v2.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.32,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "amarok-boss": {
      textureKey: "folklard-amarok-boss",
      animationKeyPrefix: "amarok-boss",
      path: "/art/monster-amarok-elder-wolf-spritesheet-v2.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.32,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "iara-boss": {
      textureKey: "folklard-iara-boss",
      animationKeyPrefix: "iara-boss",
      path: "/art/monster-iara-boss-spritesheet-v2.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.32,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "sprout-enemy": {
      textureKey: "folklard-sprout-enemy",
      animationKeyPrefix: "sprout-enemy",
      path: "/art/monster-sprout-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "boto-enemy": {
      textureKey: "folklard-boto-enemy",
      animationKeyPrefix: "boto-enemy",
      path: "/art/monster-boto-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "raiju-enemy": {
      textureKey: "folklard-raiju-enemy",
      animationKeyPrefix: "raiju-enemy",
      path: "/art/monster-raiju-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "shade-enemy": {
      textureKey: "folklard-shade-enemy",
      animationKeyPrefix: "shade-enemy",
      path: "/art/monster-shade-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "thorn-enemy": {
      textureKey: "folklard-thorn-enemy",
      animationKeyPrefix: "thorn-enemy",
      path: "/art/monster-thorn-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "corrupted-guardian-enemy": {
      textureKey: "folklard-corrupted-guardian-enemy",
      animationKeyPrefix: "corrupted-guardian-enemy",
      path: "/art/monster-corrupted-guardian-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "mapinguari-enemy": {
      textureKey: "folklard-mapinguari-enemy",
      animationKeyPrefix: "mapinguari-enemy",
      path: "/art/monster-mapinguari-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.32,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "carbunclo-enemy": {
      textureKey: "folklard-carbunclo-enemy",
      animationKeyPrefix: "carbunclo-enemy",
      path: "/art/monster-carbunclo-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "ahuizotl-enemy": {
      textureKey: "folklard-ahuizotl-enemy",
      animationKeyPrefix: "ahuizotl-enemy",
      path: "/art/monster-ahuizotl-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "alicanto-enemy": {
      textureKey: "folklard-alicanto-enemy",
      animationKeyPrefix: "alicanto-enemy",
      path: "/art/monster-alicanto-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "kappa-enemy": {
      textureKey: "folklard-kappa-enemy",
      animationKeyPrefix: "kappa-enemy",
      path: "/art/monster-kappa-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "kelpie-enemy": {
      textureKey: "folklard-kelpie-enemy",
      animationKeyPrefix: "kelpie-enemy",
      path: "/art/monster-kelpie-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "ratatoskr-enemy": {
      textureKey: "folklard-ratatoskr-enemy",
      animationKeyPrefix: "ratatoskr-enemy",
      path: "/art/monster-ratatoskr-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
    "yeti-enemy": {
      textureKey: "folklard-yeti-enemy",
      animationKeyPrefix: "yeti-enemy",
      path: "/art/monster-yeti-enemy-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.25,
      animations: GENERATED_PIXEL_ENEMY_ANIMATIONS,
    },
  },
  guildNpcs: {
    blacksmith: {
      textureKey: "folklard-guild-blacksmith",
      animationKeyPrefix: "guild-blacksmith",
      path: "/art/guild-blacksmith-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.4,
      animations: STANDARD_GUILD_NPC_ANIMATIONS,
    },
    merchant: {
      textureKey: "folklard-guild-merchant",
      animationKeyPrefix: "guild-merchant",
      path: "/art/guild-merchant-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.4,
      animations: STANDARD_GUILD_NPC_ANIMATIONS,
    },
    archivist: {
      textureKey: "folklard-guild-archivist",
      animationKeyPrefix: "guild-archivist",
      path: "/art/guild-archivist-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.4,
      animations: STANDARD_GUILD_NPC_ANIMATIONS,
    },
    bestiaryKeeper: {
      textureKey: "folklard-guild-bestiary-keeper",
      animationKeyPrefix: "guild-bestiary-keeper",
      path: "/art/guild-bestiary-keeper-spritesheet-v1.webp",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 24,
      columns: 4,
      rows: 6,
      scale: 0.4,
      animations: {
        idle: { row: 0, frameRate: 5, repeat: -1 },
        studying: { row: 3, frameRate: 6, repeat: -1 },
        talking: { row: 2, frameRate: 5, repeat: -1 },
        walking: { row: 1, frameRate: 8, repeat: -1 },
      },
    },
  },
  props: {
    treasureChest: {
      textureKey: "folklard-treasure-chest",
      animationKeyPrefix: "folklard-treasure-chest",
      path: "/art/treasure-chest-spritesheet-v2.webp",
      frameWidth: 627,
      frameHeight: 627,
      frameCount: 4,
      columns: 2,
      rows: 2,
      scale: 92 / 627,
      displaySize: 92,
      frameBounds: {
        0: { top: 172, baseline: 574 },
        1: { top: 169, baseline: 578 },
        2: { top: 36, baseline: 546 },
        3: { top: 35, baseline: 548 },
      },
      animations: {
        open: { startFrame: 1, endFrame: 3, frameRate: 10, repeat: 0 },
      },
    },
  },
} as const;

export const ARPG_ASSETS = {
  environments: {
    mataEncounter: ARPG_ASSET_MANIFEST.environments.mataEncounter.path,
    archipelago: ARPG_ASSET_MANIFEST.environments.archipelago.path,
    runicMountains: ARPG_ASSET_MANIFEST.environments.runicMountains.path,
  },
  characterAtlases: {
    folkloreCreatures: ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreatures.path,
    folkloreCreaturesSecond: ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreaturesSecond.path,
  },
  enemies: {
    curupiraBoss: ARPG_ASSET_MANIFEST.enemies["curupira-boss"].path,
    amarokBoss: ARPG_ASSET_MANIFEST.enemies["amarok-boss"].path,
    iaraBoss: ARPG_ASSET_MANIFEST.enemies["iara-boss"].path,
    sprout: ARPG_ASSET_MANIFEST.enemies["sprout-enemy"].path,
    boto: ARPG_ASSET_MANIFEST.enemies["boto-enemy"].path,
    raiju: ARPG_ASSET_MANIFEST.enemies["raiju-enemy"].path,
    shade: ARPG_ASSET_MANIFEST.enemies["shade-enemy"].path,
    thorn: ARPG_ASSET_MANIFEST.enemies["thorn-enemy"].path,
    corruptedGuardian: ARPG_ASSET_MANIFEST.enemies["corrupted-guardian-enemy"].path,
  },
  guildNpcs: {
    blacksmith: ARPG_ASSET_MANIFEST.guildNpcs.blacksmith.path,
    merchant: ARPG_ASSET_MANIFEST.guildNpcs.merchant.path,
    archivist: ARPG_ASSET_MANIFEST.guildNpcs.archivist.path,
    bestiaryKeeper: ARPG_ASSET_MANIFEST.guildNpcs.bestiaryKeeper.path,
  },
  props: {
    treasureChest: ARPG_ASSET_MANIFEST.props.treasureChest.path,
  },
} as const;

/** Shared Phaser loader config for manifest-backed sprite sheets. */
export function getArpgSpriteSheetFrameConfig(sheet: Pick<ArpgSpriteSheetDefinition, "frameWidth" | "frameHeight" | "frameCount">) {
  return {
    frameWidth: sheet.frameWidth,
    frameHeight: sheet.frameHeight,
    endFrame: sheet.frameCount - 1,
  };
}

/** Registers row- or frame-range animations using the sheet metadata in the manifest. */
export function registerArpgSpriteSheetAnimations(
  scene: Scene,
  options: {
    textureKey: string;
    animations: Readonly<Record<string, ArpgAnimationDefinition>>;
    columns?: number;
    keyPrefix: string;
  },
) {
  for (const [name, definition] of Object.entries(options.animations)) {
    const key = `${options.keyPrefix}-${name}`;
    if (scene.anims.exists(key)) continue;
    const start = definition.row === undefined
      ? definition.startFrame
      : definition.row * (options.columns ?? 1);
    const end = definition.row === undefined
      ? definition.endFrame
      : start + (options.columns ?? 1) - 1;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(options.textureKey, { start, end }),
      frameRate: definition.frameRate,
      repeat: definition.repeat,
    });
  }
}

function collectPaths(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const ownPath = typeof record.path === "string" ? [record.path] : [];
  return [...ownPath, ...Object.values(record).flatMap(collectPaths)];
}

/** All static files loaded by the ARPG Phaser scenes, useful for checks and preload tooling. */
export const ARPG_ASSET_PATHS = Object.freeze(collectPaths(ARPG_ASSET_MANIFEST));
