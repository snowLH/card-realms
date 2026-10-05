import {
  DUNGEON_TILE_SIZE,
  type DungeonPixelLayout,
} from "./layout";
import {
  buildRoomTileData,
  ROOM_OBSTACLE_TILE,
  ROOM_WALL_TILE,
} from "./room-tilemap";
import type { DungeonGraph } from "./types";
import { gridCellKey, type GridNavigation } from "../navigation/grid-path";

export function buildDungeonNavigation(
  graph: DungeonGraph,
  layout: DungeonPixelLayout,
): GridNavigation {
  const walkable = new Set<string>();
  const roomIdByCell = new Map<string, string>();

  for (const room of Object.values(graph.rooms)) {
    const roomLayout = layout.rooms[room.id];
    const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
    for (let tileY = 0; tileY < tiles.height; tileY += 1) {
      for (let tileX = 0; tileX < tiles.width; tileX += 1) {
        const tile = tiles.data[tileY][tileX];
        if (tile === ROOM_WALL_TILE || tile === ROOM_OBSTACLE_TILE) continue;
        const worldX = roomLayout.left + (tileX + 0.5) * DUNGEON_TILE_SIZE;
        const worldY = roomLayout.top + (tileY + 0.5) * DUNGEON_TILE_SIZE;
        const cellX = Math.round(worldX / DUNGEON_TILE_SIZE);
        const cellY = Math.round(worldY / DUNGEON_TILE_SIZE);
        const key = gridCellKey(cellX, cellY);
        walkable.add(key);
        roomIdByCell.set(key, room.id);
      }
    }
  }

  for (const corridor of layout.corridors) {
    const startX = Math.ceil(corridor.x / DUNGEON_TILE_SIZE);
    const endX = Math.floor((corridor.x + corridor.width) / DUNGEON_TILE_SIZE);
    const startY = Math.ceil(corridor.y / DUNGEON_TILE_SIZE);
    const endY = Math.floor((corridor.y + corridor.height) / DUNGEON_TILE_SIZE);
    const horizontal = corridor.width > corridor.height;
    const safeStartX = horizontal ? startX : Math.ceil((corridor.x + DUNGEON_TILE_SIZE / 2) / DUNGEON_TILE_SIZE);
    const safeEndX = horizontal ? endX : Math.floor((corridor.x + corridor.width - DUNGEON_TILE_SIZE / 2) / DUNGEON_TILE_SIZE);
    const safeStartY = horizontal ? Math.ceil((corridor.y + DUNGEON_TILE_SIZE / 2) / DUNGEON_TILE_SIZE) : startY;
    const safeEndY = horizontal ? Math.floor((corridor.y + corridor.height - DUNGEON_TILE_SIZE / 2) / DUNGEON_TILE_SIZE) : endY;
    for (let cellY = safeStartY; cellY <= safeEndY; cellY += 1) {
      for (let cellX = safeStartX; cellX <= safeEndX; cellX += 1) {
        walkable.add(gridCellKey(cellX, cellY));
      }
    }
  }

  return {
    tileSize: DUNGEON_TILE_SIZE,
    originX: 0,
    originY: 0,
    walkable,
    roomIdByCell,
  };
}
