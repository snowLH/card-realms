import { createSeededRandom } from "./rng";
import { DUNGEON_TILE_SIZE } from "./layout";
import {
  buildRoomTileData,
  ROOM_OBSTACLE_TILE,
  ROOM_WALL_TILE,
  ROOM_WATER_TILE,
} from "./room-tilemap";
import type { DungeonRoom } from "./types";

export type BreakableObjectKind = "crate" | "vase" | "shrub" | "relic";

export type BreakableObjectPlacement = {
  id: string;
  kind: BreakableObjectKind;
  x: number;
  y: number;
  hitPoints: number;
};

export function getUnbrokenBreakablePlacements(
  placements: readonly BreakableObjectPlacement[],
  brokenIds: Iterable<string>,
) {
  const broken = new Set(brokenIds);
  return placements.filter((placement) => !broken.has(placement.id));
}

const HIT_POINTS: Record<BreakableObjectKind, number> = {
  crate: 42,
  vase: 25,
  shrub: 20,
  relic: 54,
};

export function applyBreakableObjectDamage(hitPoints: number, damage: number) {
  const current = Number.isFinite(hitPoints) ? Math.max(0, Math.trunc(hitPoints)) : 0;
  const amount = Number.isFinite(damage) ? Math.max(1, Math.trunc(damage)) : 1;
  return Math.max(0, current - amount);
}

function kindsForRegion(regionId: string): readonly BreakableObjectKind[] {
  if (regionId === "arquipelago-das-mares") return ["vase", "shrub", "crate"];
  if (regionId === "montanhas-runicas") return ["relic", "crate", "vase"];
  return ["crate", "shrub", "vase", "relic"];
}

export function createBreakableObjectPlacements(
  seed: string,
  room: Pick<DungeonRoom, "id" | "templateId" | "type" | "connections">,
  regionId: string,
): BreakableObjectPlacement[] {
  if (room.type === "start") return [];

  const random = createSeededRandom(`${seed}:${room.id}:breakable-objects:v1`);
  const tiles = buildRoomTileData(room.templateId, room.connections, seed);
  const centerX = tiles.width / 2;
  const centerY = tiles.height / 2;
  const candidates: Array<{ tileX: number; tileY: number }> = [];

  for (let tileY = 2; tileY < tiles.height - 2; tileY += 1) {
    for (let tileX = 2; tileX < tiles.width - 2; tileX += 1) {
      const tile = tiles.data[tileY]?.[tileX];
      if (tile === undefined || [ROOM_WALL_TILE, ROOM_OBSTACLE_TILE, ROOM_WATER_TILE].includes(tile)) continue;
      if (Math.hypot(tileX + 0.5 - centerX, tileY + 0.5 - centerY) < 3.5) continue;
      candidates.push({ tileX, tileY });
    }
  }

  const kinds = kindsForRegion(regionId);
  const placements: BreakableObjectPlacement[] = [];
  const targetCount = random.int(1, 3);
  for (const candidate of random.shuffle(candidates)) {
    const x = (candidate.tileX + 0.5) * DUNGEON_TILE_SIZE;
    const y = (candidate.tileY + 0.5) * DUNGEON_TILE_SIZE;
    if (placements.some((placement) => Math.hypot(placement.x - x, placement.y - y) < 76)) continue;

    const kind = random.pick(kinds);
    placements.push({
      id: `${room.id}:breakable:${placements.length}`,
      kind,
      x,
      y,
      hitPoints: HIT_POINTS[kind],
    });
    if (placements.length >= targetCount) break;
  }

  return placements;
}
