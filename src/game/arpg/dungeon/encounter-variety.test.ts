import { describe, expect, it } from "vitest";
import { generateDungeon } from "./generator";
import { populateArpgDungeonContent } from "./content";
import { createArpgDungeonSeed } from "./encounter-seed";

const regions = ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const;

describe("deterministic encounter variety", () => {
  it.each(regions)("reserves the boss for the final arena in new %s runs", (regionId) => {
    for (let index = 0; index < 100; index += 1) {
      const seed = createArpgDungeonSeed(regionId, `boss-room-${index}`);
      const dungeon = populateArpgDungeonContent(generateDungeon({ seed, regionId }));
      for (const room of Object.values(dungeon.rooms)) {
        if (room.type !== "boss") expect(room.waves.flat()).not.toContain("boss");
      }
      expect(dungeon.rooms[dungeon.bossRoomId].waves).toEqual([["boss"]]);
    }
  });

  it("keeps the encounter of an existing checkpoint unchanged", () => {
    const seed = "montanhas-runicas:2e45b268-8921-4441-911b-19da9ee2159b";
    const graph = populateArpgDungeonContent(generateDungeon({ seed, regionId: "montanhas-runicas" }));
    expect(graph.rooms["room-4"].type).toBe("combat");
    expect(graph.rooms["room-4"].waves.at(-1)).toEqual(["boss"]);
  });

  it.each(regions)("generates the same %s encounters for the same seed", (regionId) => {
    const seed = createArpgDungeonSeed(regionId, `stable-${regionId}`);
    const left = populateArpgDungeonContent(generateDungeon({ seed, regionId }));
    const right = populateArpgDungeonContent(generateDungeon({ seed, regionId }));
    expect(Object.entries(left.rooms).map(([id, room]) => [id, room.waves]))
      .toEqual(Object.entries(right.rooms).map(([id, room]) => [id, room.waves]));
  });

  it("changes enemy composition across seeds without losing special encounters", () => {
    const compositions = new Set<string>();
    for (let index = 0; index < 35; index += 1) {
      const dungeon = populateArpgDungeonContent(generateDungeon({ seed: `run-${index}` }));
      const rooms = Object.values(dungeon.rooms);
      expect(rooms.find((room) => room.type === "boss")?.waves).toEqual([["boss"]]);
      expect(rooms.find((room) => room.type === "elite")?.waves.flat()).toContain("miniBoss");
      for (const room of rooms.filter((room) => room.type === "combat")) {
        expect(room.waves.length).toBeGreaterThanOrEqual(1);
        expect(room.waves.length).toBeLessThanOrEqual(2);
        if (room.waves.length === 2) expect(room.waves[0]).not.toEqual(room.waves[1]);
        compositions.add(JSON.stringify(room.waves));
      }
    }
    expect(compositions.size).toBeGreaterThan(4);
  });
});
