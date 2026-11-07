import { appendMatchLog, createInitialBoardLanes } from "../board/board-state";
import { executeMoveCreature, executeSacrificeSlot } from "../board/movement";
import {
  buildStructureCardOnBoard,
  placeTerritoryCardOnBoard,
  summonCreatureCardOnBoard,
} from "../board/placement";
import {
  getCardDefinition,
  isCreatureCard,
  isEventCard,
  isStructureCard,
  isTerritoryCard,
} from "../domain/cards";
import { getCulture } from "../domain/cultures";
import { canPlayCardOnLane } from "../domain/match-rules";
import {
  createPlayerMatchState,
  getOppositeSide,
  hashSeedToUint32,
  INITIAL_MAX_BREATH,
} from "../domain/players";
import type {
  ActionResolutionResult,
  CultureId,
  MatchAction,
  MatchMode,
  MatchState,
  MatchVisualEvent,
  WeatherEffectId,
} from "../domain/types";
import { getWeatherDefinition } from "../domain/weather";
import { executeCreatureDespertar } from "./abilities";
import { type AiProfile, chooseNextAiAction } from "./ai-strategist";
import { executeCreatureInvestida } from "./combat";
import { executeEventCardOnBoard } from "./events";
import { executeEndTurn } from "./turn-system";
import { evaluateMatchVictory } from "./victory";

export function createInitialMatchState(options?: {
  seed?: string;
  mode?: MatchMode;
  playerCulture?: CultureId;
  opponentCulture?: CultureId;
  playerName?: string;
  opponentName?: string;
  weather?: WeatherEffectId;
  campaignChapter?: number;
  playerDeckCardIds?: readonly string[];
  opponentDeckCardIds?: readonly string[];
}): MatchState {
  const seed = options?.seed ?? "card-realms-vertical-slice-seed";
  const mode: MatchMode = options?.mode ?? "demo-guided";
  const playerCulture: CultureId = options?.playerCulture ?? "brasil";
  const opponentCulture: CultureId =
    options?.opponentCulture ?? (playerCulture === "brasil" ? "japao" : "brasil");
  const weather: WeatherEffectId = options?.weather ?? "clima-sereno";

  const rng0 = hashSeedToUint32(seed);
  const playerSetup = createPlayerMatchState({
    side: "player",
    name: options?.playerName ?? `Estrategista (${getCulture(playerCulture).countryLabel})`,
    culture: playerCulture,
    mode,
    rngState: rng0,
    initialBreath: INITIAL_MAX_BREATH,
    customDeckCardIds: options?.playerDeckCardIds,
  });

  const opponentSetup = createPlayerMatchState({
    side: "opponent",
    name:
      options?.opponentName ??
      (mode === "local-pass-and-play"
        ? `Jogador 2 (${getCulture(opponentCulture).countryLabel})`
        : `Guardião das Lendas (${getCulture(opponentCulture).countryLabel})`),
    culture: opponentCulture,
    mode,
    rngState: playerSetup.nextRngState,
    initialBreath: INITIAL_MAX_BREATH,
    customDeckCardIds: options?.opponentDeckCardIds,
  });

  const lanes = createInitialBoardLanes(playerCulture, opponentCulture);

  const initial: MatchState = {
    matchId: `match-${seed}`,
    seed,
    rngState: opponentSetup.nextRngState,
    mode,
    turn: 1,
    activeSide: "player",
    winner: null,
    winReason: null,
    weather,
    campaignChapter: options?.campaignChapter,
    players: {
      player: playerSetup.player,
      opponent: opponentSetup.player,
    },
    lanes,
    log: [],
    guidedStep: 0,
  };

  return appendMatchLog(initial, {
    side: "player",
    kind: "turn",
    title: "O Tabuleiro Vivo Desperta",
    detail: `${getCulture(playerCulture).name} enfrenta ${getCulture(opponentCulture).name}. Proteja seu Coração do Reino!`,
  });
}

function advanceGuidedStepIfApplicable(state: MatchState, action: MatchAction): MatchState {
  if (state.mode !== "demo-guided") return state;
  if (state.guidedStep === 0 && action.type === "play-card" && action.side === "player") {
    return { ...state, guidedStep: 1 };
  }
  if (state.guidedStep === 1 && action.type === "play-card" && action.side === "player") {
    return { ...state, guidedStep: 2 };
  }
  if (state.guidedStep <= 2 && action.type === "end-turn" && action.side === "player") {
    return { ...state, guidedStep: 3 };
  }
  if (
    state.guidedStep === 3 &&
    (action.type === "creature-despertar" || action.type === "creature-investida") &&
    action.side === "player"
  ) {
    return { ...state, guidedStep: 4 };
  }
  return state;
}

