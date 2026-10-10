import { describe, expect, it } from "vitest";
import { populateArpgDungeonContent } from "./content";
import { createArpgDungeonSeed } from "./encounter-seed";
import { generateDungeon } from "./generator";
import { DungeonManager } from "./manager";
import { bossGateParentId, isBossRoomUnlocked, unclearedRoomsBeforeBoss } from "./boss-access";

describe("final forgotten-legend gate", () => {
  it.each(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const)(
    "keeps the %s boss sealed until every other room is cleared",
    (regionId) => {
      const graph = populateArpgDungeonContent(generateDungeon({
        seed: createArpgDungeonSeed(regionId, "boss-gate"),
        regionId,
        minRooms: 8,
        maxRooms: 8,
      }));
      const manager = new DungeonManager(graph);
      const bossId = manager.getGraph().bossRoomId;
      const parentId = bossGateParentId(manager.getGraph());
      expect(parentId).toBeTruthy();
      expect(isBossRoomUnlocked(manager.getGraph())).toBe(false);

      for (const room of Object.values(manager.getGraph().rooms)) {
        if (room.id === bossId) continue;
        manager.clearRoom(room.id);
      }

      expect(unclearedRoomsBeforeBoss(manager.getGraph())).toEqual([]);
      expect(isBossRoomUnlocked(manager.getGraph())).toBe(true);
    },
  );

  it("rejects entering the boss while even one branch is unresolved", () => {
    const graph = populateArpgDungeonContent(generateDungeon({
      seed: createArpgDungeonSeed("mata-encantada", "boss-gate-entry"),
      regionId: "mata-encantada",
      minRooms: 8,
      maxRooms: 8,
    }));
    const manager = new DungeonManager(graph);
    const bossId = manager.getGraph().bossRoomId;
    const parentId = bossGateParentId(manager.getGraph())!;
    const route = manager.getGraph().rooms[parentId];

    for (const room of Object.values(manager.getGraph().rooms)) {
      if (room.id !== bossId && room.id !== parentId) manager.clearRoom(room.id);
    }
    // Move manager state directly through a legal path is irrelevant to the
    // access rule; leaving the parent unresolved must still keep the seal.
    expect(isBossRoomUnlocked(manager.getGraph())).toBe(false);
    expect(route.state).not.toBe("cleared");

    manager.clearRoom(parentId);
    expect(isBossRoomUnlocked(manager.getGraph())).toBe(true);
  });
});
