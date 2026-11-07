import {
  appendMatchLog,
  getAdjacentLanes,
  getLaneSlot,
  updateLaneSlot,
} from "../board/board-state";
import { transformLaneBiome } from "../board/territory-system";
import { getCardDefinition } from "../domain/cards";
import {
  addCreatureStatus,
  applyDamageToCreature,
  getCreatureCardDefinition,
  healCreatureInstance,
} from "../domain/creatures";
import { drawCardsForPlayer, getOppositeSide } from "../domain/players";
import { getTerritoryBiome } from "../domain/territories";
import {
  BOARD_LANES,
  type ActionResolutionResult,
  type LaneIndex,
  type MatchState,
  type MatchVisualEvent,
  type PlayerSide,
} from "../domain/types";
import { damagePlayerKingdomHeart } from "./victory";

function dealAbilityDamageToEnemyLane(
  state: MatchState,
  enemySide: PlayerSide,
  lane: LaneIndex,
  damage: number,
): { state: MatchState; events: MatchVisualEvent[]; defeatedName?: string } {
  const slot = getLaneSlot(state, enemySide, lane);
  if (!slot.creature || damage <= 0) {
    return { state, events: [] };
  }
  const creatureDef = getCreatureCardDefinition(slot.creature.cardId);
  const hit = applyDamageToCreature(slot.creature, damage);
  const nextState = updateLaneSlot(state, enemySide, lane, (current) => ({
    ...current,
    creature: hit.creature,
  }));
  const events: MatchVisualEvent[] = [];
  if (hit.defeated) {
    events.push({
      kind: "creature-defeated",
      side: enemySide,
      lane,
      creatureName: creatureDef.name,
    });
  }
  return {
    state: nextState,
    events,
    defeatedName: hit.defeated ? creatureDef.name : undefined,
  };
}

