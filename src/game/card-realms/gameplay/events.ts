import { appendMatchLog, getLaneSlot, updateLaneSlot } from "../board/board-state";
import { transformLaneBiome } from "../board/territory-system";
import { getCardDefinition } from "../domain/cards";
import {
  addCreatureStatus,
  applyDamageToCreature,
  getCreatureCardDefinition,
  removeCreatureStatus,
} from "../domain/creatures";
import { drawCardsForPlayer, getOppositeSide } from "../domain/players";
import {
  BOARD_LANES,
  type EventCardDefinition,
  type LaneIndex,
  type MatchState,
  type MatchVisualEvent,
  type PlayerSide,
} from "../domain/types";

export function executeEventCardOnBoard(
  state: MatchState,
  side: PlayerSide,
  card: EventCardDefinition,
  laneParam?: LaneIndex,
): { state: MatchState; events: MatchVisualEvent[] } {
  const enemySide = getOppositeSide(side);
  const lane: LaneIndex = laneParam ?? 0;
  let nextState = state;
  const events: MatchVisualEvent[] = [
    {
      kind: "event-triggered",
      side,
      cardId: card.id,
      eventName: card.name,
      lane: card.requiresLane ? lane : undefined,
    },
  ];

  switch (card.effectId) {
    case "enchente-pororoca": {
      const allyRiver = transformLaneBiome(
        nextState,
        side,
        lane,
        "rio-dos-espiritos",
        `${card.name} inundou a Faixa ${lane + 1} aliada!`,
      );
      nextState = allyRiver.state;
      events.push(...allyRiver.events);

      const enemyRiver = transformLaneBiome(
        nextState,
        enemySide,
        lane,
        "rio-dos-espiritos",
        `${card.name} inundou a Faixa ${lane + 1} inimiga!`,
      );
      nextState = enemyRiver.state;
      events.push(...enemyRiver.events);

      // Clear burning on ally creature in that lane
      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature ? removeCreatureStatus(slot.creature, "burning") : null,
      }));

      // Deal 3 water damage to enemy creature in that lane
      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        const enemyDef = getCreatureCardDefinition(enemySlot.creature.cardId);
        const hit = applyDamageToCreature(enemySlot.creature, 3);
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: hit.creature,
        }));
        if (hit.defeated) {
          events.push({
            kind: "creature-defeated",
            side: enemySide,
            lane,
            creatureName: enemyDef.name,
          });
        }
      }
      break;
    }

    case "incendio-brasa-viva": {
      const enemyVolcano = transformLaneBiome(
        nextState,
        enemySide,
        lane,
        "terra-vulcanica",
        `${card.name} incendiou a Faixa ${lane + 1} inimiga em Terra Vulcânica!`,
      );
      nextState = enemyVolcano.state;
      events.push(...enemyVolcano.events);

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        const enemyDef = getCreatureCardDefinition(enemySlot.creature.cardId);
        const withBurn = addCreatureStatus(enemySlot.creature, "burning");
        const hit = applyDamageToCreature(withBurn, 3);
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: hit.creature,
        }));
        if (hit.defeated) {
          events.push({
            kind: "creature-defeated",
            side: enemySide,
            lane,
            creatureName: enemyDef.name,
          });
        }
      }

      const refreshedEnemySlot = getLaneSlot(nextState, enemySide, lane);
      if (refreshedEnemySlot.structure) {
        const structure = refreshedEnemySlot.structure;
        const structDef = getCardDefinition(structure.cardId);
        const nextStructHp = structure.currentHp - 2;
        if (nextStructHp <= 0) {
          nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
            ...slot,
            structure: null,
          }));
          events.push({
            kind: "structure-destroyed",
            side: enemySide,
            lane,
            structureName: structDef.name,
          });
        } else {
          nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
            ...slot,
            structure: {
              ...structure,
              currentHp: nextStructHp,
            },
          }));
        }
      }
      break;
    }

    case "eclipse-das-lendas": {
      for (const allyLane of BOARD_LANES) {
        const slot = getLaneSlot(nextState, side, allyLane);
        if (slot.biomeId === "campos-ancestrais") {
          const transformed = transformLaneBiome(
            nextState,
            side,
            allyLane,
            "reino-espiritual",
            "O Eclipse das Lendas consagrou os Campos Ancestrais em Reino Espiritual!",
          );
          nextState = transformed.state;
          events.push(...transformed.events);
        }
        nextState = updateLaneSlot(nextState, side, allyLane, (current) => ({
          ...current,
          creature: current.creature
            ? addCreatureStatus(current.creature, "empowered")
            : null,
        }));
      }

      const drawn = drawCardsForPlayer(nextState.players[side], 1);
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [side]: {
            ...drawn.player,
            empowerPowerBonusThisTurn: drawn.player.empowerPowerBonusThisTurn + 2,
          },
        },
      };
      break;
    }

    case "neblina-dos-espiritos": {
      for (const allyLane of BOARD_LANES) {
        nextState = updateLaneSlot(nextState, side, allyLane, (slot) => ({
          ...slot,
          creature: slot.creature
            ? {
                ...addCreatureStatus(slot.creature, "veiled"),
                shield: slot.creature.shield + 1,
              }
            : null,
        }));
      }
      break;
    }
  }

  nextState = appendMatchLog(nextState, {
    side,
    kind: "event",
    title: `Evento: ${card.name}`,
    detail: card.description,
  });

  return { state: nextState, events };
}
