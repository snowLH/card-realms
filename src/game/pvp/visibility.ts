import type { BattleActionResult, BattleLogEntry, BattleState } from "../battle";

export type PvpVisibleState = {
  state: BattleState;
  hidden: {
    opponentHandCount: number;
    opponentDeckCount: number;
  };
};

export function withOpaquePvpEventIds(
  result: BattleActionResult,
  createId: () => string,
): BattleActionResult {
  const state = structuredClone(result.state);
  const replacementIds = new Map(result.events.map((event) => [event.id, createId()]));
  const replace = (event: BattleLogEntry) => ({
    ...event,
    id: replacementIds.get(event.id) ?? event.id,
  });

  state.log = state.log.map(replace);
  return { state, events: result.events.map(replace) };
}

export function visiblePvpEvents(events: readonly BattleLogEntry[]): BattleLogEntry[] {
  return events.map((event, index) => ({
    ...event,
    id: `public-event:${event.turn}:${index + 1}`,
  }));
}

export function visiblePvpState(state: BattleState, playerId: string): PvpVisibleState {
  const visible = structuredClone(state);
  const opponent = visible.sides.find((side) => side.id !== playerId);
  if (!opponent || !visible.sides.some((side) => side.id === playerId)) {
    throw new Error("Jogador não participa desta batalha.");
  }
  const hidden = {
    opponentHandCount: opponent.energyHand.length,
    opponentDeckCount: opponent.energyDeck.length,
  };
  opponent.energyHand = [];
  opponent.energyDeck = [];
  visible.processedActionIds = [];
  visible.log = visiblePvpEvents(visible.log);
  return { state: visible, hidden };
}
