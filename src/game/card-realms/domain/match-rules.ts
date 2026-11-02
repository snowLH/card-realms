import { DEMO_GUIDED_HINTS } from "../content/starter-decks";
import { getCardDefinition } from "./cards";
import type {
  CardDefinition,
  GuidedStepHint,
  LaneIndex,
  MatchState,
  PlayerSide,
} from "./types";

export function isLaneIndex(value: unknown): value is LaneIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function canPlayerAct(state: MatchState, side: PlayerSide): { ok: boolean; reason?: string } {
  if (state.winner !== null) {
    return { ok: false, reason: "A partida já foi encerrada." };
  }
  if (state.activeSide !== side) {
    return { ok: false, reason: "Aguarde o turno do seu reino." };
  }
  return { ok: true };
}

export function canPlayCardOnLane(
  state: MatchState,
  side: PlayerSide,
  card: CardDefinition,
  lane?: LaneIndex,
): { ok: boolean; reason?: string } {
  const turnCheck = canPlayerAct(state, side);
  if (!turnCheck.ok) return turnCheck;

  const player = state.players[side];
  if (player.breath < card.cost) {
    return {
      ok: false,
      reason: `Sopro Ancestral insuficiente (${player.breath}/${card.cost}).`,
    };
  }

  if (card.category === "creature") {
    if (!isLaneIndex(lane)) {
      return { ok: false, reason: "Escolha um dos 4 territórios para invocar a Lenda." };
    }
    const slot = state.lanes[side][lane];
    if (slot.creature !== null) {
      return { ok: false, reason: "Este território já possui uma Lenda materializada." };
    }
    return { ok: true };
  }

  if (card.category === "territory") {
    if (!isLaneIndex(lane)) {
      return { ok: false, reason: "Escolha um território para transformar o bioma." };
    }
    const slot = state.lanes[side][lane];
    if (slot.biomeId === card.biomeId) {
      return { ok: false, reason: "Este território já possui esse bioma ativo." };
    }
    return { ok: true };
  }

  if (card.category === "structure") {
    if (!isLaneIndex(lane)) {
      return { ok: false, reason: "Escolha um território aliado para erguer a Estrutura." };
    }
    const slot = state.lanes[side][lane];
    if (slot.structure !== null) {
      return { ok: false, reason: "Este território já possui uma Estrutura construída." };
    }
    return { ok: true };
  }

  if (card.category === "event") {
    if (card.requiresLane && !isLaneIndex(lane)) {
      return { ok: false, reason: "Escolha uma faixa de território para desencadear este Evento." };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function getValidLanesForHandCard(
  state: MatchState,
  side: PlayerSide,
  handInstanceId: string,
): LaneIndex[] {
  const player = state.players[side];
  const handCard = player.hand.find((item) => item.instanceId === handInstanceId);
  if (!handCard) return [];
  const card = getCardDefinition(handCard.cardId);

  if (card.category === "event" && !card.requiresLane) {
    return canPlayCardOnLane(state, side, card).ok ? [0, 1, 2, 3] : [];
  }

  return ([0, 1, 2, 3] as const).filter(
    (lane) => canPlayCardOnLane(state, side, card, lane).ok,
  );
}

export function getCurrentGuidedHint(state: MatchState): GuidedStepHint | null {
  if (state.mode !== "demo-guided" || state.winner !== null) return null;
  return DEMO_GUIDED_HINTS[state.guidedStep] ?? null;
}
