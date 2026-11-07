import {
  appendMatchLog,
  getAdjacentLanes,
  getLaneSlot,
  updateLaneSlot,
} from "../board/board-state";
import { getCardDefinition } from "../domain/cards";
import {
  applyDamageToCreature,
  computeEffectiveCreatureStats,
  getCreatureCardDefinition,
  removeCreatureStatus,
} from "../domain/creatures";
import { getOppositeSide, stepRng } from "../domain/players";
import type {
  ActionResolutionResult,
  LaneIndex,
  MatchState,
  MatchVisualEvent,
  PlayerSide,
} from "../domain/types";
import { damagePlayerKingdomHeart } from "./victory";

export function executeCreatureInvestida(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
): ActionResolutionResult {
  const allySlot = getLaneSlot(state, side, lane);
  const attacker = allySlot.creature;
  if (!attacker) {
    return {
      ok: false,
      error: "Não há uma Lenda posicionada neste território.",
      state,
      events: [],
    };
  }
  if (!attacker.canAct) {
    return {
      ok: false,
      error: "Esta Lenda já realizou sua ação neste turno ou ainda está se materializando.",
      state,
      events: [],
    };
  }

  const attackerDef = getCreatureCardDefinition(attacker.cardId);
  const attackerStats = computeEffectiveCreatureStats(allySlot)!;
  const enemySide = getOppositeSide(side);

  let nextState = state;
  let targetLane: LaneIndex = lane;
  let redirectedByConfusion = false;
  let attackDamage = attackerStats.effectiveAttack;

  // Check Confusion ("Rastro Invertido"): redirects attack to an adjacent lane and weakens impact
  let updatedAttacker = {
    ...attacker,
    canAct: false,
  };

  if (updatedAttacker.statuses.includes("confused")) {
    updatedAttacker = removeCreatureStatus(updatedAttacker, "confused");
    redirectedByConfusion = true;
    const adjacent = getAdjacentLanes(lane);
    const stepped = stepRng(nextState.rngState);
    nextState = { ...nextState, rngState: stepped.nextState };
    targetLane = adjacent[Math.floor(stepped.value * adjacent.length)] ?? lane;
    attackDamage = Math.max(1, Math.floor(attackDamage * 0.6));
  }

  nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
    ...slot,
    creature: updatedAttacker,
  }));

  const events: MatchVisualEvent[] = [];
  const enemySlot = getLaneSlot(nextState, enemySide, targetLane);

  // Case 1: Enemy creature is standing in the target lane
  if (enemySlot.creature) {
    const defender = enemySlot.creature;
    const defenderDef = getCreatureCardDefinition(defender.cardId);
    const defenderStats = computeEffectiveCreatureStats(enemySlot)!;

    const hitResult = applyDamageToCreature(defender, attackDamage, {
      sourceElement: attackerDef.element,
    });
    nextState = updateLaneSlot(nextState, enemySide, targetLane, (slot) => ({
      ...slot,
      creature: hitResult.creature,
    }));

    events.push({
      kind: "creature-attack",
      attackerSide: side,
      lane,
      targetLane,
      attackerName: attackerDef.name,
      damage: hitResult.damageDealt,
      redirectedByConfusion,
      blockedByVeil: hitResult.blockedByVeil,
      hitHeart: false,
      elementalRelation: hitResult.elementalRelation,
    });

    if (hitResult.blockedByVeil) {
      nextState = appendMatchLog(nextState, {
        side,
        kind: "attack",
        title: `Véu de Ilusão protegeu ${defenderDef.name}!`,
        detail: `A investida de ${attackerDef.name} desfez a miragem na Faixa ${targetLane + 1} sem causar dano.`,
      });
      return { ok: true, state: nextState, events };
    }

    if (hitResult.defeated) {
      events.push({
        kind: "creature-defeated",
        side: enemySide,
        lane: targetLane,
        creatureName: defenderDef.name,
      });
    }

    // Defender counter-damage in melee clash (half of defender's effective attack)
    const counterDamage = Math.max(1, Math.floor(defenderStats.effectiveAttack / 2));
    const currentAttackerSlot = getLaneSlot(nextState, side, lane);
    if (currentAttackerSlot.creature) {
      const counterResult = applyDamageToCreature(currentAttackerSlot.creature, counterDamage);
      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: counterResult.creature,
      }));
      if (counterResult.defeated) {
        events.push({
          kind: "creature-defeated",
          side,
          lane,
          creatureName: attackerDef.name,
        });
      }
    }

    nextState = appendMatchLog(nextState, {
      side,
      kind: "attack",
      title: `${attackerDef.name} investiu contra ${defenderDef.name}${redirectedByConfusion ? " (Desviado por Confusão!)" : ""}`,
      detail: `Causou ${hitResult.damageDealt} de dano na Faixa ${targetLane + 1}${hitResult.defeated ? ` e derrotou ${defenderDef.name}!` : "."}`,
    });

    return { ok: true, state: nextState, events };
  }

  // Case 2: No enemy creature, but an enemy Structure guards the lane
  if (enemySlot.structure) {
    const structure = enemySlot.structure;
    const structureDef = getCardDefinition(structure.cardId);
    const remainingStructureHp = structure.currentHp - attackDamage;

    events.push({
      kind: "creature-attack",
      attackerSide: side,
      lane,
      targetLane,
      attackerName: attackerDef.name,
      damage: attackDamage,
      redirectedByConfusion,
      hitHeart: remainingStructureHp < 0,
    });

    if (remainingStructureHp <= 0) {
      nextState = updateLaneSlot(nextState, enemySide, targetLane, (slot) => ({
        ...slot,
        structure: null,
      }));
      events.push({
        kind: "structure-destroyed",
        side: enemySide,
        lane: targetLane,
        structureName: structureDef.name,
      });
      nextState = appendMatchLog(nextState, {
        side,
        kind: "structure",
        title: `${attackerDef.name} demoliu ${structureDef.name}!`,
        detail: `A Estrutura inimiga na Faixa ${targetLane + 1} ruiu.`,
      });

      const overflowDamage = Math.abs(remainingStructureHp);
      if (overflowDamage > 0) {
        const heartResult = damagePlayerKingdomHeart(
          nextState,
          enemySide,
          overflowDamage,
          attackerDef.name,
        );
        nextState = heartResult.state;
        events.push(...heartResult.events);
      }
    } else {
      nextState = updateLaneSlot(nextState, enemySide, targetLane, (slot) => ({
        ...slot,
        structure: {
          ...structure,
          currentHp: remainingStructureHp,
        },
      }));
      nextState = appendMatchLog(nextState, {
        side,
        kind: "attack",
        title: `${attackerDef.name} sitiou ${structureDef.name}`,
        detail: `Causou ${attackDamage} de dano à Estrutura na Faixa ${targetLane + 1}.`,
      });
    }

    return { ok: true, state: nextState, events };
  }

  // Case 3: Open lane -> Direct strike on the enemy's Kingdom Heart!
  events.push({
    kind: "creature-attack",
    attackerSide: side,
    lane,
    targetLane,
    attackerName: attackerDef.name,
    damage: attackDamage,
    redirectedByConfusion,
    hitHeart: true,
  });

  const heartStrike = damagePlayerKingdomHeart(
    nextState,
    enemySide,
    attackDamage,
    `${attackerDef.name} (Faixa ${targetLane + 1})`,
  );

  return {
    ok: true,
    state: heartStrike.state,
    events: [...events, ...heartStrike.events],
  };
}
