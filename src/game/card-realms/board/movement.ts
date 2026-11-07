import { appendMatchLog } from "./board-state";
import { getCreatureCardDefinition } from "../domain/creatures";
import { getStructureCardDefinition } from "../domain/cards";
import type {
  ActionResolutionResult,
  LaneIndex,
  MatchState,
  MatchVisualEvent,
  PlayerSide,
} from "../domain/types";

export function canMoveCreature(
  state: MatchState,
  side: PlayerSide,
  fromLane: LaneIndex,
  toLane: LaneIndex,
): { ok: boolean; reason?: string } {
  if (state.winner) {
    return { ok: false, reason: "A partida já foi concluída." };
  }
  if (state.activeSide !== side) {
    return { ok: false, reason: "Só é possível mover criaturas no seu próprio turno." };
  }
  if (fromLane === toLane) {
    return { ok: false, reason: "A faixa de destino deve ser diferente da atual." };
  }
  if (Math.abs(fromLane - toLane) !== 1) {
    return { ok: false, reason: "A criatura só pode se deslocar para faixas adjacentes (±1)." };
  }

  const fromSlot = state.lanes[side][fromLane];
  const toSlot = state.lanes[side][toLane];

  if (!fromSlot.creature) {
    return { ok: false, reason: "Não há criatura na faixa de origem para deslocar." };
  }
  if (toSlot.creature) {
    return { ok: false, reason: "A faixa de destino já está ocupada por outra criatura aliada." };
  }
  if (fromSlot.creature.statuses.includes("rooted")) {
    return { ok: false, reason: "A criatura está Enraizada e não pode se movimentar." };
  }

  const player = state.players[side];
  const moveCost = 1;
  if (player.breath < moveCost) {
    return {
      ok: false,
      reason: `Sopro Ancestral insuficiente (necessário ${moveCost}, você tem ${player.breath}).`,
    };
  }

  return { ok: true };
}

export function executeMoveCreature(
  state: MatchState,
  side: PlayerSide,
  fromLane: LaneIndex,
  toLane: LaneIndex,
): ActionResolutionResult {
  const check = canMoveCreature(state, side, fromLane, toLane);
  if (!check.ok) {
    return { ok: false, error: check.reason, state, events: [] };
  }

  const fromSlot = state.lanes[side][fromLane];
  const creature = fromSlot.creature!;
  const cardDef = getCreatureCardDefinition(creature.cardId);

  const moveCost = 1;
  const updatedCreature = {
    ...creature,
    lane: toLane,
  };

  const updatedFromSlot = {
    ...fromSlot,
    creature: null,
    turnModified: state.turn,
  };

  const updatedToSlot = {
    ...state.lanes[side][toLane],
    creature: updatedCreature,
    turnModified: state.turn,
  };

  const updatedSideLanes = [...state.lanes[side]] as typeof state.lanes[PlayerSide];
  updatedSideLanes[fromLane] = updatedFromSlot;
  updatedSideLanes[toLane] = updatedToSlot;

  const player = state.players[side];
  const updatedPlayer = {
    ...player,
    breath: player.breath - moveCost,
  };

  let nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [side]: updatedPlayer,
    },
    lanes: {
      ...state.lanes,
      [side]: updatedSideLanes,
    },
  };

  nextState = appendMatchLog(nextState, {
    side,
    kind: "move",
    title: "Manobra Tática de Faixa",
    detail: `${cardDef.name} deslocou-se da Faixa ${fromLane + 1} para a Faixa ${toLane + 1}.`,
  });

  const events: MatchVisualEvent[] = [
    {
      kind: "creature-moved",
      side,
      fromLane,
      toLane,
      creatureName: cardDef.name,
    },
  ];

  return { ok: true, state: nextState, events };
}

export function canSacrificeSlot(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
): { ok: boolean; reason?: string } {
  if (state.winner) {
    return { ok: false, reason: "A partida já foi concluída." };
  }
  if (state.activeSide !== side) {
    return { ok: false, reason: "O sacrifício ritual só pode ser feito no seu turno." };
  }

  const slot = state.lanes[side][lane];
  if (!slot.creature && !slot.structure) {
    return { ok: false, reason: "Não há criatura nem estrutura neste território para canalizar." };
  }

  return { ok: true };
}

export function executeSacrificeSlot(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
): ActionResolutionResult {
  const check = canSacrificeSlot(state, side, lane);
  if (!check.ok) {
    return { ok: false, error: check.reason, state, events: [] };
  }

  const slot = state.lanes[side][lane];
  const player = state.players[side];
  let refundBreath = 1;
  let targetKind: "creature" | "structure" = "creature";
  const title = slot.creature
    ? "Sacrifício Ritual da Lenda"
    : "Desmanche de Estrutura Sagrada";
  let detail = "";

  const updatedSlot = { ...slot, turnModified: state.turn };

  if (slot.creature) {
    targetKind = "creature";
    refundBreath = 1;
    const def = getCreatureCardDefinition(slot.creature.cardId);
    detail = `${def.name} dissolveu sua forma física na Faixa ${lane + 1}, canalizando +${refundBreath} Sopro Ancestral e +1 Escudo ao Coração do Reino.`;
    updatedSlot.creature = null;
  } else if (slot.structure) {
    targetKind = "structure";
    refundBreath = 2;
    const def = getStructureCardDefinition(slot.structure.cardId);
    detail = `${def.name} foi demolida ritualmente na Faixa ${lane + 1}, convertendo suas pedras em +${refundBreath} Sopro Ancestral.`;
    updatedSlot.structure = null;
  }

  const updatedSideLanes = [...state.lanes[side]] as typeof state.lanes[PlayerSide];
  updatedSideLanes[lane] = updatedSlot;

  const nextBreath = Math.min(player.maxBreath, player.breath + refundBreath);
  const nextHeart = {
    ...player.heart,
    shield: targetKind === "creature" ? player.heart.shield + 1 : player.heart.shield,
  };

  const updatedPlayer = {
    ...player,
    breath: nextBreath,
    heart: nextHeart,
  };

  let nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [side]: updatedPlayer,
    },
    lanes: {
      ...state.lanes,
      [side]: updatedSideLanes,
    },
  };

  nextState = appendMatchLog(nextState, {
    side,
    kind: "sacrifice",
    title,
    detail,
  });

  const events: MatchVisualEvent[] = [
    {
      kind: "slot-sacrificed",
      side,
      lane,
      targetKind,
      refundBreath,
    },
  ];

  return { ok: true, state: nextState, events };
}
