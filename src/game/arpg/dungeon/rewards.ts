import type { DungeonGraph, DungeonRoom } from "./types";

export type RunCacheReward =
  | { kind: "none" }
  | { kind: "cache"; shards: number; healing: number };

function hash(seed: string, roomId: string) {
  let value = 2166136261;
  const input = `${seed}:${roomId}:room-cache`;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function firstRoom(rooms: DungeonRoom[], type: DungeonRoom["type"]) {
  return rooms.find((room) => room.type === type);
}

/** Assigns the server-signed four-item run plan to distinct rooms. */
export function createRunLootAssignments(graph: DungeonGraph) {
  const rooms = Object.values(graph.rooms);
  const treasure = firstRoom(rooms, "treasure");
  const elite = firstRoom(rooms, "elite");
  const boss = graph.rooms[graph.bossRoomId];
  const combat = rooms
    .filter((room) => room.type === "combat" && room.id !== boss?.id)
    .sort((left, right) => left.distanceFromStart - right.distanceFromStart)[0];
  const ordered = [treasure, elite, combat, boss];
  if (ordered.some((room) => !room) || new Set(ordered.map((room) => room!.id)).size !== 4) {
    throw new Error("A run precisa de salas distintas para tesouro, elite, combate e boss.");
  }
  return Object.fromEntries(ordered.map((room, index) => [room!.id, index]));
}

/** Ordinary combat rooms can produce a small run-only cache; gear is reserved for marked rooms. */
export function rollCombatRoomCache(seed: string, roomId: string): RunCacheReward {
  const roll = hash(seed, roomId) % 100;
  if (roll < 14) return { kind: "cache", shards: 0, healing: 18 };
  if (roll < 36) return { kind: "cache", shards: 12, healing: 0 };
  return { kind: "none" };
}
