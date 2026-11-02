import { getCardDefinition, isCreatureCard, isStructureCard } from "./cards";
import { getTerritoryBiome } from "./territories";
import type {
  BoardCreatureInstance,
  CreatureCardDefinition,
  CreatureStatusId,
  TerritorySlotState,
} from "./types";

export const CREATURE_STATUS_LABELS: Readonly<Record<CreatureStatusId, { name: string; description: string }>> = {
  confused: {
    name: "Confuso",
    description: "Rastro invertido: a próxima Investida desvia de rumo com impacto reduzido.",
  },
  veiled: {
    name: "Véu de Ilusão",
    description: "Miragem protetora: anula completamente o próximo golpe recebido.",
  },
  burning: {
    name: "Brasa Viva",
    description: "Chamas guardiãs: sofre 1 de dano ígneo ao final do turno.",
  },
  rooted: {
    name: "Enraizado",
    description: "Preso pelas raízes ou correnteza: -1 ATQ e não pode trocar de faixa.",
  },
  empowered: {
    name: "Despertar Elevado",
    description: "Inspirado pelo vento ou eclipse: +2 ATQ neste turno.",
  },
};

export function getCreatureCardDefinition(cardId: string): CreatureCardDefinition {
  const card = getCardDefinition(cardId);
  if (!isCreatureCard(card)) {
    throw new Error(`A carta ${cardId} não é uma Carta de Lenda.`);
  }
  return card;
}

export type EffectiveCreatureStats = {
  effectiveAttack: number;
  baseAttack: number;
  biomeBonus: number;
  structureBonus: number;
  statusDelta: number;
  isFavoredTerrain: boolean;
  currentHp: number;
  maxHp: number;
  shield: number;
};

/**
 * Pure calculation of a materialized creature's effective stats on its active territory slot.
 */
export function computeEffectiveCreatureStats(slot: TerritorySlotState): EffectiveCreatureStats | null {
  const creature = slot.creature;
  if (!creature) return null;

  const definition = getCreatureCardDefinition(creature.cardId);
  const biome = getTerritoryBiome(slot.biomeId);

  const isFavoredTerrain =
    definition.favoredBiomes.includes(slot.biomeId) ||
    biome.favoredElements.includes(definition.element);

  let biomeBonus = isFavoredTerrain ? Math.max(definition.biomeAttackBonus, biome.attackBonusForFavored) : 0;

  if (biome.attackPenaltyForElement && biome.attackPenaltyForElement.element === definition.element) {
    biomeBonus -= biome.attackPenaltyForElement.penalty;
  }

  let structureBonus = 0;
  if (slot.structure) {
    const structureDef = getCardDefinition(slot.structure.cardId);
    if (isStructureCard(structureDef) && structureDef.attackAuraBonus) {
      structureBonus += structureDef.attackAuraBonus;
      if (structureDef.favorBiomeId && structureDef.favorBiomeId === slot.biomeId) {
        structureBonus += 1;
      }
    }
  }

  let statusDelta = 0;
  if (creature.statuses.includes("empowered")) statusDelta += 2;
  if (creature.statuses.includes("rooted")) statusDelta -= 1;

  const effectiveAttack = Math.max(1, creature.baseAttack + biomeBonus + structureBonus + statusDelta);

  return {
    effectiveAttack,
    baseAttack: creature.baseAttack,
    biomeBonus,
    structureBonus,
    statusDelta,
    isFavoredTerrain,
    currentHp: creature.currentHp,
    maxHp: creature.maxHp,
    shield: creature.shield,
  };
}

export function addCreatureStatus(
  creature: BoardCreatureInstance,
  status: CreatureStatusId,
): BoardCreatureInstance {
  if (creature.statuses.includes(status)) return creature;
  return {
    ...creature,
    statuses: [...creature.statuses, status],
  };
}

export function removeCreatureStatus(
  creature: BoardCreatureInstance,
  status: CreatureStatusId,
): BoardCreatureInstance {
  if (!creature.statuses.includes(status)) return creature;
  return {
    ...creature,
    statuses: creature.statuses.filter((item) => item !== status),
  };
}

/**
 * Applies damage to a materialized creature, respecting Véu de Ilusão (`veiled`) and Shield (`shield`).
 */
export function applyDamageToCreature(
  creature: BoardCreatureInstance,
  rawDamage: number,
  options?: { ignoreVeil?: boolean },
): {
  creature: BoardCreatureInstance | null;
  damageDealt: number;
  blockedByVeil: boolean;
  defeated: boolean;
} {
  if (rawDamage <= 0) {
    return { creature, damageDealt: 0, blockedByVeil: false, defeated: false };
  }

  if (!options?.ignoreVeil && creature.statuses.includes("veiled")) {
    const unveiled = removeCreatureStatus(creature, "veiled");
    return {
      creature: unveiled,
      damageDealt: 0,
      blockedByVeil: true,
      defeated: false,
    };
  }

  const absorbedByShield = Math.min(creature.shield, rawDamage);
  const remainingDamage = rawDamage - absorbedByShield;
  const nextShield = creature.shield - absorbedByShield;
  const nextHp = creature.currentHp - remainingDamage;

  if (nextHp <= 0) {
    return {
      creature: null,
      damageDealt: remainingDamage,
      blockedByVeil: false,
      defeated: true,
    };
  }

  return {
    creature: {
      ...creature,
      shield: nextShield,
      currentHp: nextHp,
    },
    damageDealt: remainingDamage,
    blockedByVeil: false,
    defeated: false,
  };
}

export function healCreatureInstance(
  creature: BoardCreatureInstance,
  amount: number,
): BoardCreatureInstance {
  if (amount <= 0) return creature;
  return {
    ...creature,
    currentHp: Math.min(creature.maxHp, creature.currentHp + amount),
  };
}
