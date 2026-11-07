import {
  applyTurnEndFieldEffects,
  applyTurnStartFieldEffects,
} from "../board/battlefield-effects";
import { appendMatchLog } from "../board/board-state";
import {
  drawCardsForPlayer,
  getOppositeSide,
  MAX_BREATH_CAP,
} from "../domain/players";
import type {
  ActionResolutionResult,
  MatchState,
  MatchVisualEvent,
  PlayerSide,
} from "../domain/types";
import { evaluateMatchVictory } from "./victory";

export function executeEndTurn(
  state: MatchState,
  side: PlayerSide,
): ActionResolutionResult {
  if (state.winner !== null) {
    return {
      ok: false,
      error: "A partida já foi encerrada.",
      state,
      events: [],
    };
  }
  if (state.activeSide !== side) {
    return {
      ok: false,
      error: "Não é o turno deste reino.",
      state,
      events: [],
    };
  }

  const events: MatchVisualEvent[] = [];

  // 1. Resolve end-of-turn field effects for the side ending its turn
  const endField = applyTurnEndFieldEffects(state, side);
  let nextState = endField.state;
  events.push(...endField.events);

  // Reset temporary power bonus for ending player
  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [side]: {
        ...nextState.players[side],
        empowerPowerBonusThisTurn: 0,
      },
    },
  };

  const victoryAfterEnd = evaluateMatchVictory(nextState);
  nextState = victoryAfterEnd.state;
  events.push(...victoryAfterEnd.events);
  if (nextState.winner !== null) {
    return { ok: true, state: nextState, events };
  }

  // 2. Switch active side and increment turn when returning to player (or on each half-turn)
  const nextSide = getOppositeSide(side);
  const nextTurnNumber = nextSide === "player" ? nextState.turn + 1 : nextState.turn;

  // 3. Replenish and expand Sopro Ancestral for the incoming side, and draw 1 card
  const incomingPlayer = nextState.players[nextSide];
  const nextMaxBreath =
    nextTurnNumber === 1 && nextSide === "opponent"
      ? incomingPlayer.maxBreath
      : Math.min(MAX_BREATH_CAP, incomingPlayer.maxBreath + 1);

  const drawn = drawCardsForPlayer(
    {
      ...incomingPlayer,
      maxBreath: nextMaxBreath,
      breath: nextMaxBreath,
      empowerPowerBonusThisTurn: 0,
    },
    1,
  );

  nextState = {
    ...nextState,
    turn: nextTurnNumber,
    activeSide: nextSide,
    players: {
      ...nextState.players,
      [nextSide]: drawn.player,
    },
  };

  if (drawn.drawn.length > 0) {
    events.push({
      kind: "card-drawn",
      side: nextSide,
      count: drawn.drawn.length,
    });
  }

  // 4. Resolve start-of-turn field effects (healing, shields, creature readiness)
  const startField = applyTurnStartFieldEffects(nextState, nextSide);
  nextState = startField.state;
  events.push(...startField.events);

  events.push({
    kind: "turn-started",
    side: nextSide,
    turn: nextTurnNumber,
  });

  nextState = appendMatchLog(nextState, {
    side: nextSide,
    kind: "turn",
    title: `Turno ${nextTurnNumber} — Vez de ${nextState.players[nextSide].name}`,
    detail: `Sopro Ancestral restaurado (${nextMaxBreath}/${nextMaxBreath}).`,
  });

  return {
    ok: true,
    state: nextState,
    events,
  };
}
