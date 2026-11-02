import { getCardDefinition, isStructureCard } from "../domain/cards";
import { addCreatureStatus, healCreatureInstance } from "../domain/creatures";
import { drawCardsForPlayer } from "../domain/players";
import { getTerritoryBiome } from "../domain/territories";
import type {
  BoardCreatureInstance,
  BoardStructureInstance,
  CreatureCardDefinition,
  LaneIndex,
  MatchState,
  MatchVisualEvent,
  PlayerSide,
  StructureCardDefinition,
  TerritoryCardDefinition,
} from "../domain/types";
import { appendMatchLog, getLaneSlot, updateLaneSlot } from "./board-state";
import { transformLaneBiome } from "./territory-system";

export function placeTerritoryCardOnBoard(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  card: TerritoryCardDefinition,
): { state: MatchState; events: MatchVisualEvent[] } {
  const transformed = transformLaneBiome(
    state,
    side,
    lane,
    card.biomeId,
    `${card.name} moldou a Faixa ${lane + 1} em ${getTerritoryBiome(card.biomeId).name}.`,
  );

  let nextState = transformed.state;
  const events: MatchVisualEvent[] = [
    {
      kind: "card-placed",
      side,
      lane,
      cardId: card.id,
      category: "territory",
    },
    ...transformed.events,
  ];

  const slot = getLaneSlot(nextState, side, lane);
  if (slot.creature) {
    let creature = slot.creature;
    if (card.onPlaceEffect.healAllyCreature) {
      creature = healCreatureInstance(creature, card.onPlaceEffect.healAllyCreature);
    }
    if (card.onPlaceEffect.shieldAllyCreature) {
      creature = {
        ...creature,
        shield: creature.shield + card.onPlaceEffect.shieldAllyCreature,
      };
    }
    if (card.onPlaceEffect.buffMaxHpAlly) {
      creature = {
        ...creature,
        maxHp: creature.maxHp + card.onPlaceEffect.buffMaxHpAlly,
        currentHp: creature.currentHp + card.onPlaceEffect.buffMaxHpAlly,
      };
    }
    nextState = updateLaneSlot(nextState, side, lane, (current) => ({
      ...current,
      creature,
    }));
  }

  if (card.onPlaceEffect.drawCards) {
    const drawnResult = drawCardsForPlayer(nextState.players[side], card.onPlaceEffect.drawCards);
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [side]: drawnResult.player,
      },
    };
  }

  return { state: nextState, events };
}

export function summonCreatureCardOnBoard(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  card: CreatureCardDefinition,
  instanceId: string,
): { state: MatchState; events: MatchVisualEvent[] } {
  const slot = getLaneSlot(state, side, lane);
  const biome = getTerritoryBiome(slot.biomeId);

  const hpBonus = biome.summonMaxHpBonus ?? 0;
  const isFavored = card.favoredBiomes.includes(slot.biomeId);
  const shieldBonus =
    (biome.summonShieldBonus ?? 0) + (isFavored ? (card.biomeShieldBonus ?? 0) : 0);

  let creature: BoardCreatureInstance = {
    instanceId,
    cardId: card.id,
    owner: side,
    lane,
    baseAttack: card.attack,
    currentHp: card.maxHp + hpBonus,
    maxHp: card.maxHp + hpBonus,
    shield: shieldBonus,
    canAct: Boolean(card.swiftArrival),
    summonedTurn: state.turn,
    usedPowerCount: 0,
    statuses: [],
  };

  if (slot.structure) {
    const structureDef = getCardDefinition(slot.structure.cardId);
    if (isStructureCard(structureDef) && structureDef.effectId === "portao-torii-espiritual") {
      creature = addCreatureStatus(creature, "veiled");
    }
  }

  let nextState = updateLaneSlot(state, side, lane, (current) => ({
    ...current,
    creature,
  }));

  nextState = appendMatchLog(nextState, {
    side,
    kind: "summon",
    title: `${card.name} materializado na Faixa ${lane + 1}`,
    detail: `${card.name} surgiu sobre ${biome.name}${isFavored ? " (Sinergia de Terreno Ativa!)" : ""}.`,
  });

  const events: MatchVisualEvent[] = [
    {
      kind: "card-placed",
      side,
      lane,
      cardId: card.id,
      category: "creature",
    },
    {
      kind: "creature-summoned",
      side,
      lane,
      cardId: card.id,
      creatureName: card.name,
      biomeId: slot.biomeId,
      element: card.element,
    },
  ];

  return { state: nextState, events };
}

export function buildStructureCardOnBoard(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  card: StructureCardDefinition,
  instanceId: string,
): { state: MatchState; events: MatchVisualEvent[] } {
  const structure: BoardStructureInstance = {
    instanceId,
    cardId: card.id,
    owner: side,
    lane,
    currentHp: card.maxHp,
    maxHp: card.maxHp,
  };

  let nextState = updateLaneSlot(state, side, lane, (current) => ({
    ...current,
    structure,
  }));

  nextState = appendMatchLog(nextState, {
    side,
    kind: "structure",
    title: `${card.name} erguido na Faixa ${lane + 1}`,
    detail: card.description,
  });

  const events: MatchVisualEvent[] = [
    {
      kind: "card-placed",
      side,
      lane,
      cardId: card.id,
      category: "structure",
    },
    {
      kind: "structure-built",
      side,
      lane,
      cardId: card.id,
      structureName: card.name,
    },
  ];

  return { state: nextState, events };
}
