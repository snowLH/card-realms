import { describe, expect, it, vi } from "vitest";
import { ALL_CARD_REALMS_CARDS } from "./content/cards";
import { computeEffectiveCreatureStats } from "./domain/creatures";
import { resolveElementalBiomeReaction } from "./domain/territories";
import {
  applyMatchAction,
  createInitialMatchState,
  runAiTurnToCompletion,
} from "./gameplay/engine";
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

  it("mantém todas as 22 cartas da Vertical Slice com retratos v5/autorais válidos", () => {
    expect(ALL_CARD_REALMS_CARDS).toHaveLength(22);
    for (const card of ALL_CARD_REALMS_CARDS) {
      expect(card.portrait.sheet).toMatch(/^\/art\//);
      expect(card.cost).toBeGreaterThanOrEqual(1);
    }
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
});
