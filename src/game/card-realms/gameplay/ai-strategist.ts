import { getLaneSlot } from "../board/board-state";
import {
  getCardDefinition,
  isCreatureCard,
  isEventCard,
  isStructureCard,
  isTerritoryCard,
} from "../domain/cards";
import { computeEffectiveCreatureStats, getCreatureCardDefinition } from "../domain/creatures";
import { canPlayCardOnLane } from "../domain/match-rules";
import { getOppositeSide } from "../domain/players";
import {
  BOARD_LANES,
  type LaneIndex,
  type MatchAction,
  type MatchState,
  type PlayerSide,
} from "../domain/types";

export type AiProfile = "aggressive" | "defensive" | "strategic" | "adaptive";

export const AI_PROFILE_LABELS: Readonly<Record<AiProfile, { name: string; description: string }>> = {
  aggressive: {
    name: "Agressivo (Investida Direta)",
    description: "Prioriza atacar o Coração do Reino adversário por faixas abertas e pressionar sem recuar.",
  },
  defensive: {
    name: "Defensivo (Fortaleza Ancestral)",
    description: "Foca em bloquear ameaças, erguer estruturas de defesa e curar ou proteger suas lendas.",
  },
  strategic: {
    name: "Estratégico (Sinergia dos Biomas)",
    description: "Maximiza terrenos favorecidos, combinações de poderes e vantagens territoriais.",
  },
  adaptive: {
    name: "Adaptativo (Mestre dos Folclores)",
    description: "Lê a saúde dos reinos e a mesa, alternando dinamicamente entre defesa e investida total.",
  },
};

