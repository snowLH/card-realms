export const ELEMENTS = ["fire", "water", "nature", "storm", "spirit"] as const;

export type Element = (typeof ELEMENTS)[number];

export type EnergyPool = Record<Element, number>;
export type EnergyCost = Partial<Record<Element, number>>;

export type ElementMeta = {
  name: string;
  short: string;
  color: string;
  glow: string;
};

export const ELEMENT_META: Record<Element, ElementMeta> = {
  fire: {
    name: "Fogo",
    short: "FO",
    color: "#ff7548",
    glow: "rgba(255, 117, 72, .38)",
  },
  water: {
    name: "Água",
    short: "AG",
    color: "#4ecbff",
    glow: "rgba(78, 203, 255, .38)",
  },
  nature: {
    name: "Natureza",
    short: "NA",
    color: "#7fe08d",
    glow: "rgba(127, 224, 141, .34)",
  },
  storm: {
    name: "Tempestade",
    short: "TE",
    color: "#ffd85e",
    glow: "rgba(255, 216, 94, .34)",
  },
  spirit: {
    name: "Espírito",
    short: "ES",
    color: "#ba8cff",
    glow: "rgba(186, 140, 255, .38)",
  },
};

/**
 * A closed five-link affinity cycle keeps every element equally strong and
 * weak. It is deliberately centralized so cards, AI and UI cannot drift.
 */
export const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  fire: "nature",
  nature: "spirit",
  spirit: "storm",
  storm: "water",
  water: "fire",
};

export function emptyEnergyPool(): EnergyPool {
  return {
    fire: 0,
    water: 0,
    nature: 0,
    storm: 0,
    spirit: 0,
  };
}

export function elementMultiplier(attacker: Element, defender: Element): number {
  if (ELEMENT_ADVANTAGE[attacker] === defender) return 1.25;
  if (ELEMENT_ADVANTAGE[defender] === attacker) return 0.8;
  return 1;
}
