import { describe, expect, it } from "vitest";
import { ARPG_ABILITY_CARDS } from "./ability-cards";
import { LEGEND_ABILITY_DEFINITIONS } from "./legend-abilities";
import { PLAYABLE_LEGENDS } from "./legends";
import { SIGNATURE_TUNING } from "./legend-balance";

describe("balance of the playable folklore legends", () => {
  it("defines exactly one bounded profile for each signature power", () => {
    expect(PLAYABLE_LEGENDS).toHaveLength(14);
    expect(LEGEND_ABILITY_DEFINITIONS).toHaveLength(28);
    expect(Object.keys(SIGNATURE_TUNING).sort())
      .toEqual(LEGEND_ABILITY_DEFINITIONS.map((power) => power.id).sort());
    for (const [id, [damage, cooldown, radius, healing]] of Object.entries(SIGNATURE_TUNING)) {
      for (const multiplier of [damage, cooldown, radius, healing]) {
        expect(multiplier, id).toBeGreaterThanOrEqual(0.8);
        expect(multiplier, id).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it("keeps each legend playable with distinct abilities and bounded combat stats", () => {
    for (const legend of PLAYABLE_LEGENDS) {
      const powers = ARPG_ABILITY_CARDS.filter((power) => power.creatureId === legend.id);
      expect(powers, legend.name).toHaveLength(2);
      expect(new Set(powers.map((power) => power.id)).size).toBe(2);
      expect(powers.every((power) => power.cooldownMs >= 2800 && power.cooldownMs <= 14000)).toBe(true);
      expect(powers.every((power) => power.damage >= 0 && power.damage <= 88)).toBe(true);
      expect(powers.every((power) => (power.radius ?? 1) >= 1)).toBe(true);
    }
  });

  it("preserves healing and precise skills as fundamentally different playstyles", () => {
    const iaraHealing = ARPG_ABILITY_CARDS.find((power) => power.id === "iara-living-spring");
    const ratatoskrShot = ARPG_ABILITY_CARDS.find((power) => power.id === "ratatoskr-acorn-shot");
    const mapinguariCrush = ARPG_ABILITY_CARDS.find((power) => power.id === "mapinguari-forest-crush");
    expect(iaraHealing?.restoreHp).toBeGreaterThan(30);
    expect(ratatoskrShot?.cooldownMs).toBeLessThan(3500);
    expect(mapinguariCrush?.damage).toBeGreaterThan(60);
  });
});
