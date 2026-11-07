import { describe, expect, it, vi } from "vitest";
import { ALL_CARD_REALMS_CARDS, CREATURE_CARDS, VERTICAL_SLICE_CARDS } from "./content/cards";
import {
  applyDamageToCreature,
  computeEffectiveCreatureStats,
  computeElementalDamageModifier,
  getCreatureCardDefinition,
} from "./domain/creatures";
import { getKingdomHeartVisualState } from "./domain/cultures";
import { resolveElementalBiomeReaction } from "./domain/territories";
import {
  applyMatchAction,
  createInitialMatchState,
  runAiTurnToCompletion,
} from "./gameplay/engine";
import { chooseNextAiAction, type AiProfile } from "./gameplay/ai-strategist";
import { CardRealmsAudio } from "./runtime/audio";
import { CardRealmsBridge } from "./runtime/bridge";
import { getKingdomHeartCoordinates, getLaneBoardCoordinates } from "./runtime/camera";
import { resolveBoardPointerTarget } from "./runtime/input";

describe("Card Realms — Tabuleiro Vivo, Territórios, Cartas e Batalha de Lendas", () => {
  it("inicializa a Primeira Partida Guiada com Brasil (Mata Encantada) vs Japão (Reino Espiritual)", () => {
    const state = createInitialMatchState({
      mode: "demo-guided",
      playerCulture: "brasil",
      opponentCulture: "japao",
    });

    expect(state.turn).toBe(1);
    expect(state.activeSide).toBe("player");
    expect(state.players.player.heart.name).toBe("Árvore Ancestral de Pindorama");
    expect(state.players.player.heart.currentHp).toBe(20);
    expect(state.players.opponent.heart.name).toBe("Santuário Torii das Mil Eras");
    expect(state.players.opponent.heart.currentHp).toBe(20);

    // Player starts with Mata Encantada on Lane 0 and Rio dos Espíritos on Lane 2
    expect(state.lanes.player[0].biomeId).toBe("mata-encantada");
    expect(state.lanes.player[2].biomeId).toBe("rio-dos-espiritos");

    // Curated opening hand contains Curupira, Mata Profunda, Altar da Clareira Viva, and Iara
    const handCardIds = state.players.player.hand.map((item) => item.cardId);
    expect(handCardIds).toEqual([
      "legend-curupira",
      "territory-mata-profunda",
      "structure-altar-clareira",
      "legend-iara",
    ]);
  });

  it("materializa Curupira na Mata Encantada com bônus de sinergia (+2 ATQ) e emite eventos de invocação", () => {
    const initial = createInitialMatchState({ mode: "demo-guided" });
    const curupiraHand = initial.players.player.hand.find(
      (item) => item.cardId === "legend-curupira",
    )!;

    const result = applyMatchAction(initial, {
      type: "play-card",
      side: "player",
      handInstanceId: curupiraHand.instanceId,
      lane: 0,
    });

    expect(result.ok).toBe(true);
    const slot0 = result.state.lanes.player[0];
    expect(slot0.creature).not.toBeNull();
    expect(slot0.creature?.cardId).toBe("legend-curupira");

    const stats = computeEffectiveCreatureStats(slot0)!;
    expect(stats.isFavoredTerrain).toBe(true);
    expect(stats.baseAttack).toBe(3);
    expect(stats.biomeBonus).toBe(2);
    expect(stats.effectiveAttack).toBe(5);

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "card-placed",
          side: "player",
          lane: 0,
          cardId: "legend-curupira",
          category: "creature",
        }),
        expect.objectContaining({
          kind: "creature-summoned",
          side: "player",
          lane: 0,
          cardId: "legend-curupira",
          creatureName: "Curupira",
          biomeId: "mata-encantada",
        }),
      ]),
    );
  });

  it("permite escolher entre Investida (Ataque) e Despertar Ancestral (Poder) com efeitos táticos distintos", () => {
    let state = createInitialMatchState({ mode: "demo-guided" });
    const curupiraHand = state.players.player.hand[0];
    const mataHand = state.players.player.hand[1];

    // Turn 1 Player: Summon Curupira on Lane 0 and place Mata Profunda on Lane 1
    state = applyMatchAction(state, {
      type: "play-card",
      side: "player",
      handInstanceId: curupiraHand.instanceId,
      lane: 0,
    }).state;
    state = applyMatchAction(state, {
      type: "play-card",
      side: "player",
      handInstanceId: mataHand.instanceId,
      lane: 1,
    }).state;
    expect(state.lanes.player[1].biomeId).toBe("mata-encantada");

    // End player turn -> AI Yokai plays its Turn 1
    state = applyMatchAction(state, { type: "end-turn", side: "player" }).state;
    const aiTurn = runAiTurnToCompletion(state);
    state = aiTurn.state;

    // Now it is Turn 2 for Player; Curupira is ready to act and Kitsune is on Opponent Lane 0
    expect(state.turn).toBe(2);
    expect(state.activeSide).toBe("player");
    expect(state.lanes.player[0].creature?.canAct).toBe(true);
    expect(state.lanes.opponent[0].creature?.cardId).toBe("legend-kitsune");

    // Branch A: Use Despertar Ancestral (Rastro Invertido)
    const awakenBranch = applyMatchAction(state, {
      type: "creature-despertar",
      side: "player",
      lane: 0,
    });
    expect(awakenBranch.ok).toBe(true);
    expect(awakenBranch.state.lanes.opponent[0].creature?.statuses).toContain("confused");
    expect(awakenBranch.state.lanes.opponent[0].creature?.currentHp).toBe(3);

    // Branch B: Use Investida (Attack) for 5 damage (3 base + 2 Mata Encantada) -> defeats Kitsune (5 HP)!
    const attackBranch = applyMatchAction(state, {
      type: "creature-investida",
      side: "player",
      lane: 0,
    });
    expect(attackBranch.ok).toBe(true);
    expect(attackBranch.state.lanes.opponent[0].creature).toBeNull();
  });

  it("transforma terrenos dinamicamente por reações elementais e eventos climáticos", () => {
    expect(resolveElementalBiomeReaction("mata-encantada", "fire")).toEqual(
      expect.objectContaining({
        nextBiome: "terra-vulcanica",
        reacted: true,
      }),
    );
    expect(resolveElementalBiomeReaction("terra-vulcanica", "water")).toEqual(
      expect.objectContaining({
        nextBiome: "campos-ancestrais",
        reacted: true,
      }),
    );
    expect(resolveElementalBiomeReaction("mata-encantada", "water")).toEqual(
      expect.objectContaining({
        nextBiome: "rio-dos-espiritos",
        reacted: true,
      }),
    );
  });

  it("concede vitória imediata quando o Coração do Reino adversário chega a 0 PV", () => {
    let state = createInitialMatchState({ mode: "local-pass-and-play" });
    state = {
      ...state,
      players: {
        ...state.players,
        opponent: {
          ...state.players.opponent,
          heart: {
            ...state.players.opponent.heart,
            currentHp: 3,
          },
        },
      },
      lanes: {
        ...state.lanes,
        player: [
          {
            ...state.lanes.player[0],
            biomeId: "mata-encantada",
            creature: {
              instanceId: "test-curupira",
              cardId: "legend-curupira",
              owner: "player",
              lane: 0,
              baseAttack: 3,
              currentHp: 5,
              maxHp: 5,
              shield: 0,
              canAct: true,
              summonedTurn: 1,
              usedPowerCount: 0,
              statuses: [],
            },
          },
          state.lanes.player[1],
          state.lanes.player[2],
          state.lanes.player[3],
        ],
      },
    };

    const strike = applyMatchAction(state, {
      type: "creature-investida",
      side: "player",
      lane: 0,
    });

    expect(strike.ok).toBe(true);
    expect(strike.state.players.opponent.heart.currentHp).toBe(0);
    expect(strike.state.winner).toBe("player");
    expect(strike.events).toContainEqual(
      expect.objectContaining({
        kind: "match-won",
        winner: "player",
      }),
    );
  });

  it("mantém todas as 22 cartas da Vertical Slice e expande a coleção para 52+ lendas mundiais com retratos autorais", () => {
    expect(VERTICAL_SLICE_CARDS).toHaveLength(22);
    expect(ALL_CARD_REALMS_CARDS.length).toBeGreaterThanOrEqual(22);
    for (const card of ALL_CARD_REALMS_CARDS) {
      expect(card.portrait.sheet).toMatch(/^\/art\//);
      expect(card.cost).toBeGreaterThanOrEqual(1);
      expect(["common", "rare", "epic", "legendary"]).toContain(card.rarity);
    }
    for (const creature of CREATURE_CARDS) {
      expect(creature.passiveTrait?.name).toBeTruthy();
      expect(creature.resistances?.length).toBeGreaterThanOrEqual(1);
      expect(creature.weaknesses?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("suporta as 5 culturas mundiais (Brasil, Japão, Nórdico, Grécia, Egito) com Corações do Reino únicos", () => {
    const cultures = ["brasil", "japao", "nordico", "grecia", "egito"] as const;
    for (const culture of cultures) {
      const state = createInitialMatchState({
        mode: "vs-ai",
        playerCulture: culture,
      });
      expect(state.players.player.heart.culture).toBe(culture);
      expect(state.players.player.heart.currentHp).toBe(20);
      expect(state.players.player.heart.name).toBeTruthy();
    }
  });

  it("permite movimentação tática entre faixas adjacentes (creature-move) e sacrifício ritual (sacrifice-slot)", () => {
    let state = createInitialMatchState({ mode: "demo-guided" });
    const curupiraHand = state.players.player.hand.find((c) => c.cardId === "legend-curupira")!;
    const summonRes = applyMatchAction(state, {
      type: "play-card",
      side: "player",
      handInstanceId: curupiraHand.instanceId,
      lane: 0,
    });
    expect(summonRes.ok).toBe(true);
    state = summonRes.state;

    expect(state.lanes.player[0].creature?.cardId).toBe("legend-curupira");
    expect(state.lanes.player[1].creature).toBeNull();

    // Ensure player has breath for tactical movement
    state = {
      ...state,
      players: {
        ...state.players,
        player: {
          ...state.players.player,
          breath: 3,
        },
      },
    };

    // Move Curupira from lane 0 to lane 1 (costs 1 fôlego)
    const moveRes = applyMatchAction(state, {
      type: "creature-move",
      side: "player",
      fromLane: 0,
      toLane: 1,
    });
    expect(moveRes.ok).toBe(true);
    expect(moveRes.state.lanes.player[0].creature).toBeNull();
    expect(moveRes.state.lanes.player[1].creature?.cardId).toBe("legend-curupira");
    expect(moveRes.state.players.player.breath).toBe(2);
    expect(moveRes.events).toContainEqual(
      expect.objectContaining({
        kind: "creature-moved",
        side: "player",
        fromLane: 0,
        toLane: 1,
      }),
    );

    // Sacrifice slot on lane 1 (refunds 1 fôlego)
    const curBreath = moveRes.state.players.player.breath;
    const sacrificeRes = applyMatchAction(moveRes.state, {
      type: "sacrifice-slot",
      side: "player",
      lane: 1,
    });
    expect(sacrificeRes.ok).toBe(true);
    expect(sacrificeRes.state.lanes.player[1].creature).toBeNull();
    expect(sacrificeRes.state.players.player.breath).toBe(curBreath + 1);
    expect(sacrificeRes.events).toContainEqual(
      expect.objectContaining({
        kind: "slot-sacrificed",
        side: "player",
        lane: 1,
      }),
    );
  });

  it("permite alterar dinamicamente o clima cósmico da arena (set-weather)", () => {
    const initial = createInitialMatchState({ mode: "local-pass-and-play" });
    expect(initial.weather).toBe("clima-sereno");

    const weatherRes = applyMatchAction(initial, {
      type: "set-weather",
      side: "player",
      weather: "chuva-ancestral",
    });
    expect(weatherRes.ok).toBe(true);
    expect(weatherRes.state.weather).toBe("chuva-ancestral");
    expect(weatherRes.events).toContainEqual(
      expect.objectContaining({
        kind: "weather-changed",
        weather: "chuva-ancestral",
      }),
    );
  });

  it("aplica fraquezas (+1 dano) e resistências (-1 dano) elementais entre criaturas folclóricas", () => {
    const curupiraDef = getCreatureCardDefinition("legend-curupira");
    expect(computeElementalDamageModifier("fire", curupiraDef)).toEqual({
      delta: 1,
      relation: "weakness",
    });
    expect(computeElementalDamageModifier("water", curupiraDef)).toEqual({
      delta: -1,
      relation: "resistance",
    });

    const dummyCurupira = {
      instanceId: "c1",
      cardId: "legend-curupira",
      owner: "player" as const,
      lane: 0 as const,
      baseAttack: 3,
      currentHp: 5,
      maxHp: 5,
      shield: 0,
      canAct: true,
      summonedTurn: 1,
      usedPowerCount: 0,
      statuses: [],
    };

    const fireHit = applyDamageToCreature(dummyCurupira, 3, { sourceElement: "fire" });
    expect(fireHit.damageDealt).toBe(4);
    expect(fireHit.elementalRelation).toBe("weakness");

    const waterHit = applyDamageToCreature(dummyCurupira, 3, { sourceElement: "water" });
    expect(waterHit.damageDealt).toBe(2);
    expect(waterHit.elementalRelation).toBe("resistance");
  });

  it("emite evento card-drawn ao comprar cartas na passagem de turno", () => {
    const initial = createInitialMatchState({ mode: "local-pass-and-play" });
    const endTurnRes = applyMatchAction(initial, { type: "end-turn", side: "player" });
    expect(endTurnRes.ok).toBe(true);
    expect(endTurnRes.events).toContainEqual(
      expect.objectContaining({
        kind: "card-drawn",
        side: "opponent",
        count: 1,
      }),
    );
  });

  it("resolve coordenadas 2.5D do tabuleiro, cliques em faixas/Coração e eventos da CardRealmsBridge", () => {
    const playerLane0 = getLaneBoardCoordinates("player", 0);
    const opponentHeart = getKingdomHeartCoordinates("opponent");

    expect(resolveBoardPointerTarget(playerLane0.centerX, playerLane0.centerY)).toEqual({
      kind: "lane-slot",
      side: "player",
      lane: 0,
    });
    expect(resolveBoardPointerTarget(opponentHeart.x, opponentHeart.y)).toEqual({
      kind: "kingdom-heart",
      side: "opponent",
    });

    const bridge = new CardRealmsBridge();
    const stateSpy = vi.fn();
    const clickSpy = vi.fn();
    bridge.onState(stateSpy);
    bridge.onBoardTargetClick(clickSpy);

    const state = createInitialMatchState();
    bridge.setState(state);
    bridge.emitBoardTargetClick({ kind: "lane-slot", side: "player", lane: 2 });

    expect(stateSpy).toHaveBeenCalledWith(state);
    expect(clickSpy).toHaveBeenCalledWith({ kind: "lane-slot", side: "player", lane: 2 });
  });

  it("avalia progressivamente os 6 estágios visuais de destruição do Coração do Reino", () => {
    const heart = {
      owner: "opponent" as const,
      culture: "japao" as const,
      name: "Santuário Torii",
      subtitle: "Portal Sagrado",
      currentHp: 20,
      maxHp: 20,
      shield: 0,
    };

    expect(getKingdomHeartVisualState({ ...heart, currentHp: 20 })).toBe("intact");
    expect(getKingdomHeartVisualState({ ...heart, currentHp: 15 })).toBe("under-pressure");
    expect(getKingdomHeartVisualState({ ...heart, currentHp: 11 })).toBe("damaged");
    expect(getKingdomHeartVisualState({ ...heart, currentHp: 7 })).toBe("severely-damaged");
    expect(getKingdomHeartVisualState({ ...heart, currentHp: 3 })).toBe("critical");
    expect(getKingdomHeartVisualState({ ...heart, currentHp: 0 })).toBe("destroyed");
  });

  it("executa a IA com os 4 perfis táticos determinísticos (agressivo, defensivo, estratégico, adaptativo)", () => {
    const profiles: AiProfile[] = ["aggressive", "defensive", "strategic", "adaptive"];

    for (const profile of profiles) {
      let state = createInitialMatchState({ mode: "vs-ai" });
      // Fast forward player turn
      state = applyMatchAction(state, { type: "end-turn", side: "player" }).state;
      expect(state.activeSide).toBe("opponent");

      const nextAction = chooseNextAiAction(state, "opponent", profile);
      expect(nextAction).toBeDefined();
      expect(["play-card", "creature-investida", "creature-despertar", "end-turn"]).toContain(
        nextAction.type,
      );

      const aiTurn = runAiTurnToCompletion(state, profile);
      expect(aiTurn.state.activeSide).toBe("player");
      expect(aiTurn.state.turn).toBeGreaterThanOrEqual(1);
    }
  });

  it("gerencia volumes de áudio em canais independentes (master, sfx, music)", () => {
    const audio = new CardRealmsAudio("brasil");
    audio.setMasterVolume(0.9);
    audio.setSfxVolume(0.7);
    audio.setMusicVolume(0.5);

    const volumes = audio.getVolumes();
    expect(volumes.master).toBe(0.9);
    expect(volumes.sfx).toBe(0.7);
    expect(volumes.music).toBe(0.5);

    audio.destroy();
  });
});
