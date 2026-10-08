import { describe, expect, it } from "vitest";
import { generateDungeon } from "./generator";
import { populateArpgDungeonContent } from "./content";

const regions = ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const;

describe("deterministic encounter variety", () => {
  it.each(regions)("generates the same %s encounters for the same seed", (regionId) => {
    const seed = `stable-${regionId}`;
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
