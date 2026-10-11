import { describe, expect, it } from "vitest";
import { populateArpgDungeonContent } from "./content";
import { createArpgDungeonSeed } from "./encounter-seed";
import { generateDungeon } from "./generator";
import { DungeonManager } from "./manager";
import {
  bossGateParentId,
  isBossRoomUnlocked,
  isFinalBossConnectionLocked,
  unclearedRoomsBeforeBoss,
} from "./boss-access";

function routeTo(graph: ReturnType<typeof generateDungeon>, targetId: string) {
  const queue: string[][] = [[graph.startRoomId]];
  while (queue.length) {
    const path = queue.shift()!;
    const id = path.at(-1)!;
    if (id === targetId) return path;
    for (const next of Object.values(graph.rooms[id].connections)) {
      if (next && !path.includes(next) && next !== graph.bossRoomId) {
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

describe("final forgotten-legend gate", () => {
  it.each(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const)(
    "lets %s skip optional branches after clearing the boss antechamber",
    (regionId) => {
      const graph = populateArpgDungeonContent(generateDungeon({
        seed: createArpgDungeonSeed(regionId, "compact-boss-gate"),
        regionId,
        minRooms: 8,
        maxRooms: 8,
      }));
      const manager = new DungeonManager(graph);
      const bossId = graph.bossRoomId;
      const parentId = bossGateParentId(graph)!;
      const route = routeTo(graph, parentId);

      expect(route.length).toBeGreaterThan(1);
      expect(isBossRoomUnlocked(manager.getGraph())).toBe(false);

      for (const nextId of route.slice(1)) {
        manager.clearRoom();
        manager.enterRoom(nextId);
      }
      manager.clearRoom(parentId);

      const unresolvedSideRooms = Object.values(manager.getGraph().rooms)
        .filter((room) => room.id !== bossId && room.state !== "cleared");
      expect(unresolvedSideRooms.length).toBeGreaterThan(0);
      expect(unclearedRoomsBeforeBoss(manager.getGraph())).toEqual([]);
      expect(isBossRoomUnlocked(manager.getGraph())).toBe(true);
      expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(false);
      expect(manager.enterRoom(bossId).id).toBe(bossId);

      manager.getRoom(bossId).state = "combat";
      expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(true);
      manager.clearRoom(bossId);
      expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(false);
    },
  );

  it("keeps encounter-v3 saved runs on the historical full-clear rule", () => {
    const regionId = "mata-encantada";
    const graph = populateArpgDungeonContent(generateDungeon({
      seed: `${regionId}:encounters-v3:saved-run`,
      regionId,
      minRooms: 8,
      maxRooms: 8,
    }));
    const manager = new DungeonManager(graph);
    const bossId = graph.bossRoomId;
    const parentId = bossGateParentId(graph)!;

    manager.clearRoom(parentId);
    expect(unclearedRoomsBeforeBoss(manager.getGraph()).length).toBeGreaterThan(0);
    expect(isBossRoomUnlocked(manager.getGraph())).toBe(false);

    for (const room of Object.values(manager.getGraph().rooms)) {
      if (room.id !== bossId) manager.clearRoom(room.id);
    }
    expect(isBossRoomUnlocked(manager.getGraph())).toBe(true);
  });
});
