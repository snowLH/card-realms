import { getCardDefinition, isStructureCard } from "../domain/cards";
import {
  applyDamageToCreature,
  getCreatureCardDefinition,
  healCreatureInstance,
  removeCreatureStatus,
} from "../domain/creatures";
import { getOppositeSide } from "../domain/players";
import { getTerritoryBiome } from "../domain/territories";
import { BOARD_LANES, type MatchState, type MatchVisualEvent, type PlayerSide } from "../domain/types";
import { appendMatchLog, getLaneSlot, updateLaneSlot } from "./board-state";

export function applyTurnStartFieldEffects(
  state: MatchState,
  side: PlayerSide,
): { state: MatchState; events: MatchVisualEvent[] } {
  let nextState = state;
  const events: MatchVisualEvent[] = [];

  for (const lane of BOARD_LANES) {
    const slot = getLaneSlot(nextState, side, lane);
    const biome = getTerritoryBiome(slot.biomeId);
    let creature = slot.creature;

    if (creature) {
      const creatureDef = getCreatureCardDefinition(creature.cardId);
      const isFavored =
        creatureDef.favoredBiomes.includes(slot.biomeId) ||
        biome.favoredElements.includes(creatureDef.element);

      if (biome.turnStartHealForFavored && isFavored) {
        creature = healCreatureInstance(creature, biome.turnStartHealForFavored);
      }

      if (slot.structure) {
        const structureDef = getCardDefinition(slot.structure.cardId);
        if (isStructureCard(structureDef)) {
          if (structureDef.turnStartHeal) {
            creature = healCreatureInstance(creature, structureDef.turnStartHeal);
          }
          if (structureDef.turnStartShield) {
            creature = {
              ...creature,
              shield: creature.shield + structureDef.turnStartShield,
            };
          }
        }
      }

      creature = {
        ...creature,
        canAct: true,
      };

      nextState = updateLaneSlot(nextState, side, lane, (current) => ({
        ...current,
        creature,
      }));
    }

    if (slot.structure) {
      const structureDef = getCardDefinition(slot.structure.cardId);
      if (isStructureCard(structureDef) && structureDef.heartShieldReduction) {
        const player = nextState.players[side];
        nextState = {
          ...nextState,
          players: {
            ...nextState.players,
            [side]: {
              ...player,
              heart: {
                ...player.heart,
                shield: Math.min(5, player.heart.shield + 1),
              },
            },
          },
        };
      }
    }
  }

  return { state: nextState, events };
}

export function applyTurnEndFieldEffects(
  state: MatchState,
  side: PlayerSide,
): { state: MatchState; events: MatchVisualEvent[] } {
  let nextState = state;
  const events: MatchVisualEvent[] = [];
  const enemySide = getOppositeSide(side);

  for (const lane of BOARD_LANES) {
    const slot = getLaneSlot(nextState, side, lane);
    const biome = getTerritoryBiome(slot.biomeId);

    // 1. Structure end-of-turn strikes (e.g. Torre de Vigia da Montanha)
    if (slot.structure) {
      const structureDef = getCardDefinition(slot.structure.cardId);
      if (isStructureCard(structureDef) && structureDef.turnEndStrikeDamage) {
        const enemySlot = getLaneSlot(nextState, enemySide, lane);
        if (enemySlot.creature) {
          const enemyCreatureDef = getCreatureCardDefinition(enemySlot.creature.cardId);
          const damageResult = applyDamageToCreature(
            enemySlot.creature,
            structureDef.turnEndStrikeDamage,
          );
          nextState = updateLaneSlot(nextState, enemySide, lane, (current) => ({
            ...current,
            creature: damageResult.creature,
          }));

          if (damageResult.defeated) {
            events.push({
              kind: "creature-defeated",
              side: enemySide,
              lane,
              creatureName: enemyCreatureDef.name,
            });
            nextState = appendMatchLog(nextState, {
              side,
              kind: "structure",
              title: `${structureDef.name} abateu ${enemyCreatureDef.name}`,
              detail: `Disparo espiritual na Faixa ${lane + 1}.`,
            });
          }
        }
      }
    }

    // 2. Volcanic earth & burning status damage on ally creature
    const refreshedSlot = getLaneSlot(nextState, side, lane);
    if (refreshedSlot.creature) {
      let creature = refreshedSlot.creature;
      const creatureDef = getCreatureCardDefinition(creature.cardId);

      let burnDamage = 0;
      if (biome.turnEndBurnNonFire && creatureDef.element !== "fire") {
        burnDamage += biome.turnEndBurnNonFire;
      }
      if (creature.statuses.includes("burning")) {
        burnDamage += 1;
        creature = removeCreatureStatus(creature, "burning");
      }
      creature = removeCreatureStatus(creature, "empowered");
      creature = removeCreatureStatus(creature, "rooted");

      if (burnDamage > 0) {
        const result = applyDamageToCreature(creature, burnDamage, { ignoreVeil: true });
        nextState = updateLaneSlot(nextState, side, lane, (current) => ({
          ...current,
          creature: result.creature,
        }));
        if (result.defeated) {
          events.push({
            kind: "creature-defeated",
            side,
            lane,
            creatureName: creatureDef.name,
          });
        }
      } else {
        nextState = updateLaneSlot(nextState, side, lane, (current) => ({
          ...current,
          creature,
        }));
      }
    }
  }

  return { state: nextState, events };
}
