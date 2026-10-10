import { describe, expect, it } from "vitest";
import { KING_ARTHUR } from "./king-arthur/definition";
import { bossPhaseAtHp } from "./boss-definition";
import { ARTHUR_PATTERNS, createArthurHazards, insideBossHazard } from "./king-arthur/patterns";
import { BossEncounterSchema, createBossEncounter } from "./boss-encounter-controller";
describe("Arthur phases and readable attacks", () => {
  it("transitions at exactly 70 and 35 percent", () => {
    expect([100, 71, 70, 36, 35, 0].map((hp) => bossPhaseAtHp(KING_ARTHUR, hp, 100))).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it("always provides a windup and an escape route, including Last Oath", () => {
    for (const phase of [1, 2, 3] as const) for (let index = 0; index < ARTHUR_PATTERNS[phase].length; index++) {
      const hazards = createArthurHazards({ phase, index, boss: { x: 976, y: 360 }, target: { id: "p", x: 976, y: 660, alive: true }, width: 1952, height: 992, nowMs: 100 });
      for (const hazard of hazards) expect(hazard.impactAtMs - hazard.createdAtMs).toBeGreaterThanOrEqual(850);
      const safe = Array.from({ length: 80 }, (_, i) => ({ x: 64 + (i % 10) * 180, y: 64 + Math.floor(i / 10) * 110 })).filter((point) => hazards.every((hazard) => !insideBossHazard(point, hazard)));
      expect(safe.length).toBeGreaterThan(8);
    }
  });
  it("does not damage a player behind the frontal royal cut", () => {
    const [cut] = createArthurHazards({ phase: 1, index: 0, boss: { x: 500, y: 500 }, target: { id: "p", x: 600, y: 500, alive: true }, width: 1952, height: 992, nowMs: 0 });
    expect(insideBossHazard({ x: 600, y: 500 }, cut)).toBe(true);
    expect(insideBossHazard({ x: 400, y: 500 }, cut)).toBe(false);
  });
  it("persists telegraphs that extend beyond the north or west arena wall", () => {
    const encounter = createBossEncounter("king-arthur", 0, ["solo"], 2400, { x: 64, y: 64 });
    for (const phase of [1, 2, 3] as const) for (let index = 0; index < ARTHUR_PATTERNS[phase].length; index++) {
      encounter.hazards = createArthurHazards({ phase, index, boss: encounter, target: { id: "solo", x: 20, y: 20, alive: true }, width: 1952, height: 992, nowMs: 100 });
      expect(BossEncounterSchema.safeParse(JSON.parse(JSON.stringify(encounter))).success).toBe(true);
    }
    encounter.hazards = createArthurHazards({ phase: 2, index: 3, boss: encounter, target: { id: "solo", x: 20, y: 20, alive: true }, width: 1952, height: 992, nowMs: 100 });
    expect(encounter.hazards[0].x).toBeLessThan(0);
    expect(encounter.hazards[0].y).toBeLessThan(0);
  });
});
