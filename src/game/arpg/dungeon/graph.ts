import type { DungeonDirection, DungeonGraph, DungeonRoom } from "./types";

export const DUNGEON_DIRECTIONS: readonly DungeonDirection[] = ["north", "east", "south", "west"];

export const DIRECTION_VECTOR: Record<DungeonDirection, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export const OPPOSITE_DIRECTION: Record<DungeonDirection, DungeonDirection> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};

export function roomCoordinateKey(x: number, y: number) {
  return `${x},${y}`;
}

export function connectedRoomIds(room: DungeonRoom) {
  return DUNGEON_DIRECTIONS.map((direction) => room.connections[direction]).filter((id): id is string => Boolean(id));
}

export function computeRoomDistances(graph: DungeonGraph) {
  const distances = new Map<string, number>([[graph.startRoomId, 0]]);
  const queue = [graph.startRoomId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const room = graph.rooms[id];
    for (const nextId of connectedRoomIds(room)) {
      if (distances.has(nextId)) continue;
      distances.set(nextId, distances.get(id)! + 1);
      queue.push(nextId);
    }
  }
  return distances;
}

export function validateDungeonGraph(graph: DungeonGraph) {
  const errors: string[] = [];
  const rooms = Object.values(graph.rooms);
  const coordinates = new Set<string>();
  if (!graph.rooms[graph.startRoomId]) errors.push("START ausente.");
  if (!graph.rooms[graph.bossRoomId]) errors.push("BOSS ausente.");
  if (rooms.filter((room) => room.type === "start").length !== 1) errors.push("Deve existir exatamente um START.");
  if (rooms.filter((room) => room.type === "boss").length !== 1) errors.push("Deve existir exatamente um BOSS.");

  for (const room of rooms) {
    const key = roomCoordinateKey(room.gridX, room.gridY);
    if (coordinates.has(key)) errors.push(`Coordenada duplicada: ${key}.`);
    coordinates.add(key);
    for (const direction of DUNGEON_DIRECTIONS) {
      const targetId = room.connections[direction];
      if (!targetId) continue;
      const target = graph.rooms[targetId];
      if (!target) {
        errors.push(`${room.id}.${direction} aponta para sala inexistente ${targetId}.`);
        continue;
      }
      const vector = DIRECTION_VECTOR[direction];
      if (target.gridX !== room.gridX + vector.x || target.gridY !== room.gridY + vector.y) {
        errors.push(`${room.id}.${direction} aponta para coordenada inválida.`);
      }
      if (target.connections[OPPOSITE_DIRECTION[direction]] !== room.id) {
        errors.push(`Conexão ${room.id} ↔ ${target.id} não é bidirecional.`);
      }
    }
  }

  if (graph.rooms[graph.startRoomId]) {
    const distances = computeRoomDistances(graph);
    if (distances.size !== rooms.length) errors.push("Existem salas inacessíveis.");
    const bossDistance = distances.get(graph.bossRoomId);
    if (typeof bossDistance !== "number" || bossDistance < 4) errors.push("BOSS está perto demais do START.");
  }
  return { valid: errors.length === 0, errors };
}
