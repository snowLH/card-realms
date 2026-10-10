import { describe, expect, it } from "vitest";
import { populateArpgDungeonContent } from "./content";
import { createArpgDungeonSeed } from "./encounter-seed";
import { generateDungeon } from "./generator";
import { DungeonManager } from "./manager";
import { bossGateParentId, isBossRoomUnlocked, isFinalBossConnectionLocked, unclearedRoomsBeforeBoss } from "./boss-access";

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
      expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(true);

      for (const room of Object.values(manager.getGraph().rooms)) {
        if (room.id === bossId) continue;
        manager.clearRoom(room.id);
      }

      expect(unclearedRoomsBeforeBoss(manager.getGraph())).toEqual([]);
      expect(isBossRoomUnlocked(manager.getGraph())).toBe(true);
      expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(false);
      // Every frame syncs the same connection. Cleared prerequisites must not
      // reopen the door during intro, combat or the pending save in RESTORED.
      manager.getRoom(bossId).state = "combat";
      for (let frame = 0; frame < 3; frame++) expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(true);
      manager.clearRoom(bossId);
      expect(isFinalBossConnectionLocked(manager.getGraph())).toBe(false);
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

    const queue = [[manager.getGraph().startRoomId]];
    let route: string[] = [];
    while (queue.length) {
      const path = queue.shift()!;
      const id = path.at(-1)!;
      if (id === parentId) { route = path; break; }
      const room = manager.getGraph().rooms[id];
      for (const next of Object.values(room.connections)) {
        if (next && !path.includes(next) && next !== bossId) queue.push([...path, next]);
      }
    }
    expect(route.at(-1)).toBe(parentId);
    for (const nextId of route.slice(1)) {
      manager.clearRoom();
      manager.enterRoom(nextId);
    }
    manager.clearRoom(parentId);

    expect(unclearedRoomsBeforeBoss(manager.getGraph()).length).toBeGreaterThan(0);
    expect(() => manager.enterRoom(bossId)).toThrow(/permanece selada/i);

    for (const room of Object.values(manager.getGraph().rooms)) {
      if (room.id !== bossId) manager.clearRoom(room.id);
    }
    expect(manager.isBossRoomUnlocked()).toBe(true);
    expect(manager.enterRoom(bossId).id).toBe(bossId);
  });
});
