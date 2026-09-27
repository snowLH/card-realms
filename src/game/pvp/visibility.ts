import type { BattleState } from "../battle";

export type PvpVisibleState = {
  state: BattleState;
  hidden: {
    opponentHandCount: number;
    opponentDeckCount: number;
  };
};

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
  return { state: visible, hidden };
}
