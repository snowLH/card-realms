import { ARPG_ABILITY_CARD_BY_ID } from "../arpg/content/ability-cards";
import type { BattleState } from "./types";

export type NpcTurnPlan = {
  attachEnergyCardId?: string;
  abilitySlot?: 0 | 1;
};

export function planNpcTurn(state: BattleState, sideId: string): NpcTurnPlan {
  const side = state.sides.find((candidate) => candidate.id === sideId);
  const target = state.sides.find((candidate) => candidate.id !== sideId);
  if (!side || !target) return {};

  const readySlots = side.abilityCooldowns
    .map((cooldown, slot) => cooldown === 0 ? slot as 0 | 1 : null)
    .filter((slot): slot is 0 | 1 => slot !== null);
  const healing = readySlots.find((slot) => {
    const ability = ARPG_ABILITY_CARD_BY_ID.get(side.abilityIds[slot]);
    return ability?.kind === "defense" && side.hp <= side.maxHp * 0.65;
  });
  const attack = readySlots
    .filter((slot) => (ARPG_ABILITY_CARD_BY_ID.get(side.abilityIds[slot])?.damage ?? 0) > 0)
    .sort((left, right) => {
      const leftCard = ARPG_ABILITY_CARD_BY_ID.get(side.abilityIds[left]);
      const rightCard = ARPG_ABILITY_CARD_BY_ID.get(side.abilityIds[right]);
      return (rightCard?.damage ?? 0) - (leftCard?.damage ?? 0);
    })[0];

  return {
    attachEnergyCardId: side.attachmentsRemaining > 0 ? side.energyHand[0]?.id : undefined,
    abilitySlot: healing ?? attack,
  };
}
