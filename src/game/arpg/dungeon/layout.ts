import { DUNGEON_DIRECTIONS } from "./graph";
import { ARPG_ROOM_TEMPLATE_BY_ID } from "./templates";
import type { DungeonDirection, DungeonGraph } from "./types";

export const DUNGEON_TILE_SIZE = 32;
export const DUNGEON_CELL_SIZE_X = 1344;
export const DUNGEON_CELL_SIZE_Y = 896;
export const DUNGEON_WORLD_MARGIN = 160;
export const DUNGEON_CORRIDOR_WIDTH = 128;

export type RoomPixelLayout = {
  roomId: string;
  centerX: number;
  centerY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  doorCenters: Partial<Record<DungeonDirection, { x: number; y: number }>>;
};

export type CorridorLayout = {
  fromRoomId: string;
  toRoomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type DungeonPixelLayout = {
  width: number;
  height: number;
  rooms: Record<string, RoomPixelLayout>;
  corridors: CorridorLayout[];
};

function roomSizePx(templateId: string) {
  const template = ARPG_ROOM_TEMPLATE_BY_ID.get(templateId);
  if (!template) throw new Error(`Template de sala não encontrado: ${templateId}.`);
  return {
    width: template.widthTiles * DUNGEON_TILE_SIZE,
    height: template.heightTiles * DUNGEON_TILE_SIZE,
  };
}

function doorCenter(layout: Omit<RoomPixelLayout, "doorCenters">, direction: DungeonDirection) {
  if (direction === "north") return { x: layout.centerX, y: layout.top };
  if (direction === "south") return { x: layout.centerX, y: layout.top + layout.height };
  if (direction === "west") return { x: layout.left, y: layout.centerY };
  return { x: layout.left + layout.width, y: layout.centerY };
}

export function buildDungeonPixelLayout(graph: DungeonGraph): DungeonPixelLayout {
  const roomList = Object.values(graph.rooms);
  const ordinary = roomList.filter((room) => room.type !== "boss");
  const monumental = graph.rooms[graph.bossRoomId].size === "boss";
  const gridRooms = monumental ? ordinary : roomList;
  const minGridX = Math.min(...gridRooms.map((room) => room.gridX));
  const minGridY = Math.min(...gridRooms.map((room) => room.gridY));
  const rooms: Record<string, RoomPixelLayout> = {};

  for (const room of roomList) {
    const size = roomSizePx(room.templateId);
    const centerX = DUNGEON_WORLD_MARGIN + (room.gridX - minGridX) * DUNGEON_CELL_SIZE_X + DUNGEON_CELL_SIZE_X / 2;
    const centerY = DUNGEON_WORLD_MARGIN + (room.gridY - minGridY) * DUNGEON_CELL_SIZE_Y + DUNGEON_CELL_SIZE_Y / 2;
    const base = {
      roomId: room.id,
      centerX,
      centerY,
      left: centerX - size.width / 2,
      top: centerY - size.height / 2,
      width: size.width,
      height: size.height,
    };
    rooms[room.id] = { ...base, doorCenters: {} };
    for (const direction of DUNGEON_DIRECTIONS) {
      if (room.connections[direction]) rooms[room.id].doorCenters[direction] = doorCenter(base, direction);
    }
  }

  if (monumental) {
    const boss = rooms[graph.bossRoomId];
    const parentId = graph.rooms[graph.bossRoomId].connections.south;
    if (!boss || !parentId) throw new Error("A arena exige uma antecâmara ao sul.");
    const northEdge = Math.min(...ordinary.map((room) => rooms[room.id].top));
    boss.centerX = rooms[parentId].centerX;
    boss.top = northEdge - 288 - boss.height;
    boss.left = boss.centerX - boss.width / 2;
    boss.centerY = boss.top + boss.height / 2;
    // Translate once to keep every room inside positive world bounds, including
    // a boss extending beyond the ordinary grid's left edge. No cell is enlarged.
    const offsetX = Math.max(0, DUNGEON_WORLD_MARGIN - Math.min(...Object.values(rooms).map((room) => room.left)));
    const offsetY = Math.max(0, DUNGEON_WORLD_MARGIN - Math.min(...Object.values(rooms).map((room) => room.top)));
    for (const room of roomList) {
      const layout = rooms[room.id];
      layout.left += offsetX;
      layout.top += offsetY;
      layout.centerX += offsetX;
      layout.centerY += offsetY;
      for (const direction of DUNGEON_DIRECTIONS) {
        if (room.connections[direction]) layout.doorCenters[direction] = doorCenter(layout, direction);
      }
    }
  }

  const corridors: CorridorLayout[] = [];
  for (const room of roomList) {
    for (const direction of ["east", "south"] as const) {
      const targetId = room.connections[direction];
      if (!targetId) continue;
      const from = rooms[room.id].doorCenters[direction]!;
      const opposite = direction === "east" ? "west" : "north";
      const to = rooms[targetId].doorCenters[opposite]!;
      if (direction === "east") {
        corridors.push({
          fromRoomId: room.id,
          toRoomId: targetId,
          x: Math.min(from.x, to.x),
          y: from.y - DUNGEON_CORRIDOR_WIDTH / 2,
          width: Math.abs(to.x - from.x),
          height: DUNGEON_CORRIDOR_WIDTH,
        });
      } else {
        corridors.push({
          fromRoomId: room.id,
          toRoomId: targetId,
          x: from.x - DUNGEON_CORRIDOR_WIDTH / 2,
          y: Math.min(from.y, to.y),
          width: DUNGEON_CORRIDOR_WIDTH,
          height: Math.abs(to.y - from.y),
        });
      }
    }
  }

  return {
    width: Math.max(...Object.values(rooms).map((room) => room.left + room.width)) + DUNGEON_WORLD_MARGIN,
    height: Math.max(...Object.values(rooms).map((room) => room.top + room.height)) + DUNGEON_WORLD_MARGIN,
    rooms,
    corridors,
  };
}
