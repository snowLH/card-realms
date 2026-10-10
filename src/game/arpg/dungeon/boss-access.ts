import { usesLegacyDungeonLayout } from "./encounter-seed";
import type { DungeonGraph } from "./types";

/**
 * New encounter-v3 dungeons only expose the forgotten legend after every
 * ordinary room has been resolved. Historical runs keep their original route
 * so checkpoints created before this gate cannot be soft-locked.
 */
export function requiredRoomsBeforeBoss(graph: DungeonGraph) {
  if (usesLegacyDungeonLayout(graph.seed, graph.regionId)) return [];
  return Object.values(graph.rooms)
    .filter((room) => room.id !== graph.bossRoomId)
    .map((room) => room.id)
    .sort();
}

export function unclearedRoomsBeforeBoss(graph: DungeonGraph) {
  const required = new Set(requiredRoomsBeforeBoss(graph));
  return [...required]
    .filter((roomId) => graph.rooms[roomId]?.state !== "cleared")
    .sort();
}

export function isBossRoomUnlocked(graph: DungeonGraph) {
  return unclearedRoomsBeforeBoss(graph).length === 0;
}

export function bossGateParentId(graph: DungeonGraph) {
  const boss = graph.rooms[graph.bossRoomId];
  if (!boss) return null;
  const parentIds = Object.values(boss.connections).filter((id): id is string => typeof id === "string");
  return parentIds.length === 1 ? parentIds[0] : null;
}
