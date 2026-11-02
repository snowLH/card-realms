import { removeCreatureStatus } from "../domain/creatures";
import { getOppositeSide } from "../domain/players";
import { getTerritoryBiome, resolveElementalBiomeReaction } from "../domain/territories";
import type {
  LaneIndex,
  MatchState,
  MatchVisualEvent,
  PlayerSide,
  TerritoryBiomeId,
} from "../domain/types";
import { appendMatchLog, getLaneSlot, updateLaneSlot } from "./board-state";

export function transformLaneBiome(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  nextBiomeId: TerritoryBiomeId,
  reason: string,
): { state: MatchState; events: MatchVisualEvent[] } {
  const currentSlot = getLaneSlot(state, side, lane);
  const previousBiomeId = currentSlot.biomeId;

  if (previousBiomeId === nextBiomeId) {
    return { state, events: [] };
  }

  let nextState = updateLaneSlot(state, side, lane, (slot) => ({
    ...slot,
    biomeId: nextBiomeId,
    turnModified: state.turn,
  }));

  const nextBiomeDef = getTerritoryBiome(nextBiomeId);
  if (nextBiomeDef.preventsEnemyVeilInLane) {
    const enemySide = getOppositeSide(side);
    const enemySlot = getLaneSlot(nextState, enemySide, lane);
    if (enemySlot.creature && enemySlot.creature.statuses.includes("veiled")) {
      nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
        ...slot,
        creature: slot.creature ? removeCreatureStatus(slot.creature, "veiled") : null,
      }));
    }
  }

  nextState = appendMatchLog(nextState, {
    side,
    kind: "territory",
    title: `Faixa ${lane + 1}: ${nextBiomeDef.name}`,
    detail: reason,
  });

  const events: MatchVisualEvent[] = [
    {
      kind: "territory-transformed",
      side,
      lane,
      previousBiomeId,
      nextBiomeId,
      reason,
    },
  ];

  return { state: nextState, events };
}

export function triggerElementalTerrainReaction(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  catalyst: "fire" | "water" | "nature" | "spirit" | "frost",
): { state: MatchState; events: MatchVisualEvent[] } {
  const slot = getLaneSlot(state, side, lane);
  const reaction = resolveElementalBiomeReaction(slot.biomeId, catalyst);
  if (!reaction.reacted) {
    return { state, events: [] };
  }
  return transformLaneBiome(state, side, lane, reaction.nextBiome, reaction.reason);
}