export function executeCreatureDespertar(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  targetLaneParam?: LaneIndex,
): ActionResolutionResult {
  const allySlot = getLaneSlot(state, side, lane);
  const actor = allySlot.creature;
  if (!actor) {
    return {
      ok: false,
      error: "Não há uma Lenda posicionada neste território.",
      state,
      events: [],
    };
  }
  if (!actor.canAct) {
    return {
      ok: false,
      error: "Esta Lenda já realizou sua ação neste turno ou ainda está se materializando.",
      state,
      events: [],
    };
  }

  const card = getCreatureCardDefinition(actor.cardId);
  const power = card.awakeningPower;
  const enemySide = getOppositeSide(side);
  const targetLane: LaneIndex = targetLaneParam ?? lane;
  const biome = getTerritoryBiome(allySlot.biomeId);
  const powerBonus =
    (biome.awakeningPowerBonus ?? 0) + state.players[side].empowerPowerBonusThisTurn;

  let nextState = updateLaneSlot(state, side, lane, (slot) => ({
    ...slot,
    creature: slot.creature
      ? {
          ...slot.creature,
          canAct: false,
          usedPowerCount: slot.creature.usedPowerCount + 1,
        }
      : null,
  }));

  const events: MatchVisualEvent[] = [
    {
      kind: "creature-awakening",
      side,
      lane,
      targetLane,
      creatureName: card.name,
      powerName: power.name,
      element: power.animationElement,
    },
  ];

  switch (power.id) {
    case "curupira-rastro-invertido": {
      const terrain = transformLaneBiome(
        nextState,
        side,
        lane,
        "mata-encantada",
        "Curupira fez brotar a Mata Encantada sob seus pés!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature ? healCreatureInstance(slot.creature, 1) : null,
      }));

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "confused") : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "iara-canto-da-margem": {
      const terrain = transformLaneBiome(
        nextState,
        side,
        lane,
        "rio-dos-espiritos",
        "O Canto da Iara inundou o território com o Rio dos Espíritos!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      for (const allyLane of BOARD_LANES) {
        nextState = updateLaneSlot(nextState, side, allyLane, (slot) => ({
          ...slot,
          creature: slot.creature
            ? healCreatureInstance(slot.creature, 2 + powerBonus)
            : null,
        }));
      }

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "rooted") : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "saci-redemoinho-de-vento": {
      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "confused") : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);

        // Swap enemy creature with an adjacent lane if still alive
        const postHitEnemy = getLaneSlot(nextState, enemySide, lane).creature;
        if (postHitEnemy) {
          const adjLane = getAdjacentLanes(lane)[0];
          const adjEnemy = getLaneSlot(nextState, enemySide, adjLane).creature;
          nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
            ...slot,
            creature: adjEnemy ? { ...adjEnemy, lane } : null,
          }));
          nextState = updateLaneSlot(nextState, enemySide, adjLane, (slot) => ({
            ...slot,
            creature: { ...postHitEnemy, lane: adjLane },
          }));
        }
      }

      const drawn = drawCardsForPlayer(nextState.players[side], 1);
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [side]: drawn.player,
        },
      };
      if (drawn.drawn.length > 0) {
        events.push({
          kind: "card-drawn",
          side,
          count: drawn.drawn.length,
        });
      }
      break;
    }

    case "boitata-circulo-incandescente": {
      const terrain = transformLaneBiome(
        nextState,
        enemySide,
        lane,
        "terra-vulcanica",
        "Boitatá incendiou o território inimigo em Terra Vulcânica!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature
          ? { ...slot.creature, shield: slot.creature.shield + 2 }
          : null,
      }));

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "burning") : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "mapinguari-rugido-da-terra": {
      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature ? healCreatureInstance(slot.creature, 3) : null,
      }));

      const enemyOpposite = getLaneSlot(nextState, enemySide, lane);
      if (enemyOpposite.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "rooted") : null,
        }));
      }

      for (const targetEnemyLane of BOARD_LANES) {
        const dmg = dealAbilityDamageToEnemyLane(
          nextState,
          enemySide,
          targetEnemyLane,
          2 + powerBonus,
        );
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "kitsune-miragem-kitsunebi": {
      const terrain = transformLaneBiome(
        nextState,
        side,
        lane,
        "reino-espiritual",
        "Kitsune consagrou o território em Reino Espiritual!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      const lanesToVeil = [lane, ...getAdjacentLanes(lane)];
      for (const veilLane of lanesToVeil) {
        nextState = updateLaneSlot(nextState, side, veilLane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "veiled") : null,
        }));
      }

      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature ? healCreatureInstance(slot.creature, 2) : null,
      }));

      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "kappa-desafio-prato-dagua": {
      const terrain = transformLaneBiome(
        nextState,
        side,
        lane,
        "rio-dos-espiritos",
        "Kappa inundou a faixa com o Rio dos Espíritos!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature
          ? { ...slot.creature, shield: slot.creature.shield + 3 }
          : null,
      }));

      // If opposite lane has no enemy creature, pull one from another lane
      if (!getLaneSlot(nextState, enemySide, lane).creature) {
        const donorLane = BOARD_LANES.find(
          (candidate) =>
            candidate !== lane && getLaneSlot(nextState, enemySide, candidate).creature !== null,
        );
        if (donorLane !== undefined) {
          const pulled = getLaneSlot(nextState, enemySide, donorLane).creature!;
          nextState = updateLaneSlot(nextState, enemySide, donorLane, (slot) => ({
            ...slot,
            creature: null,
          }));
          nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
            ...slot,
            creature: { ...pulled, lane },
          }));
        }
      }

      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "tengu-vendaval-yamabushi": {
      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature
          ? {
              ...addCreatureStatus(slot.creature, "empowered"),
              shield: slot.creature.shield + 1,
            }
          : null,
      }));

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      } else {
        const heartHit = damagePlayerKingdomHeart(
          nextState,
          enemySide,
          2 + powerBonus,
          `${card.name} (${power.name})`,
        );
        nextState = heartHit.state;
        events.push(...heartHit.events);
      }

      if (targetLane !== lane) {
        const currentTengu = getLaneSlot(nextState, side, lane).creature;
        const targetAlly = getLaneSlot(nextState, side, targetLane).creature;
        if (currentTengu && !currentTengu.statuses.includes("rooted")) {
          nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
            ...slot,
            creature: targetAlly ? { ...targetAlly, lane } : null,
          }));
          nextState = updateLaneSlot(nextState, side, targetLane, (slot) => ({
            ...slot,
            creature: { ...currentTengu, lane: targetLane },
          }));
        }
      }
      break;
    }

    case "oni-clava-ferro-ardente": {
      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.structure) {
        const structDef = getCardDefinition(enemySlot.structure.cardId);
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
      }

      const terrain = transformLaneBiome(
        nextState,
        enemySide,
        lane,
        "terra-vulcanica",
        "A Clava de Ferro de Oni rachou o solo inimigo em Terra Vulcânica!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      if (getLaneSlot(nextState, enemySide, lane).creature) {
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      } else {
        const heartHit = damagePlayerKingdomHeart(
          nextState,
          enemySide,
          2 + powerBonus,
          `${card.name} (${power.name})`,
        );
        nextState = heartHit.state;
        events.push(...heartHit.events);
      }
      break;
    }

    case "raiju-salto-entre-nuvens": {
      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);

      const heartHit = damagePlayerKingdomHeart(
        nextState,
        enemySide,
        2 + powerBonus,
        `${card.name} (${power.name})`,
      );
      nextState = heartHit.state;
      events.push(...heartHit.events);
      break;
    }

    case "boto-danca-das-aguas": {
      const allyHeart = nextState.players[side].heart;
      const nextHp = Math.min(allyHeart.maxHp, allyHeart.currentHp + 2 + powerBonus);
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [side]: {
            ...nextState.players[side],
            heart: { ...allyHeart, currentHp: nextHp },
          },
        },
      };

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "confused") : null,
        }));
      }
      break;
    }

    case "caipora-chamado-da-mata": {
      const terrain = transformLaneBiome(
        nextState,
        side,
        lane,
        "mata-encantada",
        "Caipora fez brotar a Mata Encantada sob sua montaria!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "mula-relincho-de-fogo": {
      const terrain = transformLaneBiome(
        nextState,
        enemySide,
        lane,
        "terra-vulcanica",
        "O galope da Mula Sem Cabeça calcinou a terra!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "burning") : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "yamata-oito-calamidades": {
      for (const enemyLane of BOARD_LANES) {
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, enemyLane, 2 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      const heartHit = damagePlayerKingdomHeart(
        nextState,
        enemySide,
        2 + powerBonus,
        `${card.name} (${power.name})`,
      );
      nextState = heartHit.state;
      events.push(...heartHit.events);
      break;
    }

    case "yuki-onna-sopro-congelante": {
      const terrain = transformLaneBiome(
        nextState,
        enemySide,
        lane,
        "reino-congelado",
        "O sopro de Yuki-Onna transformou o território em Reino Congelado!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? addCreatureStatus(slot.creature, "rooted") : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "ratatoskr-fofoca-de-yggdrasil": {
      const drawn = drawCardsForPlayer(nextState.players[side], 1);
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [side]: drawn.player,
        },
      };
      if (drawn.drawn.length > 0) {
        events.push({ kind: "card-drawn", side, count: 1 });
      }

      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "amarok-uivo-do-gelo-eterno": {
      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature
          ? { ...slot.creature, shield: slot.creature.shield + 2 }
          : null,
      }));
      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "yeti-pisada-de-avalanche": {
      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.structure) {
        const structDef = getCardDefinition(enemySlot.structure.cardId);
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
      }

      if (enemySlot.creature) {
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 4 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      } else {
        const heartHit = damagePlayerKingdomHeart(
          nextState,
          enemySide,
          3 + powerBonus,
          `${card.name} (${power.name})`,
        );
        nextState = heartHit.state;
        events.push(...heartHit.events);
      }
      break;
    }

    case "kelpie-afogamento-ilusorio": {
      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature ? { ...slot.creature, canAct: false } : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "minotauro-furia-do-labirinto": {
      nextState = updateLaneSlot(nextState, side, lane, (slot) => ({
        ...slot,
        creature: slot.creature ? addCreatureStatus(slot.creature, "empowered") : null,
      }));
      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 4 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "medusa-olhar-petrificante": {
      const enemySlot = getLaneSlot(nextState, enemySide, lane);
      if (enemySlot.creature) {
        nextState = updateLaneSlot(nextState, enemySide, lane, (slot) => ({
          ...slot,
          creature: slot.creature
            ? {
                ...slot.creature,
                baseAttack: Math.max(1, slot.creature.baseAttack - 2),
                shield: 0,
              }
            : null,
        }));
        const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
        nextState = dmg.state;
        events.push(...dmg.events);
      }
      break;
    }

    case "fenix-cinzas-do-renascimento": {
      for (const allyLane of BOARD_LANES) {
        nextState = updateLaneSlot(nextState, side, allyLane, (slot) => ({
          ...slot,
          creature: slot.creature ? healCreatureInstance(slot.creature, 3 + powerBonus) : null,
        }));
      }
      const allyHeart = nextState.players[side].heart;
      const nextHp = Math.min(allyHeart.maxHp, allyHeart.currentHp + 2);
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [side]: {
            ...nextState.players[side],
            heart: { ...allyHeart, currentHp: nextHp },
          },
        },
      };
      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 2 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }

    case "esfinge-enigma-mortal": {
      const enemyHandCount = nextState.players[enemySide].hand.length;
      const damageToDeal = Math.max(2, enemyHandCount) + powerBonus;
      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, damageToDeal);
      nextState = dmg.state;
      events.push(...dmg.events);

      const drawn = drawCardsForPlayer(nextState.players[side], 1);
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [side]: drawn.player,
        },
      };
      if (drawn.drawn.length > 0) {
        events.push({ kind: "card-drawn", side, count: 1 });
      }
      break;
    }

    case "ammit-devoracao-do-coracao": {
      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 4 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);

      if (dmg.defeatedName) {
        const allyHeart = nextState.players[side].heart;
        const nextHp = Math.min(allyHeart.maxHp, allyHeart.currentHp + 3);
        nextState = {
          ...nextState,
          players: {
            ...nextState.players,
            [side]: {
              ...nextState.players[side],
              heart: { ...allyHeart, currentHp: nextHp },
            },
          },
        };
      }
      break;
    }

    case "ahuizotl-bote-das-profundezas": {
      const terrain = transformLaneBiome(
        nextState,
        side,
        lane,
        "rio-dos-espiritos",
        "Ahuizotl arrastou as águas escuras para a faixa!",
      );
      nextState = terrain.state;
      events.push(...terrain.events);

      const dmg = dealAbilityDamageToEnemyLane(nextState, enemySide, lane, 3 + powerBonus);
      nextState = dmg.state;
      events.push(...dmg.events);
      break;
    }
  }

  nextState = appendMatchLog(nextState, {
    side,
    kind: "power",
    title: `${card.name} despertou: ${power.name}!`,
    detail: power.description,
  });

  return {
    ok: true,
    state: nextState,
    events,
  };
}
