import type { DungeonDirection, DungeonRoomSize, DungeonRoomType } from "./types";
import type { SeededRandom } from "./rng";

export type RoomTemplateDefinition = {
  id: string;
  biome: string;
  type: DungeonRoomType;
  size: DungeonRoomSize;
  pattern: RoomPattern;
  widthTiles: number;
  heightTiles: number;
  allowedDoors: readonly DungeonDirection[];
  enemySpawnPoints: number;
  rewardSpawnPoints: number;
  layers: readonly string[];
};

export type RoomPattern =
  | "clearing" | "ruins" | "river" | "roots" | "crystals" | "shrine" | "altar"
  | "hollow" | "camp" | "market" | "ancestral-arena" | "dock" | "islet" | "reef"
  | "flooded-ruins" | "tempest" | "grotto" | "singing-pool" | "whirlpool" | "sandbar"
  | "deep-lagoon" | "frost-pass" | "rune-ruins" | "glacier" | "crystal-cave"
  | "rune-shrine" | "wind-sanctum" | "frost-hollow" | "stone-shelter" | "mountain-market"
  | "summit-arena";

const ALL_DOORS: readonly DungeonDirection[] = ["north", "east", "south", "west"];
const BASE_LAYERS = [
  "GROUND", "GROUND_DETAILS", "WATER", "DECORATION_BOTTOM", "WALLS",
  "COLLISION", "OBJECTS", "CHARACTERS", "FOREGROUND", "LIGHTS", "EFFECTS",
] as const;

const ROOM_TILE_DIMENSIONS: Record<DungeonRoomSize, { widthTiles: number; heightTiles: number }> = {
  small: { widthTiles: 21, heightTiles: 11 },
  medium: { widthTiles: 31, heightTiles: 15 },
  large: { widthTiles: 37, heightTiles: 17 },
};

function template(id: string, type: DungeonRoomType, size: DungeonRoomSize, pattern: RoomPattern, spawns: number, rewards = 1): RoomTemplateDefinition {
  const dimensions = ROOM_TILE_DIMENSIONS[size];
  return { id, biome: "mata-encantada", type, size, pattern, ...dimensions,
    allowedDoors: ALL_DOORS, enemySpawnPoints: spawns, rewardSpawnPoints: rewards, layers: BASE_LAYERS };
}
export const MATA_ROOM_TEMPLATES: readonly RoomTemplateDefinition[] = [
  template("mata-start-grove", "start", "medium", "clearing", 0, 0),
  template("mata-combat-ruins-a", "combat", "medium", "ruins", 8),
  template("mata-combat-ruins-b", "combat", "medium", "ruins", 8),
  template("mata-combat-river", "combat", "medium", "river", 7),
  template("mata-combat-roots", "combat", "medium", "roots", 9),
  template("mata-combat-crystals", "combat", "large", "crystals", 12),
  template("mata-treasure-shrine", "treasure", "small", "shrine", 0, 2),
  template("mata-event-altar", "event", "small", "altar", 0, 1),
  template("mata-elite-hollow", "elite", "medium", "hollow", 10, 2),
  template("mata-rest-camp", "rest", "small", "camp", 0, 1),
  template("mata-shop-hermit", "shop", "small", "market", 0, 3),
  template("mata-boss-ancestral", "boss", "large", "ancestral-arena", 14, 3),
];

export const MATA_ROOM_TEMPLATE_BY_ID = new Map(MATA_ROOM_TEMPLATES.map((item) => [item.id, item]));

export function pickMataTemplate(type: DungeonRoomType, random: SeededRandom) {
  const options = MATA_ROOM_TEMPLATES.filter((item) => item.type === type);
  if (options.length === 0) throw new Error(`Template ausente para sala ${type}.`);
  return random.pick(options);
}

function maresTemplate(id: string, type: DungeonRoomType, size: DungeonRoomSize, pattern: RoomPattern, spawns: number, rewards = 1): RoomTemplateDefinition {
  const dimensions = ROOM_TILE_DIMENSIONS[size];
  return { id, biome: "arquipelago-das-mares", type, size, pattern, ...dimensions,
    allowedDoors: ALL_DOORS, enemySpawnPoints: spawns, rewardSpawnPoints: rewards, layers: BASE_LAYERS };
}