export function applyMatchAction(
  state: MatchState,
  action: MatchAction,
): ActionResolutionResult {
  if (state.winner !== null) {
    return {
      ok: false,
      error: "A partida já terminou.",
      state,
      events: [],
    };
  }

  if (action.side && action.side !== state.activeSide) {
    return {
      ok: false,
      error: "Aguarde a vez do seu reino.",
      state,
      events: [],
    };
  }

  switch (action.type) {
    case "play-card": {
      const player = state.players[action.side];
      const handIndex = player.hand.findIndex(
        (item) => item.instanceId === action.handInstanceId,
      );
      if (handIndex < 0) {
        return {
          ok: false,
          error: "Carta não encontrada na mão.",
          state,
          events: [],
        };
      }

      const handInstance = player.hand[handIndex];
      const card = getCardDefinition(handInstance.cardId);
      const legality = canPlayCardOnLane(state, action.side, card, action.lane);
      if (!legality.ok) {
        return {
          ok: false,
          error: legality.reason ?? "Jogada inválida para este território.",
          state,
          events: [],
        };
      }

      // Deduct breath and remove card from hand
      const remainingHand = player.hand.filter(
        (item) => item.instanceId !== action.handInstanceId,
      );
      let nextState: MatchState = {
        ...state,
        players: {
          ...state.players,
          [action.side]: {
            ...player,
            breath: player.breath - card.cost,
            hand: remainingHand,
            graveyard:
              card.category === "event" || card.category === "territory"
                ? [...player.graveyard, handInstance]
                : player.graveyard,
          },
        },
      };

      const events: MatchVisualEvent[] = [];

      if (isTerritoryCard(card)) {
        const placed = placeTerritoryCardOnBoard(
          nextState,
          action.side,
          action.lane!,
          card,
        );
        nextState = placed.state;
        events.push(...placed.events);
      } else if (isCreatureCard(card)) {
        const summoned = summonCreatureCardOnBoard(
          nextState,
          action.side,
          action.lane!,
          card,
          handInstance.instanceId,
        );
        nextState = summoned.state;
        events.push(...summoned.events);
      } else if (isStructureCard(card)) {
        const built = buildStructureCardOnBoard(
          nextState,
          action.side,
          action.lane!,
          card,
          handInstance.instanceId,
        );
        nextState = built.state;
        events.push(...built.events);
      } else if (isEventCard(card)) {
        const executed = executeEventCardOnBoard(
          nextState,
          action.side,
          card,
          action.lane,
        );
        nextState = executed.state;
        events.push(...executed.events);
      }

      const victoryCheck = evaluateMatchVictory(nextState);
      nextState = advanceGuidedStepIfApplicable(victoryCheck.state, action);
      return {
        ok: true,
        state: nextState,
        events: [...events, ...victoryCheck.events],
      };
    }

    case "creature-investida": {
      const result = executeCreatureInvestida(state, action.side, action.lane);
      if (!result.ok) return result;
      return {
        ...result,
        state: advanceGuidedStepIfApplicable(result.state, action),
      };
    }

    case "creature-despertar": {
      const result = executeCreatureDespertar(
        state,
        action.side,
        action.lane,
        action.targetLane,
      );
      if (!result.ok) return result;
      return {
        ...result,
        state: advanceGuidedStepIfApplicable(result.state, action),
      };
    }

    case "creature-move": {
      const result = executeMoveCreature(state, action.side, action.fromLane, action.toLane);
      if (!result.ok) return result;
      return {
        ...result,
        state: advanceGuidedStepIfApplicable(result.state, action),
      };
    }

    case "sacrifice-slot": {
      const result = executeSacrificeSlot(state, action.side, action.lane);
      if (!result.ok) return result;
      return {
        ...result,
        state: advanceGuidedStepIfApplicable(result.state, action),
      };
    }

    case "set-weather": {
      const weatherDef = getWeatherDefinition(action.weather);
      let nextState: MatchState = {
        ...state,
        weather: action.weather,
      };
      nextState = appendMatchLog(nextState, {
        side: state.activeSide,
        kind: "weather",
        title: "Fenômeno Climático Ativado",
        detail: `${weatherDef.icon} ${weatherDef.name}: ${weatherDef.description}`,
      });
      const events: MatchVisualEvent[] = [
        {
          kind: "weather-changed",
          weather: action.weather,
          weatherName: weatherDef.name,
        },
      ];
      return { ok: true, state: nextState, events };
    }

    case "end-turn": {
      const steppedState = advanceGuidedStepIfApplicable(state, action);
      return executeEndTurn(steppedState, action.side);
    }
  }
}

/**
 * Executes a full AI turn (one action at a time, returning the final state and all visual events)
 * when the opponent is controlled by AI (`mode !== "local-pass-and-play"`).
 */
export function runAiTurnToCompletion(
  state: MatchState,
  profile: AiProfile = "strategic",
): { state: MatchState; events: MatchVisualEvent[] } {
  if (
    state.mode === "local-pass-and-play" ||
    state.activeSide !== "opponent" ||
    state.winner !== null
  ) {
    return { state, events: [] };
  }

  let current = state;
  const allEvents: MatchVisualEvent[] = [];
  let safetyCounter = 0;

  while (current.activeSide === "opponent" && current.winner === null && safetyCounter < 14) {
    safetyCounter += 1;
    const nextAction = chooseNextAiAction(current, "opponent", profile);
    const result = applyMatchAction(current, nextAction);
    if (!result.ok) {
      const forcedEnd = executeEndTurn(current, getOppositeSide("player"));
      current = forcedEnd.state;
      allEvents.push(...forcedEnd.events);
      break;
    }
    current = result.state;
    allEvents.push(...result.events);
    if (nextAction.type === "end-turn") break;
  }

  return { state: current, events: allEvents };
}
