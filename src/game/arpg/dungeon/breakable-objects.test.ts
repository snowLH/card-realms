import { describe, expect, it } from "vitest";
import { DUNGEON_TILE_SIZE } from "./layout";
import {
  buildRoomTileData,
  ROOM_OBSTACLE_TILE,
  ROOM_WALL_TILE,
  ROOM_WATER_TILE,
} from "./room-tilemap";
import {
  applyBreakableObjectDamage,
  createBreakableObjectPlacements,
  getUnbrokenBreakablePlacements,
} from "./breakable-objects";

const combatRoom = {
  id: "room-4",
  templateId: "mata-combat-ruins-a",
  type: "combat",
  connections: { north: "room-1", east: "room-5" },
} as const;

describe("breakable dungeon props", () => {
  it("creates stable placements from the run seed and room", () => {
    const first = createBreakableObjectPlacements("forest-seed-18", combatRoom, "mata-encantada");
    const retry = createBreakableObjectPlacements("forest-seed-18", combatRoom, "mata-encantada");

    expect(first).toEqual(retry);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(3);
  });

  it("places props on walkable ground away from the room center", () => {
    const placements = createBreakableObjectPlacements("forest-seed-18", combatRoom, "mata-encantada");
    const tiles = buildRoomTileData(combatRoom.templateId, combatRoom.connections, "forest-seed-18");

    for (const placement of placements) {
      const tile = tiles.data[Math.floor(placement.y / DUNGEON_TILE_SIZE)]?.[Math.floor(placement.x / DUNGEON_TILE_SIZE)];
      expect(tile).not.toBeUndefined();
      expect([ROOM_WALL_TILE, ROOM_OBSTACLE_TILE, ROOM_WATER_TILE]).not.toContain(tile);
      expect(Math.hypot(placement.x - tiles.width * DUNGEON_TILE_SIZE / 2, placement.y - tiles.height * DUNGEON_TILE_SIZE / 2)).toBeGreaterThanOrEqual(112);
    }
  });

  it("keeps the arrival room free of breakable props", () => {
    expect(createBreakableObjectPlacements("forest-seed-18", { ...combatRoom, type: "start" }, "mata-encantada")).toEqual([]);
  });

  it("reduces durability per hit and clamps broken props at zero", () => {
    expect(applyBreakableObjectDamage(42, 24)).toBe(18);
    expect(applyBreakableObjectDamage(18, 24)).toBe(0);
    expect(applyBreakableObjectDamage(0, 24)).toBe(0);
  });

  it("does not recreate seeded props already marked broken by a resumed run", () => {
    const placements = createBreakableObjectPlacements("resume-props", combatRoom, "mata-encantada");
    const broken = placements[0]!;

    const restored = getUnbrokenBreakablePlacements(placements, [broken.id]);

    expect(restored.map((placement) => placement.id)).not.toContain(broken.id);
    expect(restored).toEqual(placements.slice(1));
  });
});