export function chooseNextAiAction(
  state: MatchState,
  aiSide: PlayerSide = "opponent",
  profile: AiProfile = "strategic",
): MatchAction {
  if (state.winner !== null || state.activeSide !== aiSide) {
    return { type: "end-turn", side: aiSide };
  }

  const aiPlayer = state.players[aiSide];
  const enemySide = getOppositeSide(aiSide);

  // Dynamic evaluation for Adaptive profile
  let activeProfile: Exclude<AiProfile, "adaptive"> =
    profile === "adaptive" ? "strategic" : profile;
  if (profile === "adaptive") {
    const myHeartHp = aiPlayer.heart.currentHp;
    const enemyHeartHp = state.players[enemySide].heart.currentHp;
    if (myHeartHp <= 8 && enemyHeartHp > 8) {
      activeProfile = "defensive";
    } else if (enemyHeartHp <= 10) {
      activeProfile = "aggressive";
    } else {
      activeProfile = "strategic";
    }
  }

  // Special choreography for Turn 1 of Demo Guided Mode (Section 14)
  if (state.mode === "demo-guided" && state.turn === 1 && aiSide === "opponent") {
    const territoryHand = aiPlayer.hand.find(
      (item) => item.cardId === "territory-santuario-espiritual",
    );
    if (
      territoryHand &&
      canPlayCardOnLane(
        state,
        aiSide,
        getCardDefinition(territoryHand.cardId),
        0,
      ).ok
    ) {
      return {
        type: "play-card",
        side: aiSide,
        handInstanceId: territoryHand.instanceId,
        lane: 0,
      };
    }

    const kitsuneHand = aiPlayer.hand.find((item) => item.cardId === "legend-kitsune");
    if (
      kitsuneHand &&
      canPlayCardOnLane(state, aiSide, getCardDefinition(kitsuneHand.cardId), 0).ok
    ) {
      return {
        type: "play-card",
        side: aiSide,
        handInstanceId: kitsuneHand.instanceId,
        lane: 0,
      };
    }
  }

  // 1. Play a Territory Card if affordable and helpful
  for (const handItem of aiPlayer.hand) {
    const card = getCardDefinition(handItem.cardId);
    if (!isTerritoryCard(card) || aiPlayer.breath < card.cost) continue;

    const targetLane = BOARD_LANES.find((lane) => {
      if (!canPlayCardOnLane(state, aiSide, card, lane).ok) return false;
      const slot = getLaneSlot(state, aiSide, lane);
      if (slot.creature) {
        const cDef = getCreatureCardDefinition(slot.creature.cardId);
        return cDef.favoredBiomes.includes(card.biomeId);
      }
      return slot.biomeId === "campos-ancestrais";
    });

    if (targetLane !== undefined) {
      return {
        type: "play-card",
        side: aiSide,
        handInstanceId: handItem.instanceId,
        lane: targetLane,
      };
    }
  }

  // 2. Summon a Creature Card onto the most tactical lane
  const playableCreatures = aiPlayer.hand
    .map((item) => ({ item, card: getCardDefinition(item.cardId) }))
    .filter(
      (entry): entry is { item: typeof entry.item; card: ReturnType<typeof getCreatureCardDefinition> } =>
        isCreatureCard(entry.card) && aiPlayer.breath >= entry.card.cost,
    )
    .sort((a, b) => b.card.cost - a.card.cost);

  if (playableCreatures.length > 0) {
    const chosen = playableCreatures[0];
    const emptyLanes = BOARD_LANES.filter(
      (lane) => canPlayCardOnLane(state, aiSide, chosen.card, lane).ok,
    );

    if (emptyLanes.length > 0) {
      const scoredLanes = emptyLanes
        .map((lane) => {
          const allySlot = getLaneSlot(state, aiSide, lane);
          const enemySlot = getLaneSlot(state, enemySide, lane);
          let score = 0;
          const isFavored = chosen.card.favoredBiomes.includes(allySlot.biomeId);

          if (activeProfile === "aggressive") {
            if (!enemySlot.creature && !enemySlot.structure) score += 7;
            if (isFavored) score += 3;
            if (enemySlot.creature) score += 1;
          } else if (activeProfile === "defensive") {
            if (enemySlot.creature) score += 8;
            if (allySlot.structure) score += 3;
            if (isFavored) score += 2;
          } else {
            if (isFavored) score += 6;
            if (enemySlot.creature) score += 4;
            if (allySlot.structure) score += 2;
          }
          return { lane, score };
        })
        .sort((a, b) => b.score - a.score);

      return {
        type: "play-card",
        side: aiSide,
        handInstanceId: chosen.item.instanceId,
        lane: scoredLanes[0].lane,
      };
    }
  }

  // 3. Play an Event Card if enemies are on the board
  const enemyCreatureLanes = BOARD_LANES.filter(
    (lane) => getLaneSlot(state, enemySide, lane).creature !== null,
  );
  const allyCreatureLanes = BOARD_LANES.filter(
    (lane) => getLaneSlot(state, aiSide, lane).creature !== null,
  );

  for (const handItem of aiPlayer.hand) {
    const card = getCardDefinition(handItem.cardId);
    if (!isEventCard(card) || aiPlayer.breath < card.cost) continue;

    if (card.requiresLane && enemyCreatureLanes.length > 0) {
      const targetLane = enemyCreatureLanes[0];
      if (canPlayCardOnLane(state, aiSide, card, targetLane).ok) {
        return {
          type: "play-card",
          side: aiSide,
          handInstanceId: handItem.instanceId,
          lane: targetLane,
        };
      }
    } else if (!card.requiresLane && allyCreatureLanes.length > 0) {
      if (canPlayCardOnLane(state, aiSide, card).ok) {
        return {
          type: "play-card",
          side: aiSide,
          handInstanceId: handItem.instanceId,
        };
      }
    }
  }

  // 4. Build a Structure Card on an occupied or strategic lane
  for (const handItem of aiPlayer.hand) {
    const card = getCardDefinition(handItem.cardId);
    if (!isStructureCard(card) || aiPlayer.breath < card.cost) continue;

    const validLanes = BOARD_LANES.filter(
      (lane) => canPlayCardOnLane(state, aiSide, card, lane).ok,
    );
    if (validLanes.length > 0) {
      const preferred: LaneIndex =
        validLanes.find((lane) => getLaneSlot(state, aiSide, lane).creature !== null) ??
        validLanes[0];
      return {
        type: "play-card",
        side: aiSide,
        handInstanceId: handItem.instanceId,
        lane: preferred,
      };
    }
  }

  // 5. Command ready creatures: Decide between ⚔️ Investida (Attack) and 🔮 Despertar Ancestral (Power)
  for (const lane of BOARD_LANES) {
    const allySlot = getLaneSlot(state, aiSide, lane);
    const creature = allySlot.creature;
    if (!creature || !creature.canAct) continue;

    const creatureDef = getCreatureCardDefinition(creature.cardId);
    const enemySlot = getLaneSlot(state, enemySide, lane);
    const stats = computeEffectiveCreatureStats(allySlot)!;

    // If enemy Heart can be defeated right now by an open-lane Investida, take the win!
    if (
      !enemySlot.creature &&
      !enemySlot.structure &&
      state.players[enemySide].heart.currentHp <= stats.effectiveAttack
    ) {
      return {
        type: "creature-investida",
        side: aiSide,
        lane,
      };
    }

    // Decide between Attack and Awakening Power based on active Profile
    const notOnFavoredTerrain = !creatureDef.favoredBiomes.includes(allySlot.biomeId);
    const hasEnemyInLane = enemySlot.creature !== null;
    const isDefensivePower =
      creatureDef.awakeningPower.id === "iara-canto-da-margem" ||
      creatureDef.awakeningPower.id === "kappa-desafio-prato-dagua" ||
      creatureDef.awakeningPower.id === "kitsune-miragem-kitsunebi";

    let shouldAwaken = false;

    if (activeProfile === "aggressive") {
      if (!enemySlot.creature && !enemySlot.structure) {
        shouldAwaken = false;
      } else {
        shouldAwaken =
          creature.usedPowerCount === 0 &&
          (hasEnemyInLane ||
            creatureDef.id === "legend-boitata" ||
            creatureDef.id === "legend-oni");
      }
    } else if (activeProfile === "defensive") {
      shouldAwaken =
        creature.usedPowerCount === 0 &&
        (isDefensivePower ||
          hasEnemyInLane ||
          creature.currentHp < creature.maxHp);
    } else {
      shouldAwaken =
        (creature.usedPowerCount === 0 && (notOnFavoredTerrain || hasEnemyInLane)) ||
        (enemySlot.structure !== null && creatureDef.id === "legend-oni") ||
        (enemyCreatureLanes.length >= 2 && creatureDef.id === "legend-mapinguari");
    }

    if (shouldAwaken) {
      return {
        type: "creature-despertar",
        side: aiSide,
        lane,
        targetLane: lane,
      };
    }

    return {
      type: "creature-investida",
      side: aiSide,
      lane,
    };
  }

  return { type: "end-turn", side: aiSide };
}
