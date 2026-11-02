import { appendMatchLog } from "../board/board-state";
import { applyDamageToKingdomHeart, getOppositeSide } from "../domain/players";
import type { MatchState, MatchVisualEvent, PlayerSide } from "../domain/types";

export function evaluateMatchVictory(
  state: MatchState,
): { state: MatchState; events: MatchVisualEvent[] } {
  if (state.winner !== null) {
    return { state, events: [] };
  }

  const playerHeartHp = state.players.player.heart.currentHp;
  const opponentHeartHp = state.players.opponent.heart.currentHp;

  if (opponentHeartHp <= 0) {
    const reason = `${state.players.opponent.heart.name} caiu! Vitória de ${state.players.player.name}!`;
    const nextState = appendMatchLog(
      {
        ...state,
        winner: "player",
        winReason: reason,
      },
      {
        side: "player",
        kind: "victory",
        title: "Vitória do Reino!",
        detail: reason,
      },
    );
    return {
      state: nextState,
      events: [{ kind: "match-won", winner: "player", reason }],
    };
  }

  if (playerHeartHp <= 0) {
    const reason = `${state.players.player.heart.name} caiu! Vitória de ${state.players.opponent.name}!`;
    const nextState = appendMatchLog(
      {
        ...state,
        winner: "opponent",
        winReason: reason,
      },
      {
        side: "opponent",
        kind: "victory",
        title: "Queda do Coração do Reino",
        detail: reason,
      },
    );
    return {
      state: nextState,
      events: [{ kind: "match-won", winner: "opponent", reason }],
    };
  }

  return { state, events: [] };
}

export function damagePlayerKingdomHeart(
  state: MatchState,
  targetSide: PlayerSide,
  rawDamage: number,
  sourceLabel: string,
): { state: MatchState; events: MatchVisualEvent[] } {
  if (rawDamage <= 0) return { state, events: [] };

  const targetPlayer = state.players[targetSide];
  const result = applyDamageToKingdomHeart(targetPlayer.heart, rawDamage);
  const attackerSide = getOppositeSide(targetSide);

  let nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [targetSide]: {
        ...targetPlayer,
        heart: result.heart,
      },
    },
  };

  nextState = appendMatchLog(nextState, {
    side: attackerSide,
    kind: "heart",
    title: `${sourceLabel} atingiu ${targetPlayer.heart.name}!`,
    detail: `Causou ${result.damageDealt} de dano ao Coração do Reino (${result.heart.currentHp}/${result.heart.maxHp} PV).`,
  });

  const events: MatchVisualEvent[] = [
    {
      kind: "heart-damaged",
      side: targetSide,
      damage: result.damageDealt,
      remainingHp: result.heart.currentHp,
    },
  ];

  const victoryCheck = evaluateMatchVictory(nextState);
  return {
    state: victoryCheck.state,
    events: [...events, ...victoryCheck.events],
  };
}
