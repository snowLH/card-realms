import { describe, expect, it } from "vitest";
import { getCurupiraBossPattern, getCurupiraBossPhase } from "./boss-patterns";

describe("Curupira Ancestral phase patterns", () => {
  it("guarantees one attack from each phase before advancing on burst damage", () => {
    expect(getCurupiraBossPhase(1, 0, 0.1)).toBe(1);
    expect(getCurupiraBossPhase(1, 1, 0.1)).toBe(2);
    expect(getCurupiraBossPhase(2, 0, 0.1)).toBe(2);
    expect(getCurupiraBossPhase(2, 1, 0.1)).toBe(3);
  });

  it("opens with roots and bow in phase one, then returns to both patterns", () => {
    expect([0, 1, 2, 3, 4, 5].map((index) => getCurupiraBossPattern(1, index))).toEqual([
      "roots-burst",
      "bow-volley",
      "bow-volley",
      "roots-burst",
      "bow-volley",
      "bow-volley",
    ]);
  });

  it("uses decoys for ambushes and volleys in phase two", () => {
    expect([0, 1, 2, 3].map((index) => getCurupiraBossPattern(2, index))).toEqual([
      "decoy-ambush",
      "decoy-volley",
      "decoy-ambush",
      "decoy-volley",
    ]);
  });

  it("changes the arena with temporary roots as the phase-three pattern", () => {
    expect([0, 1, 2, 3].map((index) => getCurupiraBossPattern(3, index))).toEqual([
      "root-arena",
      "teleport-volley",
      "root-arena",
      "teleport-volley",
    ]);
  });
});
