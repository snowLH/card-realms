export const ARPG_POWER_GACHA_COST = 80;
export const ARPG_POWER_GACHA_SOFT_PITY_START = 9;
export const ARPG_POWER_GACHA_HARD_PITY_AFTER = 19;

export type ArpgPowerGachaTier = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ArpgPowerGachaRarity = ArpgPowerGachaTier | "mythic";

export type ArpgPowerGachaProbabilities = Record<ArpgPowerGachaTier, number>;

export const ARPG_POWER_GACHA_FRAGMENT_COSTS: Record<ArpgPowerGachaRarity, number> = {
  common: 25,
  uncommon: 40,
  rare: 70,
  epic: 120,
  legendary: 225,
  mythic: 300,
};

export function getArpgPowerGachaFragmentCost(rarity: string): number | null {
  return rarity in ARPG_POWER_GACHA_FRAGMENT_COSTS
    ? ARPG_POWER_GACHA_FRAGMENT_COSTS[rarity as ArpgPowerGachaRarity]
    : null;
}

export const ARPG_POWER_GACHA_BASE_PROBABILITIES: ArpgPowerGachaProbabilities = {
  common: 50,
  uncommon: 28,
  rare: 14,
  epic: 6,
  legendary: 2,
};

export const ARPG_POWER_GACHA_TIERS: ArpgPowerGachaTier[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export const ARPG_POWER_GACHA_TIER_LABELS: Record<ArpgPowerGachaTier, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};

export function clampPowerGachaPity(misses: number) {
  if (!Number.isFinite(misses)) return 0;
  return Math.max(0, Math.min(ARPG_POWER_GACHA_HARD_PITY_AFTER, Math.floor(misses)));
}

export function getArpgPowerGachaProbabilities(misses: number): ArpgPowerGachaProbabilities {
  const pityMisses = clampPowerGachaPity(misses);
  if (pityMisses >= ARPG_POWER_GACHA_HARD_PITY_AFTER) {
    return { common: 0, uncommon: 0, rare: 0, epic: 75, legendary: 25 };
  }

  const softSteps = Math.max(0, Math.min(10, pityMisses - 8));
  return {
    common: 50 - 4 * softSteps,
    uncommon: 28,
    rare: 14,
    epic: 6 + 3.5 * softSteps,
    legendary: 2 + 0.5 * softSteps,
  };
}

export function rollArpgPowerGachaTier(randomValue: number, misses: number): ArpgPowerGachaTier {
  const probabilities = getArpgPowerGachaProbabilities(misses);
  const point = Math.max(0, Math.min(0.999999999, randomValue)) * 100;
  let boundary = 0;
  for (const tier of ["legendary", "epic", "rare", "uncommon", "common"] as const) {
    boundary += probabilities[tier];
    if (point < boundary) return tier;
  }
  return "common";
}

export function getRollsUntilPowerGachaGuarantee(misses: number) {
  return Math.max(0, 20 - clampPowerGachaPity(misses));
}
