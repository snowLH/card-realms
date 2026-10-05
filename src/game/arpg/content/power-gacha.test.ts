import { describe, expect, it } from "vitest";
import {
  ARPG_POWER_GACHA_BASE_PROBABILITIES,
  ARPG_POWER_GACHA_FRAGMENT_COSTS,
  getArpgPowerGachaFragmentCost,
  getArpgPowerGachaProbabilities,
  getRollsUntilPowerGachaGuarantee,
  rollArpgPowerGachaTier,
} from "./power-gacha";

describe("ARPG power gacha odds", () => {
  it("sets fixed fragment redemption prices by card rarity", () => {
    expect(ARPG_POWER_GACHA_FRAGMENT_COSTS).toEqual({
      common: 25,
      uncommon: 40,
      rare: 70,
      epic: 120,
      legendary: 225,
      mythic: 300,
    });
    expect(getArpgPowerGachaFragmentCost("mythic")).toBe(300);
    expect(getArpgPowerGachaFragmentCost("unknown")).toBeNull();
  });

  it("publishes the starting odds as exact, exhaustive percentages", () => {
    expect(ARPG_POWER_GACHA_BASE_PROBABILITIES).toEqual({
      common: 50,
      uncommon: 28,
      rare: 14,
      epic: 6,
      legendary: 2,
    });
    expect(Object.values(ARPG_POWER_GACHA_BASE_PROBABILITIES).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("raises epic-or-better odds after nine misses and guarantees them on miss 20", () => {
    expect(getArpgPowerGachaProbabilities(8)).toEqual({ common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 });
    expect(getArpgPowerGachaProbabilities(9)).toEqual({ common: 46, uncommon: 28, rare: 14, epic: 9.5, legendary: 2.5 });
    expect(getArpgPowerGachaProbabilities(18)).toEqual({ common: 10, uncommon: 28, rare: 14, epic: 41, legendary: 7 });
    expect(getArpgPowerGachaProbabilities(19)).toEqual({ common: 0, uncommon: 0, rare: 0, epic: 75, legendary: 25 });
    expect(getRollsUntilPowerGachaGuarantee(0)).toBe(20);
    expect(getRollsUntilPowerGachaGuarantee(19)).toBe(1);
    expect(rollArpgPowerGachaTier(0.9999, 19)).toBe("epic");
  });

  it("matches the published baseline in a deterministic 120,000-roll simulation", () => {
    let seed = 0x7a11cafe;
    const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    const rollCount = 120_000;

    for (let index = 0; index < rollCount; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      const tier = rollArpgPowerGachaTier(seed / 2 ** 32, 0);
      counts[tier] += 1;
    }

    for (const [tier, expectedPercent] of Object.entries(ARPG_POWER_GACHA_BASE_PROBABILITIES)) {
      const observedPercent = counts[tier as keyof typeof counts] / rollCount * 100;
      expect(Math.abs(observedPercent - expectedPercent), `${tier} baseline`).toBeLessThan(0.8);
    }
  });
});
