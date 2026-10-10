import { describe, expect, it } from "vitest";
import { createBossEncounter, voteBossIntroSkip, advanceBossEncounter } from "./boss-encounter-controller";
import { introPose } from "./boss-intro-controller";
describe("seen intro and synchronized skip", () => {
  it("keeps the first intro mandatory and requires every party member to vote on repeats", () => {
    const throne = { x: 976, y: 144 };
    const first = createBossEncounter("king-arthur", 0, ["a", "b"], 100, throne);
    voteBossIntroSkip(first, "a", 800); expect(first.introDurationMs).toBe(7000);
    const repeat = createBossEncounter("king-arthur", 0, ["a", "b"], 100, throne, true);
    expect(repeat.introDurationMs).toBe(1800);
    voteBossIntroSkip(repeat, "intruder", 800); expect(repeat.skipVotes).toEqual([]);
    voteBossIntroSkip(repeat, "a", 800); voteBossIntroSkip(repeat, "a", 800);
    expect(repeat.introDurationMs).toBe(1800); expect(repeat.skipVotes).toEqual(["a"]);
    voteBossIntroSkip(repeat, "b", 800);
    advanceBossEncounter(repeat, 800, [], { width: 1952, height: 992 });
    expect(repeat.state).toBe("COMBAT");
  });
  it("never needs a disconnected player to skip: the short intro has a finite automatic end", () => {
    const boss = createBossEncounter("king-arthur", 0, ["a", "b"], 100, { x: 976, y: 144 }, true);
    advanceBossEncounter(boss, 1800, [], { width: 1952, height: 992 });
    expect(boss.state).toBe("COMBAT");
  });
  it("shows the seated, struggling, sword support, draw and ready poses in order", () => {
    expect([2800, 3200, 3500, 4000, 4300, 4800, 5200, 5700].map((ms) => introPose(ms, false))).toEqual(["seated", "hand", "head", "eyes", "stumble", "support", "draw", "ready"]);
  });
});
