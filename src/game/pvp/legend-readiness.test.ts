import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { hasMatchingLegendPowerPair } from "./legend-readiness";

describe("PvP Legend readiness", () => {
  it("accepts exactly the active Legend's two signature powers", () => {
    expect(hasMatchingLegendPowerPair(DEFAULT_AVATAR_CONFIG, [
      "curupira-root-snare",
      "curupira-ember-arrow",
    ])).toBe(true);
  });

  it("rejects owned powers that belong to another Legend", () => {
    const iara = { ...DEFAULT_AVATAR_CONFIG, legendId: "iara" as const };
    expect(hasMatchingLegendPowerPair(iara, [
      "curupira-root-snare",
      "curupira-ember-arrow",
    ])).toBe(false);
  });

  it.each([
    ["one power", ["curupira-root-snare"]],
    ["duplicate powers", ["curupira-root-snare", "curupira-root-snare"]],
    ["an unknown power", ["curupira-root-snare", "not-a-power"]],
  ])("rejects %s", (_description, abilityIds) => {
    expect(hasMatchingLegendPowerPair(DEFAULT_AVATAR_CONFIG, abilityIds)).toBe(false);
  });

  it("rejects an invalid avatar", () => {
    expect(hasMatchingLegendPowerPair({}, [
      "curupira-root-snare",
      "curupira-ember-arrow",
    ])).toBe(false);
  });
});
