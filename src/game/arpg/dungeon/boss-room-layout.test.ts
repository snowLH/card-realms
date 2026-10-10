import { describe, expect, it } from "vitest";
import { generateDungeon } from "./generator";
import { buildDungeonPixelLayout, DUNGEON_CELL_SIZE_X } from "./layout";
import { validateDungeonGraph } from "./graph";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_WALL_TILE, ROOM_OBSTACLE_TILE } from "./room-tilemap";
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width - 0.01 && a.x + a.width > b.x + 0.01 && a.y < b.y + b.height - 0.01 && a.y + a.height > b.y + 0.01;
describe("monumental boss zone", () => {
  it.each(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"])("keeps %s rooms and every branch corridor disjoint across 300 seeds", (regionId) => {
    for (let index = 0; index < 300; index++) {
      const graph = generateDungeon({ seed: "boss-layout:" + regionId + ":" + index, regionId });
      expect(validateDungeonGraph(graph).valid).toBe(true);
      const layout = buildDungeonPixelLayout(graph);
      const boss = layout.rooms[graph.bossRoomId];
      expect([boss.width / 32, boss.height / 32]).toEqual([61, 31]);
      const rooms = Object.values(layout.rooms).map((room) => ({ ...room, x: room.left, y: room.top }));
      for (const [i, a] of rooms.entries()) for (const b of rooms.slice(i + 1)) expect(overlaps(a, b), graph.seed + ":" + a.roomId + ":" + b.roomId).toBe(false);
      for (const corridor of layout.corridors) {
        expect(corridor.width > 0 && corridor.height > 0).toBe(true);
        for (const room of rooms.filter((room) => room.roomId !== corridor.fromRoomId && room.roomId !== corridor.toRoomId)) expect(overlaps(corridor, room), graph.seed).toBe(false);
      }
      const ordinary = Object.values(graph.rooms).filter((room) => room.type !== "boss");
      for (const a of ordinary) for (const b of ordinary) if (a.gridY === b.gridY && a.gridX !== b.gridX) {
        expect(Math.abs(layout.rooms[a.id].centerX - layout.rooms[b.id].centerX)).toBe(Math.abs(a.gridX - b.gridX) * DUNGEON_CELL_SIZE_X);
      }
      const tiles = buildRoomTileData(graph.rooms[graph.bossRoomId].templateId, graph.rooms[graph.bossRoomId].connections, graph.seed);
      for (const point of createSafeRoomSpawnPoints(tiles, 4)) expect([ROOM_WALL_TILE, ROOM_OBSTACLE_TILE]).not.toContain(tiles.data[Math.floor(point.y / 32)][Math.floor(point.x / 32)]);
    }
  });
});