export const MARES_ROOM_TEMPLATES: readonly RoomTemplateDefinition[] = [
  maresTemplate("mares-start-dock", "start", "medium", "dock", 0, 0),
  maresTemplate("mares-combat-islet-a", "combat", "medium", "islet", 8),
  maresTemplate("mares-combat-islet-b", "combat", "medium", "islet", 8),
  maresTemplate("mares-combat-reef", "combat", "medium", "reef", 7),
  maresTemplate("mares-combat-flooded-ruins", "combat", "medium", "flooded-ruins", 9),
  maresTemplate("mares-combat-tempest", "combat", "large", "tempest", 12),
  maresTemplate("mares-treasure-grotto", "treasure", "small", "grotto", 0, 2),
  maresTemplate("mares-event-singing-pool", "event", "small", "singing-pool", 0, 1),
  maresTemplate("mares-elite-whirlpool", "elite", "medium", "whirlpool", 10, 2),
  maresTemplate("mares-rest-sandbar", "rest", "small", "sandbar", 0, 1),
  maresTemplate("mares-shop-floating-market", "shop", "small", "market", 0, 3),
  maresTemplate("mares-boss-deep-lagoon", "boss", "large", "deep-lagoon", 14, 3),
];

export const MARES_ROOM_TEMPLATE_BY_ID = new Map(MARES_ROOM_TEMPLATES.map((item) => [item.id, item]));

function runicTemplate(id: string, type: DungeonRoomType, size: DungeonRoomSize, pattern: RoomPattern, spawns: number, rewards = 1): RoomTemplateDefinition {
  const dimensions = ROOM_TILE_DIMENSIONS[size];
  return { id, biome: "montanhas-runicas", type, size, pattern, ...dimensions,
    allowedDoors: ALL_DOORS, enemySpawnPoints: spawns, rewardSpawnPoints: rewards, layers: BASE_LAYERS };
}

export const RUNIC_ROOM_TEMPLATES: readonly RoomTemplateDefinition[] = [
  runicTemplate("runic-start-frost-pass", "start", "medium", "frost-pass", 0, 0),
  runicTemplate("runic-combat-rune-ruins-a", "combat", "medium", "rune-ruins", 8),
  runicTemplate("runic-combat-rune-ruins-b", "combat", "medium", "rune-ruins", 8),
  runicTemplate("runic-combat-glacier", "combat", "medium", "glacier", 7),
  runicTemplate("runic-combat-crystal-cave", "combat", "medium", "crystal-cave", 9),
  runicTemplate("runic-combat-wind-pass", "combat", "large", "tempest", 12),
  runicTemplate("runic-treasure-rune-shrine", "treasure", "small", "rune-shrine", 0, 2),
  runicTemplate("runic-event-wind-sanctum", "event", "small", "wind-sanctum", 0, 1),
  runicTemplate("runic-elite-frost-hollow", "elite", "medium", "frost-hollow", 10, 2),
  runicTemplate("runic-rest-stone-shelter", "rest", "small", "stone-shelter", 0, 1),
  runicTemplate("runic-shop-mountain-market", "shop", "small", "mountain-market", 0, 3),
  runicTemplate("runic-boss-summit-arena", "boss", "large", "summit-arena", 14, 3),
];

export const RUNIC_ROOM_TEMPLATE_BY_ID = new Map(RUNIC_ROOM_TEMPLATES.map((item) => [item.id, item]));

export const ARPG_ROOM_TEMPLATES = [
  ...MATA_ROOM_TEMPLATES,
  ...MARES_ROOM_TEMPLATES,
  ...RUNIC_ROOM_TEMPLATES,
] as const;

export const ARPG_ROOM_TEMPLATE_BY_ID = new Map(ARPG_ROOM_TEMPLATES.map((item) => [item.id, item]));

export function pickDungeonTemplate(regionId: string, type: DungeonRoomType, random: SeededRandom) {
  const source = regionId === "arquipelago-das-mares"
    ? MARES_ROOM_TEMPLATES
    : regionId === "montanhas-runicas" ? RUNIC_ROOM_TEMPLATES : MATA_ROOM_TEMPLATES;
  const options = source.filter((item) => item.type === type);
  if (options.length === 0) throw new Error(`Template ausente para ${regionId}:${type}.`);
  return random.pick(options);
}
