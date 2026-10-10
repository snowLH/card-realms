import { ARPG_ROOM_TEMPLATE_BY_ID } from "./templates";
import { DUNGEON_TILE_SIZE } from "./layout";
import type { DungeonDirection, DungeonRoomConnections } from "./types";
import { BOSS_ARENA_COLLISION_ZONES, BOSS_ROOM_ART } from "../bosses/boss-room-art";
import { bossForRegion } from "../bosses/registry";

export const ROOM_FLOOR_TILE = 0;
export const ROOM_WALL_TILE = 1;
export const ROOM_GROUND_DETAIL_TILE = 2;
export const ROOM_WATER_TILE = 3;
export const ROOM_OBSTACLE_TILE = 4;
export const ROOM_RUNE_TILE = 5;
export const ROOM_DOOR_WIDTH_TILES = 3;

export type RoomTileData = {
  width: number;
  height: number;
  data: number[][];
};

export type RoomSpawnPoint = { x: number; y: number };

function hashTile(seed: string, templateId: string, x: number, y: number) {
  let hash = 2166136261;
  const input = `${seed}:${templateId}:${x}:${y}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isWaterPattern(pattern: string) {
  return ["river", "islet", "reef", "grotto", "singing-pool", "whirlpool", "sandbar", "deep-lagoon", "glacier"].includes(pattern);
}

function hasStoneObstacles(pattern: string) {
  return ["ruins", "roots", "crystals", "hollow", "camp", "flooded-ruins", "tempest", "rune-ruins", "crystal-cave", "frost-hollow", "summit-arena"].includes(pattern);
}

function clearDoor(data: number[][], direction: DungeonDirection) {
  const height = data.length;
  const width = data[0].length;
  const half = Math.floor(ROOM_DOOR_WIDTH_TILES / 2);
  if (direction === "north" || direction === "south") {
    const y = direction === "north" ? 0 : height - 1;
    const center = Math.floor(width / 2);
    for (let dx = -half; dx <= half; dx += 1) data[y][center + dx] = ROOM_FLOOR_TILE;
    return;
  }
  const x = direction === "west" ? 0 : width - 1;
  const center = Math.floor(height / 2);
  for (let dy = -half; dy <= half; dy += 1) data[center + dy][x] = ROOM_FLOOR_TILE;
}

export function buildRoomTileData(templateId: string, connections: DungeonRoomConnections, seed = ""): RoomTileData {
  const template = ARPG_ROOM_TEMPLATE_BY_ID.get(templateId);
  if (!template) throw new Error(`Template não encontrado: ${templateId}.`);
  const bossCollisionZones = template.size === "boss"
    ? BOSS_ROOM_ART[bossForRegion(template.biome).id]?.collisionZones ?? BOSS_ARENA_COLLISION_ZONES
    : [];
  const data = Array.from({ length: template.heightTiles }, (_, y) =>
    Array.from({ length: template.widthTiles }, (_, x) => {
      const edge = x === 0 || y === 0 || x === template.widthTiles - 1 || y === template.heightTiles - 1;
      if (edge) return ROOM_WALL_TILE;
      if (template.size === "boss") return bossCollisionZones.some((zone) =>
        x * DUNGEON_TILE_SIZE >= zone.x && x * DUNGEON_TILE_SIZE < zone.x + zone.width
        && y * DUNGEON_TILE_SIZE >= zone.y && y * DUNGEON_TILE_SIZE < zone.y + zone.height)
        ? ROOM_WALL_TILE : ROOM_FLOOR_TILE;

      const centerX = Math.floor(template.widthTiles / 2);
      const centerY = Math.floor(template.heightTiles / 2);
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);
      const cornerObstacle = hasStoneObstacles(template.pattern)
        && [[2, 2], [template.widthTiles - 3, 2], [2, template.heightTiles - 3], [template.widthTiles - 3, template.heightTiles - 3]]
          .some(([obstacleX, obstacleY]) => obstacleX === x && obstacleY === y);
      if (cornerObstacle) return ROOM_OBSTACLE_TILE;

      if (isWaterPattern(template.pattern)) {
        const river = template.pattern === "river" || template.pattern === "islet" || template.pattern === "sandbar";
        const waterLane = river
          ? x <= 3 && Math.abs(dy) <= 2
          : distance >= Math.max(3, centerX - 3) && hashTile(seed, templateId, x, y) % 100 < 62;
        if (waterLane) return ROOM_WATER_TILE;
      }

      const arenaRune = template.pattern === "ancestral-arena" && distance >= 3 && distance <= 4;
      const altarDetail = (template.pattern === "shrine" || template.pattern === "altar") && distance <= 2.5;
      const runicPattern = templateId.startsWith("runic-")
        && ["rune-ruins", "rune-shrine", "wind-sanctum", "summit-arena"].includes(template.pattern);
      const runicArenaRing = template.pattern === "summit-arena" && distance >= 3 && distance <= 5;
      const runicAltarRing = template.pattern === "rune-shrine" && distance <= 2.5;
      const runicStoneMark = runicPattern && hashTile(seed, templateId, x, y) % 100 < (template.pattern === "rune-ruins" ? 15 : 8);
      if (runicArenaRing || runicAltarRing || runicStoneMark) return ROOM_RUNE_TILE;
      if (arenaRune || altarDetail || hashTile(seed, templateId, x, y) % 100 < 7) return ROOM_GROUND_DETAIL_TILE;
      return ROOM_FLOOR_TILE;
    })
  );
  for (const direction of template.allowedDoors) {
    if (connections[direction]) clearDoor(data, direction);
  }
  return { width: template.widthTiles, height: template.heightTiles, data };
}

export function createSafeRoomSpawnPoints(tiles: RoomTileData, count: number): RoomSpawnPoint[] {
  if (count <= 0) return [];
  const roomWidth = tiles.width * DUNGEON_TILE_SIZE;
  const roomHeight = tiles.height * DUNGEON_TILE_SIZE;
  const center = { x: roomWidth / 2, y: roomHeight / 2 };
  const radiusX = Math.max(DUNGEON_TILE_SIZE * 3, roomWidth * 0.28);
  const radiusY = Math.max(DUNGEON_TILE_SIZE * 3, roomHeight * 0.25);
  const min = DUNGEON_TILE_SIZE * 1.5;
  const maxX = roomWidth - min;
  const maxY = roomHeight - min;
  const isWalkable = (point: RoomSpawnPoint) => {
    const x = Math.floor(point.x / DUNGEON_TILE_SIZE);
    const y = Math.floor(point.y / DUNGEON_TILE_SIZE);
    const tile = tiles.data[y]?.[x];
    return tile !== undefined && tile !== ROOM_WALL_TILE && tile !== ROOM_OBSTACLE_TILE;
  };
  const points: RoomSpawnPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const baseAngle = count === 1 ? 0 : (Math.PI * 2 * index) / count - Math.PI / 2;
    let point: RoomSpawnPoint | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angle = baseAngle + attempt * 0.31;
      const radiusScale = attempt < 16 ? 1 : Math.max(0.45, 1 - (attempt - 16) * 0.035);
      const candidate = {
        x: PhaserMathClamp(center.x + Math.cos(angle) * radiusX * radiusScale, min, maxX),
        y: PhaserMathClamp(center.y + Math.sin(angle) * radiusY * radiusScale, min, maxY),
      };
      if (isWalkable(candidate) && points.every((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) >= 42)) {
        point = candidate;
        break;
      }
    }

    if (!point) {
      for (let y = 2; y < tiles.height - 2 && !point; y += 1) {
        for (let x = 2; x < tiles.width - 2; x += 1) {
          const candidate = { x: (x + 0.5) * DUNGEON_TILE_SIZE, y: (y + 0.5) * DUNGEON_TILE_SIZE };
          if (isWalkable(candidate) && points.every((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) >= 42)) {
            point = candidate;
            break;
          }
        }
      }
    }

    points.push(point ?? center);
  }
  return points;
}

function PhaserMathClamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
