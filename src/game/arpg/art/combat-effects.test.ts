import { describe, expect, it } from "vitest";
import { telegraphFrame, abilityArt } from "./combat-effects";
import { arcClip } from "./arc-clip";
import { ARPG_ABILITY_CARDS, LEGACY_ARPG_ABILITY_CARDS } from "../content/ability-cards";

describe("authored combat art selection", () => {
  it("has an atlas frame for every playable and legacy ability", () => {
    for (const card of [...ARPG_ABILITY_CARDS,...LEGACY_ARPG_ABILITY_CARDS]) for (const frame of Object.values(abilityArt(card))) {
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(64);
    }
  });
  it("keeps warning and impact frames paired in each boss theme", () => {
    const warnings = ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"].map((region) => {
      for (const shape of ["circle", "rectangle", "line"] as const) expect(telegraphFrame(region, shape, true)).toBe(telegraphFrame(region, shape) + 1);
      return telegraphFrame(region, "circle");
    });
    expect(new Set(warnings).size).toBe(3);
  });
  it("clips an authored decal to the mathematical sector without a visible shape", () => {
    expect(arcClip(0, Math.PI)).toMatch(/^polygon\(50% 50%,/);
    expect(arcClip(0, Math.PI * 2)).toBeUndefined();
    expect(arcClip(Math.PI, Math.PI / 2)).not.toBe(arcClip(0, Math.PI / 2));
  });
});
