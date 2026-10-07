import { describe, expect, it } from "vitest";
import {
  ARPG_DUNGEON_CONFIGS,
  createDungeonLootPlan,
  isDungeonLootPlanValid,
  resolveDungeonLootPlan,
} from "./dungeons";

const expeditionIds = Object.keys(ARPG_DUNGEON_CONFIGS) as (keyof typeof ARPG_DUNGEON_CONFIGS)[];

describe("armor retirement in ARPG dungeon rewards", () => {
  it("keeps armor out of every current reward pool and generated plan", () => {
    for (const expeditionId of expeditionIds) {
      expect(ARPG_DUNGEON_CONFIGS[expeditionId].roomLootPools.flat().every((item) => item.kind !== "armor")).toBe(true);
      for (const roll of [0, 0.5, 0.999]) {
        const plan = createDungeonLootPlan(expeditionId, () => roll);
        expect(plan).toHaveLength(4);
        expect(plan.every((item) => item.kind !== "armor")).toBe(true);
      }
    }
  });

  it("accepts a signed legacy armor plan for migration and drains it as legacy data", () => {
    const oldMataPlan = ["iron-sword", "ritual-cloak", "forest-bow", "forest-guardian-armor"];
    expect(isDungeonLootPlanValid("mata-encantada", oldMataPlan)).toBe(true);
    expect(resolveDungeonLootPlan("mata-encantada", oldMataPlan).map((item) => item.kind))
      .toEqual(["weapon", "armor", "weapon", "armor"]);
  });
});
