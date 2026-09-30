import type { AttackDefinition } from "../domain/creatures";
import { ELEMENTS, elementMultiplier, type Element } from "../domain/elements";
import { canEvolveActiveCreature, canPayCost, energyPoolFor, getActive, getAttackById, getDefinition, getOpponent, getSide } from "./engine";
import type { BattleState } from "./types";

export type NpcPlan = {
  forcedSwitchIndex?: number;
  attachments: Array<{ cardId: string; creatureIndex: number }>;
  evolve?: boolean;
  attackId?: string;
};

function missingElements(attack: AttackDefinition, attached: ReturnType<typeof energyPoolFor>): Element[] {
  const missing: Element[] = [];
  for (const element of ELEMENTS) {
    const needed = Math.max(0, (attack.cost[element] ?? 0) - attached[element]);
    for (let count = 0; count < needed; count += 1) missing.push(element);
  }
  return missing;
}

export function planNpcTurn(state: BattleState, sideId: string): NpcPlan {
  const side = getSide(state, sideId);
  const plan: NpcPlan = { attachments: [] };
  if (state.turn.phase === "forced_switch") {
    const candidates = side.team
      .map((creature, index) => ({ creature, index }))
      .filter(({ creature }) => !creature.defeated)
      .sort((a, b) => b.creature.hp / b.creature.maxHp - a.creature.hp / a.creature.maxHp);
    plan.forcedSwitchIndex = candidates[0]?.index;
    return plan;
  }

  const active = getActive(side);
  const definition = getDefinition(active);
  const shouldEvolve = canEvolveActiveCreature(state, sideId)
    && (active.hp <= active.maxHp * 0.75 || active.attachedEnergy.length >= 4);
  if (shouldEvolve) plan.evolve = true;
  const defender = getDefinition(getActive(getOpponent(state, sideId)));
  const attachedPool = energyPoolFor(active.attachedEnergy);
  const handByElement = new Map<Element, string[]>();
  for (const element of ELEMENTS) handByElement.set(element, []);
  for (const card of side.energyHand) handByElement.get(card.element)!.push(card.id);

  const candidates = active.equippedPowerIds
    .map((attackId) => getAttackById(attackId))
    .filter((attack): attack is AttackDefinition => Boolean(attack))
    .map((attack) => {
      const missing = missingElements(attack, attachedPool);
      const canPrepare = missing.length <= side.attachmentsRemaining && missing.every((element, index) => {
        const usedBefore = missing.slice(0, index).filter((candidate) => candidate === element).length;
        return (handByElement.get(element)?.length ?? 0) > usedBefore;
      });
      const hitChance = (7 - attack.minRoll) / 6;
      const score = attack.damage * hitChance * elementMultiplier(definition.element, defender.element);
      return { attack, missing, canPrepare, score };
    })
    .filter((candidate) => candidate.canPrepare)
    .sort((a, b) => b.score - a.score);

  const selected = candidates[0];
  if (!selected) return plan;
  for (const element of selected.missing) {
    const cardId = handByElement.get(element)!.shift();
    if (cardId) plan.attachments.push({ cardId, creatureIndex: side.activeIndex });
  }
  const virtualCards = [...active.attachedEnergy, ...plan.attachments.map(({ cardId }) => side.energyHand.find((card) => card.id === cardId)!)];
  if (canPayCost(virtualCards, selected.attack.cost)) plan.attackId = selected.attack.id;
  return plan;
}
