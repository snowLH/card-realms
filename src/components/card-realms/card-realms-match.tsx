"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelCreature } from "@/components/game/pixel-creature";
import {
  BookOpen,
  Crown,
  Gem,
  Heart,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  X,
} from "@/components/ui/pixel-icon";
import { ALL_CARD_REALMS_CARDS } from "@/game/card-realms/content/cards";
import { getCardDefinition } from "@/game/card-realms/domain/cards";
import {
  computeEffectiveCreatureStats,
  getCreatureCardDefinition,
} from "@/game/card-realms/domain/creatures";
import { getCulture } from "@/game/card-realms/domain/cultures";
import {
  canPlayCardOnLane,
  getCurrentGuidedHint,
  getValidLanesForHandCard,
} from "@/game/card-realms/domain/match-rules";
import { getTerritoryBiome } from "@/game/card-realms/domain/territories";
import {
  BOARD_LANES,
  type CultureId,
  type LaneIndex,
  type MatchMode,
  type MatchState,
  type MatchVisualEvent,
  type PlayerSide,
  type TerritoryBiomeId,
} from "@/game/card-realms/domain/types";
import {
  applyMatchAction,
  createInitialMatchState,
  runAiTurnToCompletion,
} from "@/game/card-realms/gameplay/engine";
import {
  AI_PROFILE_LABELS,
  type AiProfile,
} from "@/game/card-realms/gameplay/ai-strategist";
import {
  CardRealmsAudio,
  type AudioVolumeSettings,
} from "@/game/card-realms/runtime/audio";
import { CardRealmsBridge } from "@/game/card-realms/runtime/bridge";
import { cn } from "@/lib/utils";
import { CardRealmsCardButton } from "./card-realms-card-button";

const BIOME_EMOJI: Readonly<Record<TerritoryBiomeId, string>> = {
  "campos-ancestrais": "🌾",
  "mata-encantada": "🌳",
  "rio-dos-espiritos": "🌊",
  "montanha-antiga": "🏔️",
  "terra-vulcanica": "🔥",
  "reino-congelado": "❄️",
  "deserto-sagrado": "🏜️",
  "reino-espiritual": "🌙",
};

const CULTURE_FLAG: Readonly<Record<CultureId, string>> = {
  brasil: "🇧🇷",
  japao: "🇯🇵",
};

export function CardRealmsMatch({
  playerName = "Estrategista",
  onOpenGuild,
  onOpenBestiary,
}: {
  playerName?: string;
  onOpenGuild?: () => void;
  onOpenBestiary?: () => void;
}) {
  const [playerCulture, setPlayerCulture] = useState<CultureId>("brasil");
  const [mode, setMode] = useState<MatchMode>("demo-guided");

  const [state, setState] = useState<MatchState>(() =>
    createInitialMatchState({
      mode: "demo-guided",
      playerCulture: "brasil",
      opponentCulture: "japao",
      playerName: `${playerName} (Brasil)`,
      seed: "card-realms-vertical-slice-seed",
    }),
  );

  const [selectedCardInstanceId, setSelectedCardInstanceId] = useState<string | null>(null);
  const [hoveredDropSlot, setHoveredDropSlot] = useState<{
    side: PlayerSide;
    lane: LaneIndex;
  } | null>(null);
  const [selectedCreatureSlot, setSelectedCreatureSlot] = useState<{
    side: PlayerSide;
    lane: LaneIndex;
  } | null>(null);
  const [inspectedSlot, setInspectedSlot] = useState<{
    side: PlayerSide;
    lane: LaneIndex;
  }>({ side: "player", lane: 0 });
  const [grimoireOpen, setGrimoireOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [aiProfile, setAiProfile] = useState<AiProfile>("strategic");
  const [showVolumeControls, setShowVolumeControls] = useState(false);
  const [volumes, setVolumes] = useState<AudioVolumeSettings>(() => {
    if (typeof window === "undefined") return { master: 0.8, sfx: 0.8, music: 0.6 };
    try {
      const raw = window.localStorage.getItem("card-realms-volume");
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore storage errors
    }
    return { master: 0.8, sfx: 0.8, music: 0.6 };
  });

  const handleVolumeChange = (channel: keyof AudioVolumeSettings, value: number) => {
    const next = { ...volumes, [channel]: value };
    setVolumes(next);
    if (channel === "master") audioRef.current?.setMasterVolume(value);
    if (channel === "sfx") audioRef.current?.setSfxVolume(value);
    if (channel === "music") audioRef.current?.setMusicVolume(value);
  };

  const bridgeRef = useRef<CardRealmsBridge | null>(null);
  const audioRef = useRef<CardRealmsAudio | null>(null);
  const phaserHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bridgeRef.current) {
      bridgeRef.current = new CardRealmsBridge();
      bridgeRef.current.setState(state);
    }
    if (!audioRef.current) {
      audioRef.current = new CardRealmsAudio("brasil");
    }
  }, [state]);

  const activeSide: PlayerSide =
    state.mode === "local-pass-and-play" ? state.activeSide : "player";
  const activePlayer = state.players[activeSide];
  const bottomPlayer = state.players.player;
  const topPlayer = state.players.opponent;

  const selectedCardInHand = useMemo(
    () => activePlayer.hand.find((item) => item.instanceId === selectedCardInstanceId) ?? null,
    [activePlayer.hand, selectedCardInstanceId],
  );
  const selectedCardDef = useMemo(
    () => (selectedCardInHand ? getCardDefinition(selectedCardInHand.cardId) : null),
    [selectedCardInHand],
  );

  const validLanesForSelectedCard = useMemo(
    () =>
      selectedCardInHand && state.activeSide === activeSide && !state.winner
        ? getValidLanesForHandCard(state, activeSide, selectedCardInHand.instanceId)
        : [],
    [activeSide, selectedCardInHand, state],
  );

  const updatePreviewSlot = useCallback(
    (slot: { side: PlayerSide; lane: LaneIndex } | null) => {
      setHoveredDropSlot(slot);
      if (!slot || !selectedCardDef) {
        bridgeRef.current?.setPreviewSlot(null);
      } else {
        bridgeRef.current?.setPreviewSlot({
          side: slot.side,
          lane: slot.lane,
          cardId: selectedCardDef.id,
        });
      }
    },
    [selectedCardDef],
  );

  const previewProjection = useMemo(() => {
    if (!hoveredDropSlot || !selectedCardDef) return null;
    const targetSlot = state.lanes[hoveredDropSlot.side][hoveredDropSlot.lane];
    const biome = getTerritoryBiome(targetSlot.biomeId);

    if (selectedCardDef.category === "creature") {
      const isFavored = selectedCardDef.favoredBiomes.includes(targetSlot.biomeId);
      const effectiveAttack =
        selectedCardDef.attack + (isFavored ? selectedCardDef.biomeAttackBonus : 0);
      const effectiveHp = selectedCardDef.maxHp;
      return {
        title: `Prévia de Invocação: ${selectedCardDef.name} na Faixa ${hoveredDropSlot.lane + 1} (${biome.name})`,
        detail: `⚔️ ${effectiveAttack} ATQ · ❤️ ${effectiveHp} PV ${
          isFavored
            ? `· ✨ Bônus de Bioma Favorecido (+${selectedCardDef.biomeAttackBonus} ATQ) ativado!`
            : ""
        }`,
      };
    }
    if (selectedCardDef.category === "territory") {
      const newBiome = getTerritoryBiome(selectedCardDef.biomeId);
      return {
        title: `Prévia de Mutação: Terreno da Faixa ${hoveredDropSlot.lane + 1}`,
        detail: `🗺️ Converte de ${biome.name} para ${newBiome.name}`,
      };
    }
    if (selectedCardDef.category === "structure") {
      return {
        title: `Prévia de Estrutura: ${selectedCardDef.name} na Faixa ${hoveredDropSlot.lane + 1}`,
        detail: `🏛️ ${selectedCardDef.maxHp} PV de fortificação territorial`,
      };
    }
    if (selectedCardDef.category === "event") {
      return {
        title: `Prévia de Evento: ${selectedCardDef.name}`,
        detail: `✨ ${selectedCardDef.description}`,
      };
    }
    return null;
  }, [hoveredDropSlot, selectedCardDef, state.lanes]);

  const selectedBoardSlot = useMemo(
    () =>
      selectedCreatureSlot
        ? state.lanes[selectedCreatureSlot.side][selectedCreatureSlot.lane]
        : null,
    [selectedCreatureSlot, state.lanes],
  );
  const selectedBoardCreature = selectedBoardSlot?.creature ?? null;
  const selectedBoardCreatureDef = useMemo(
    () => (selectedBoardCreature ? getCreatureCardDefinition(selectedBoardCreature.cardId) : null),
    [selectedBoardCreature],
  );
  const selectedBoardCreatureStats = useMemo(
    () => (selectedBoardSlot ? computeEffectiveCreatureStats(selectedBoardSlot) : null),
    [selectedBoardSlot],
  );

  const inspectedBoardSlot = useMemo(
    () => state.lanes[inspectedSlot.side][inspectedSlot.lane],
    [inspectedSlot.lane, inspectedSlot.side, state.lanes],
  );

  // Sync selection and valid lane highlights to Phaser 2.5D tabletop
  useEffect(() => {
    bridgeRef.current?.setHighlightedLanes(
      validLanesForSelectedCard.length > 0
        ? { side: activeSide, lanes: validLanesForSelectedCard }
        : null,
    );
    bridgeRef.current?.setSelectedSlot(selectedCreatureSlot ?? inspectedSlot);
  }, [activeSide, inspectedSlot, selectedCreatureSlot, validLanesForSelectedCard]);

  const applyTransition = useCallback(
    (nextState: MatchState, events: readonly MatchVisualEvent[] = []) => {
      setState(nextState);
      bridgeRef.current?.setState(nextState);
      bridgeRef.current?.emitVisualEvents(events);
    },
    [],
  );

  const startNewMatch = useCallback(
    (nextMode: MatchMode, nextPlayerCulture: CultureId) => {
      const nextOpponentCulture: CultureId = nextPlayerCulture === "brasil" ? "japao" : "brasil";
      const fresh = createInitialMatchState({
        mode: nextMode,
        playerCulture: nextPlayerCulture,
        opponentCulture: nextOpponentCulture,
        playerName: `${playerName} (${getCulture(nextPlayerCulture).countryLabel})`,
        seed: "card-realms-vertical-slice-seed",
      });
      setSelectedCardInstanceId(null);
      setSelectedCreatureSlot(null);
      setInspectedSlot({ side: "player", lane: 0 });
      audioRef.current?.setCulture(nextPlayerCulture);
      setStatusBanner(
        `Nova batalha no tabuleiro: ${getCulture(nextPlayerCulture).name} vs ${getCulture(nextOpponentCulture).name}.`,
      );
      applyTransition(fresh, []);
    },
    [applyTransition, playerName],
  );

  const handleSlotInteraction = useCallback(
    (side: PlayerSide, lane: LaneIndex) => {
      setInspectedSlot({ side, lane });

      // 1. If a card is selected in the strategist's hand, try playing it on this lane
      if (selectedCardInHand && state.activeSide === activeSide && !state.winner) {
        const cardDef = getCardDefinition(selectedCardInHand.cardId);
        // Territory, Creature, and Structure cards are placed on the active player's lane; Event cards can be played on any lane
        if (side === activeSide || cardDef.category === "event") {
          const check = canPlayCardOnLane(state, activeSide, cardDef, lane);
          if (check.ok) {
            const res = applyMatchAction(state, {
              type: "play-card",
              side: activeSide,
              handInstanceId: selectedCardInHand.instanceId,
              lane,
              targetSide: side,
            });
            if (res.ok) {
              setSelectedCardInstanceId(null);
              setHoveredDropSlot(null);
              bridgeRef.current?.setPreviewSlot(null);
              const updatedSlot = res.state.lanes[activeSide][lane];
              if (updatedSlot.creature) {
                setSelectedCreatureSlot({ side: activeSide, lane });
              }
              setStatusBanner(
                `${cardDef.name} materializada na Faixa ${lane + 1} (${getTerritoryBiome(updatedSlot.biomeId).name})!`,
              );
              applyTransition(res.state, res.events);
              return;
            }
          } else {
            setStatusBanner(check.reason ?? "Jogada inválida para este território.");
            return;
          }
        }
      }

      // 2. Otherwise, if clicking an allied creature on the board, select it for Investida vs Despertar Ancestral
      const slot = state.lanes[side][lane];
      if (slot.creature && side === activeSide) {
        setSelectedCardInstanceId(null);
        setSelectedCreatureSlot({ side, lane });
        const def = getCreatureCardDefinition(slot.creature.cardId);
        setStatusBanner(
          `${def.name} selecionada na Faixa ${lane + 1}. Escolha entre ⚔️ Investida ou 🔮 Despertar Ancestral (${def.awakeningPower.name}).`,
        );
      } else {
        setSelectedCreatureSlot(null);
      }
    },
    [activeSide, applyTransition, selectedCardInHand, state],
  );

  // Mount Phaser 2.5D Tabletop Board in browser environments
  useEffect(() => {
    const host = phaserHostRef.current;
    const bridge = bridgeRef.current;
    const audio = audioRef.current;
    if (!host || !bridge || !audio) return;
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")) {
      return;
    }

    let cancelled = false;
    let cleanupGame: (() => void) | null = null;

    const unsubscribe = bridge.onBoardTargetClick((target) => {
      if (target.kind === "lane-slot") {
        handleSlotInteraction(target.side, target.lane);
      }
    });

    import("@/game/card-realms/runtime/phaser-board")
      .then(async ({ createCardRealmsBoardGame }) => {
        if (cancelled || !phaserHostRef.current) return;
        const instance = await createCardRealmsBoardGame(phaserHostRef.current, bridge, audio);
        if (cancelled) {
          instance.destroy();
          return;
        }
        cleanupGame = () => instance.destroy();
      })
      .catch((error: unknown) => {
        console.warn("Tabuleiro Phaser em modo tático HTML:", error);
      });

    return () => {
      cancelled = true;
      unsubscribe();
      cleanupGame?.();
    };
  }, [handleSlotInteraction]);

  const handleInvestida = () => {
    if (!selectedCreatureSlot) return;
    const res = applyMatchAction(state, {
      type: "creature-investida",
      side: activeSide,
      lane: selectedCreatureSlot.lane,
    });
    if (!res.ok) {
      setStatusBanner(res.error ?? "Não foi possível realizar a Investida.");
      return;
    }
    setSelectedCreatureSlot(null);
    setStatusBanner("⚔️ Investida executada no tabuleiro!");
    applyTransition(res.state, res.events);
  };

  const handleDespertar = () => {
    if (!selectedCreatureSlot) return;
    const res = applyMatchAction(state, {
      type: "creature-despertar",
      side: activeSide,
      lane: selectedCreatureSlot.lane,
    });
    if (!res.ok) {
      setStatusBanner(res.error ?? "Não foi possível ativar o Despertar Ancestral.");
      return;
    }
    setSelectedCreatureSlot(null);
    setStatusBanner("🔮 Despertar Ancestral canalizado com sucesso!");
    applyTransition(res.state, res.events);
  };

  const handleEndTurn = () => {
    if (state.winner) return;
    setSelectedCardInstanceId(null);
    setSelectedCreatureSlot(null);

    const turnRes = applyMatchAction(state, {
      type: "end-turn",
      side: state.activeSide,
    });
    if (!turnRes.ok) return;

    if (
      (turnRes.state.mode === "demo-guided" || turnRes.state.mode === "vs-ai") &&
      turnRes.state.activeSide === "opponent" &&
      !turnRes.state.winner
    ) {
      const aiRes = runAiTurnToCompletion(turnRes.state, aiProfile);
      setStatusBanner(
        `O Estrategista adversário (${AI_PROFILE_LABELS[aiProfile].name}) concluiu suas invocações e manobras.`,
      );
      applyTransition(aiRes.state, [...turnRes.events, ...aiRes.events]);
      return;
    }

    setStatusBanner(
      `Turno ${turnRes.state.turn} iniciado para ${turnRes.state.players[turnRes.state.activeSide].name}.`,
    );
    applyTransition(turnRes.state, turnRes.events);
  };

  const guidedHint = getCurrentGuidedHint(state);

  const handleExecuteGuidedStep = () => {
    if (!guidedHint || state.winner) return;

    if (guidedHint.recommendedAction === "play-card" && guidedHint.recommendedCardId) {
      const cardInHand = bottomPlayer.hand.find(
        (item) => item.cardId === guidedHint.recommendedCardId,
      );
      if (cardInHand) {
        const targetLane = guidedHint.recommendedLane ?? 0;
        const res = applyMatchAction(state, {
          type: "play-card",
          side: "player",
          handInstanceId: cardInHand.instanceId,
          lane: targetLane,
        });
        if (res.ok) {
          setSelectedCardInstanceId(null);
          if (res.state.lanes.player[targetLane].creature) {
            setSelectedCreatureSlot({ side: "player", lane: targetLane });
          }
          setStatusBanner(`Passo guiado executado: ${guidedHint.title}`);
          applyTransition(res.state, res.events);
          return;
        }
      }
    }

    if (guidedHint.recommendedAction === "end-turn") {
      handleEndTurn();
      return;
    }

    if (guidedHint.recommendedAction === "despertar") {
      const targetLane = guidedHint.recommendedLane ?? 0;
      const res = applyMatchAction(state, {
        type: "creature-despertar",
        side: "player",
        lane: targetLane,
      });
      if (res.ok) {
        setSelectedCreatureSlot({ side: "player", lane: targetLane });
        setStatusBanner("🔮 Despertar Ancestral ativado!");
        applyTransition(res.state, res.events);
      }
    }
  };

  return (
    <section className="card-realms-shell" aria-label="Card Realms: O Tabuleiro Vivo">
      {/* Top Strategic Bar */}
      <header className="card-realms-topbar">
        <div className="card-realms-topbar__brand">
          <Crown size={24} aria-hidden="true" />
          <div>
            <h1>CARD REALMS · TABULEIRO VIVO</h1>
            <small>
              Estrategista {playerName} · Lendas do Folclore Mundial em Territórios Vivos
            </small>
          </div>
        </div>

        <div className="card-realms-topbar__controls">
          <button
            type="button"
            onClick={() => {
              setMode("demo-guided");
              startNewMatch("demo-guided", playerCulture);
            }}
            aria-pressed={mode === "demo-guided"}
          >
            Jornada Guiada
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("vs-ai");
              startNewMatch("vs-ai", playerCulture);
            }}
            aria-pressed={mode === "vs-ai"}
          >
            Duelo vs IA
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("local-pass-and-play");
              startNewMatch("local-pass-and-play", playerCulture);
            }}
            aria-pressed={mode === "local-pass-and-play"}
          >
            2 Estrategistas (Local)
          </button>
          <button
            type="button"
            onClick={() => {
              const nextCulture: CultureId = playerCulture === "brasil" ? "japao" : "brasil";
              setPlayerCulture(nextCulture);
              startNewMatch(mode, nextCulture);
            }}
          >
            Reino: {CULTURE_FLAG[playerCulture]} {getCulture(playerCulture).name}
          </button>
          <button type="button" onClick={() => setGrimoireOpen((prev) => !prev)}>
            <BookOpen size={14} aria-hidden="true" /> Grimório (22 Cartas)
          </button>
          {mode !== "local-pass-and-play" && (
            <label className="card-realms-ai-select-label">
              <span>IA:</span>
              <select
                aria-label="Perfil tático da IA"
                value={aiProfile}
                onChange={(e) => setAiProfile(e.target.value as AiProfile)}
                className="card-realms-topbar-select"
              >
                <option value="strategic">Estratégica (Sinergia)</option>
                <option value="aggressive">Agressiva (Investida)</option>
                <option value="defensive">Defensiva (Muralha)</option>
                <option value="adaptive">Adaptativa (Dinâmica)</option>
              </select>
            </label>
          )}
          <div style={{ position: "relative", display: "inline-flex" }}>
            <button
              type="button"
              aria-label={soundEnabled ? "Silenciar efeitos sonoros" : "Ativar efeitos sonoros"}
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                audioRef.current?.setEnabled(next);
              }}
            >
              {soundEnabled ? (
                <Volume2 size={14} aria-hidden="true" />
              ) : (
                <VolumeX size={14} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              aria-label="Ajustar volumes da música e efeitos"
              title="Ajustar volumes de áudio"
              onClick={() => setShowVolumeControls((p) => !p)}
            >
              🎚️
            </button>
            {showVolumeControls && (
              <div className="card-realms-volume-popover">
                <label>
                  <span>Geral:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes.master}
                    onChange={(e) => handleVolumeChange("master", Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>Efeitos:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes.sfx}
                    onChange={(e) => handleVolumeChange("sfx", Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>Música:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes.music}
                    onChange={(e) => handleVolumeChange("music", Number(e.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
          {onOpenBestiary ? (
            <button type="button" onClick={onOpenBestiary}>
              Bestiário
            </button>
          ) : null}
          {onOpenGuild ? (
            <button type="button" onClick={onOpenGuild}>
              Expedições & Guilda
            </button>
          ) : null}
        </div>
      </header>

      {/* Guided First Match Banner (Section 14) */}
      {guidedHint && !state.winner ? (
        <div
          className="card-realms-guided-banner"
          role="region"
          aria-label="Guia da Primeira Partida"
        >
          <div>
            <strong>✨ {guidedHint.title}</strong>
            <p>{guidedHint.instruction}</p>
          </div>
          {guidedHint.recommendedAction ? (
            <button type="button" onClick={handleExecuteGuidedStep}>
              <Play size={14} aria-hidden="true" /> Executar Passo Guiado
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Victory Banner */}
      {state.winner ? (
        <div className="card-realms-victory-banner" role="alert">
          <h2>
            👑 VITÓRIA DE {state.players[state.winner].name.toUpperCase()} (
            {CULTURE_FLAG[state.players[state.winner].culture]}{" "}
            {getCulture(state.players[state.winner].culture).name})!
          </h2>
          <p>{state.winReason}</p>
          <div className="card-realms-victory-stats" aria-label="Estatísticas da Partida">
            <div>
              <strong>Turnos Disputados</strong>
              <span>{state.turn} Turnos</span>
            </div>
            <div>
              <strong>Coração Aliado</strong>
              <span>
                {bottomPlayer.heart.currentHp}/{bottomPlayer.heart.maxHp} PV
              </span>
            </div>
            <div>
              <strong>Coração Inimigo</strong>
              <span>
                {topPlayer.heart.currentHp}/{topPlayer.heart.maxHp} PV
              </span>
            </div>
            <div>
              <strong>Ações no Tabuleiro</strong>
              <span>{state.log.length} Manobras</span>
            </div>
          </div>
          <button type="button" onClick={() => startNewMatch(mode, playerCulture)}>
            <RotateCcw size={14} aria-hidden="true" /> Jogar Nova Batalha no Tabuleiro
          </button>
        </div>
      ) : null}

      <div className="card-realms-arena-grid">
        {/* Main Board Column */}
        <div className="card-realms-board-column">
          {/* Top Adversary Kingdom Strip */}
          <div className="card-realms-kingdom-strip" aria-label="Reino Adversário">
            <div className="card-realms-kingdom-strip__identity">
              <span>{CULTURE_FLAG[topPlayer.culture]}</span>
              <div>
                <strong>
                  {topPlayer.name} · 👑 {topPlayer.heart.name}
                </strong>
                <small>{topPlayer.heart.subtitle}</small>
              </div>
            </div>
            <div className="card-realms-kingdom-strip__metrics">
              <span data-testid="top-heart-hp">
                <Heart size={14} aria-hidden="true" /> Coração: {topPlayer.heart.currentHp}/
                {topPlayer.heart.maxHp}
                {topPlayer.heart.shield > 0 ? ` (+${topPlayer.heart.shield} Escudo)` : ""}
              </span>
              <span>
                <Gem size={14} aria-hidden="true" /> Sopro: {topPlayer.breath}/
                {topPlayer.maxBreath}
              </span>
              <span>Mão: {topPlayer.hand.length}</span>
              <span>Grimório: {topPlayer.deck.length}</span>
            </div>
          </div>

          {/* Phaser 2.5D Living Tabletop Canvas */}
          <div
            className="card-realms-phaser-frame"
            aria-label="Visão 2.5D inclinada do Tabuleiro Vivo"
          >
            <div ref={phaserHostRef} className="card-realms-phaser-canvas" />
          </div>

          {/* Interactive 4-Lane Tactical Board Controls (Synchronized with Phaser 2.5D Board) */}
          <div
            className="card-realms-tactical-lanes"
            role="group"
            aria-label="Faixas de Território do Tabuleiro"
          >
            {BOARD_LANES.map((lane) => {
              const topSlot = state.lanes.opponent[lane];
              const bottomSlot = state.lanes.player[lane];
              const topBiome = getTerritoryBiome(topSlot.biomeId);
              const bottomBiome = getTerritoryBiome(bottomSlot.biomeId);

              const isBottomValidTarget =
                activeSide === "player" && validLanesForSelectedCard.includes(lane);
              const isTopValidTarget =
                (activeSide === "opponent" && validLanesForSelectedCard.includes(lane)) ||
                (selectedCardDef?.category === "event" &&
                  validLanesForSelectedCard.includes(lane));

              const topCreatureDef = topSlot.creature
                ? getCreatureCardDefinition(topSlot.creature.cardId)
                : null;
              const topCreatureStats = computeEffectiveCreatureStats(topSlot);

              const bottomCreatureDef = bottomSlot.creature
                ? getCreatureCardDefinition(bottomSlot.creature.cardId)
                : null;
              const bottomCreatureStats = computeEffectiveCreatureStats(bottomSlot);

              return (
                <div key={lane} className="card-realms-lane-column">
                  <div className="card-realms-lane-column__header">
                    <span>FAIXA {lane + 1}</span>
                    <span>
                      {BIOME_EMOJI[topSlot.biomeId]} vs {BIOME_EMOJI[bottomSlot.biomeId]}
                    </span>
                  </div>

                  {/* Opponent Territory Slot */}
                  <button
                    type="button"
                    data-testid={`slot-opponent-${lane}`}
                    onClick={() => handleSlotInteraction("opponent", lane)}
                    onDragOver={(e) => {
                      if (isTopValidTarget) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        updatePreviewSlot({ side: "opponent", lane });
                      }
                    }}
                    onDragLeave={() => {
                      if (hoveredDropSlot?.side === "opponent" && hoveredDropSlot.lane === lane) {
                        updatePreviewSlot(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isTopValidTarget) {
                        handleSlotInteraction("opponent", lane);
                        updatePreviewSlot(null);
                      }
                    }}
                    onPointerEnter={() => {
                      if (selectedCardDef && isTopValidTarget) {
                        updatePreviewSlot({ side: "opponent", lane });
                      }
                    }}
                    onPointerLeave={() => {
                      if (hoveredDropSlot?.side === "opponent" && hoveredDropSlot.lane === lane) {
                        updatePreviewSlot(null);
                      }
                    }}
                    className={cn(
                      "card-realms-slot-button",
                      isTopValidTarget && "is-highlighted",
                      hoveredDropSlot?.side === "opponent" &&
                        hoveredDropSlot.lane === lane &&
                        "is-drop-target",
                      inspectedSlot.side === "opponent" &&
                        inspectedSlot.lane === lane &&
                        "is-selected",
                    )}
                  >
                    <div className="card-realms-slot-button__biome">
                      <span>
                        {BIOME_EMOJI[topSlot.biomeId]} {topBiome.name}
                      </span>
                    </div>
                    {topSlot.structure ? (
                      <small>
                        🏛️ {getCardDefinition(topSlot.structure.cardId).name} (
                        {topSlot.structure.currentHp} PV)
                      </small>
                    ) : null}
                    {topSlot.creature && topCreatureDef && topCreatureStats ? (
                      <div className="card-realms-slot-button__creature">
                        <PixelCreature
                          sprite={topCreatureDef.portrait}
                          label={topCreatureDef.name}
                        />
                        <div>
                          <strong>{topCreatureDef.name}</strong>
                          <small>
                            ⚔️ {topCreatureStats.effectiveAttack} · ❤️{" "}
                            {topSlot.creature.currentHp}/{topSlot.creature.maxHp}
                            {topSlot.creature.shield > 0
                              ? ` (+${topSlot.creature.shield} Escudo)`
                              : ""}
                            {topSlot.creature.statuses.includes("confused")
                              ? " · 🌀 Confusa"
                              : ""}
                            {topSlot.creature.statuses.includes("veiled") ? " · 🌫️ Véu" : ""}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <small>Território adversário livre</small>
                    )}
                  </button>

                  {/* Player Territory Slot */}
                  <button
                    type="button"
                    data-testid={`slot-player-${lane}`}
                    onClick={() => handleSlotInteraction("player", lane)}
                    onDragOver={(e) => {
                      if (isBottomValidTarget) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        updatePreviewSlot({ side: "player", lane });
                      }
                    }}
                    onDragLeave={() => {
                      if (hoveredDropSlot?.side === "player" && hoveredDropSlot.lane === lane) {
                        updatePreviewSlot(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isBottomValidTarget) {
                        handleSlotInteraction("player", lane);
                        updatePreviewSlot(null);
                      }
                    }}
                    onPointerEnter={() => {
                      if (selectedCardDef && isBottomValidTarget) {
                        updatePreviewSlot({ side: "player", lane });
                      }
                    }}
                    onPointerLeave={() => {
                      if (hoveredDropSlot?.side === "player" && hoveredDropSlot.lane === lane) {
                        updatePreviewSlot(null);
                      }
                    }}
                    className={cn(
                      "card-realms-slot-button",
                      isBottomValidTarget && "is-highlighted",
                      hoveredDropSlot?.side === "player" &&
                        hoveredDropSlot.lane === lane &&
                        "is-drop-target",
                      ((selectedCreatureSlot?.side === "player" &&
                        selectedCreatureSlot.lane === lane) ||
                        (inspectedSlot.side === "player" && inspectedSlot.lane === lane)) &&
                        "is-selected",
                    )}
                  >
                    <div className="card-realms-slot-button__biome">
                      <span>
                        {BIOME_EMOJI[bottomSlot.biomeId]} {bottomBiome.name}
                      </span>
                    </div>
                    {bottomSlot.structure ? (
                      <small>
                        🏛️ {getCardDefinition(bottomSlot.structure.cardId).name} (
                        {bottomSlot.structure.currentHp} PV)
                      </small>
                    ) : null}
                    {bottomSlot.creature && bottomCreatureDef && bottomCreatureStats ? (
                      <div className="card-realms-slot-button__creature">
                        <PixelCreature
                          sprite={bottomCreatureDef.portrait}
                          label={bottomCreatureDef.name}
                        />
                        <div>
                          <strong>{bottomCreatureDef.name}</strong>
                          <small>
                            ⚔️ {bottomCreatureStats.effectiveAttack} · ❤️{" "}
                            {bottomSlot.creature.currentHp}/{bottomSlot.creature.maxHp}
                            {bottomSlot.creature.shield > 0
                              ? ` (+${bottomSlot.creature.shield} Escudo)`
                              : ""}{" "}
                            {bottomSlot.creature.canAct ? "· ⚡ Pronta" : "· ⏳ Agiu"}
                            {bottomCreatureStats.isFavoredTerrain ? " · ✨ Sinergia" : ""}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <small>
                        {isBottomValidTarget
                          ? "✨ Clique para materializar carta aqui"
                          : "Território aliado livre"}
                      </small>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Core Tactical Decision Bar: ⚔️ INVESTIDA vs 🔮 DESPERTAR ANCESTRAL */}
          <div
            className="card-realms-action-bar"
            role="region"
            aria-label="Decisão Tática da Lenda"
          >
            {previewProjection ? (
              <div className="card-realms-action-bar__summary">
                <strong style={{ color: "var(--amber-gold, #f6d267)" }}>
                  {previewProjection.title}
                </strong>
                <small>{previewProjection.detail}</small>
              </div>
            ) : selectedBoardCreature && selectedBoardCreatureDef && selectedBoardCreatureStats ? (
              <>
                <div className="card-realms-action-bar__summary">
                  <strong>
                    👹 {selectedBoardCreatureDef.name} na Faixa{" "}
                    {(selectedCreatureSlot?.lane ?? 0) + 1} (
                    {selectedBoardCreature.canAct
                      ? "Pronta para agir: Escolha ATAQUE ou PODER"
                      : "Esta Lenda aguarda o próximo turno para agir"}
                    )
                  </strong>
                  <small>
                    <strong>⚔️ Investida:</strong> {selectedBoardCreatureStats.effectiveAttack} de
                    dano na Faixa {(selectedCreatureSlot?.lane ?? 0) + 1} ·{" "}
                    <strong>🔮 Despertar Ancestral ({selectedBoardCreatureDef.awakeningPower.name}):</strong>{" "}
                    {selectedBoardCreatureDef.awakeningPower.description}
                  </small>
                </div>
                <div className="card-realms-action-bar__buttons">
                  <button
                    type="button"
                    disabled={!selectedBoardCreature.canAct || Boolean(state.winner)}
                    onClick={handleInvestida}
                  >
                    <Swords size={14} aria-hidden="true" /> ⚔️ INVESTIDA (
                    {selectedBoardCreatureStats.effectiveAttack} Dano)
                  </button>
                  <button
                    type="button"
                    disabled={!selectedBoardCreature.canAct || Boolean(state.winner)}
                    onClick={handleDespertar}
                  >
                    <Sparkles size={14} aria-hidden="true" /> 🔮 DESPERTAR ANCESTRAL (
                    {selectedBoardCreatureDef.awakeningPower.name})
                  </button>
                </div>
              </>
            ) : selectedCardDef && selectedCardInHand ? (
              <>
                <div className="card-realms-action-bar__summary">
                  <strong>
                    Carta selecionada: {selectedCardDef.name} (Custo {selectedCardDef.cost} Sopro)
                  </strong>
                  <small>
                    Clique em uma faixa destacada no Tabuleiro Vivo para posicionar e materializar a
                    carta.
                  </small>
                </div>
                <div className="card-realms-action-bar__buttons">
                  {selectedCardDef.category === "event" && !selectedCardDef.requiresLane ? (
                    <button
                      type="button"
                      onClick={() => handleSlotInteraction(activeSide, 0)}
                    >
                      <Sparkles size={14} aria-hidden="true" /> ✨ Disparar Evento (
                      {selectedCardDef.name})
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setSelectedCardInstanceId(null)}>
                    <X size={14} aria-hidden="true" /> Cancelar Seleção
                  </button>
                </div>
              </>
            ) : (
              <div className="card-realms-action-bar__summary">
                <strong>
                  {statusBanner ??
                    "Selecione uma carta da sua mão para invocá-la em um território, ou clique em uma Lenda aliada no tabuleiro para escolher entre ⚔️ Investida e 🔮 Despertar Ancestral."}
                </strong>
                <small>
                  Cada criatura possui 1 ação por turno: atacar a faixa inimiga ou despertar seu
                  poder folclórico para transformar a partida.
                </small>
              </div>
            )}
          </div>

          {/* Strategist's Hand & Allied Kingdom Strip */}
          <div className="card-realms-hand-dock" aria-label="Mão do Estrategista">
            <div className="card-realms-hand-dock__header">
              <div className="card-realms-kingdom-strip__identity">
                <span>{CULTURE_FLAG[activePlayer.culture]}</span>
                <div>
                  <strong>
                    {activePlayer.name} · 👑 {activePlayer.heart.name}
                  </strong>
                  <small>
                    Turno {state.turn} · {activePlayer.heart.subtitle}
                  </small>
                </div>
              </div>

              <div className="card-realms-kingdom-strip__metrics">
                <span data-testid="bottom-heart-hp">
                  <Heart size={14} aria-hidden="true" /> Coração: {activePlayer.heart.currentHp}/
                  {activePlayer.heart.maxHp}
                  {activePlayer.heart.shield > 0
                    ? ` (+${activePlayer.heart.shield} Escudo)`
                    : ""}
                </span>
                <span data-testid="active-spirit">
                  <Gem size={14} aria-hidden="true" /> Sopro Ancestral: {activePlayer.breath}/
                  {activePlayer.maxBreath}
                </span>
                <button type="button" disabled={Boolean(state.winner)} onClick={handleEndTurn}>
                  Encerrar Turno {state.turn}
                </button>
              </div>
            </div>

            <div className="card-realms-hand-grid">
              {activePlayer.hand.map((handItem) => {
                const cardDef = getCardDefinition(handItem.cardId);
                const affordable = activePlayer.breath >= cardDef.cost;
                const isSelected = selectedCardInstanceId === handItem.instanceId;

                return (
                  <CardRealmsCardButton
                    key={handItem.instanceId}
                    card={cardDef}
                    instanceId={handItem.instanceId}
                    selected={isSelected}
                    affordable={affordable}
                    disabled={!affordable || Boolean(state.winner)}
                    onClick={() => {
                      setSelectedCreatureSlot(null);
                      setSelectedCardInstanceId((prev) =>
                        prev === handItem.instanceId ? null : handItem.instanceId,
                      );
                    }}
                    onDragStartCard={(_card, instId) => {
                      setSelectedCreatureSlot(null);
                      setSelectedCardInstanceId(instId);
                    }}
                    onDragEndCard={() => {
                      updatePreviewSlot(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Living Board Inspector & Match Chronicle */}
        <aside className="card-realms-sidebar">
          <section className="card-realms-inspector" aria-label="Inspetor do Território">
            <h2>
              🗺️ Território · Faixa {inspectedSlot.lane + 1} (
              {inspectedSlot.side === "player" ? "Seu Reino" : "Reino Adversário"})
            </h2>
            <p>
              <strong>
                {BIOME_EMOJI[inspectedBoardSlot.biomeId]}{" "}
                {getTerritoryBiome(inspectedBoardSlot.biomeId).name}
              </strong>
              <br />
              <small>{getTerritoryBiome(inspectedBoardSlot.biomeId).tagline}</small>
            </p>
            <p>
              <small>{getTerritoryBiome(inspectedBoardSlot.biomeId).description}</small>
            </p>

            {inspectedBoardSlot.structure ? (
              <p>
                <Shield size={13} aria-hidden="true" />{" "}
                <strong>{getCardDefinition(inspectedBoardSlot.structure.cardId).name}</strong> (
                {inspectedBoardSlot.structure.currentHp}/
                {inspectedBoardSlot.structure.maxHp} PV)
              </p>
            ) : null}

            {inspectedBoardSlot.creature ? (
              <div>
                <strong>
                  👹 {getCreatureCardDefinition(inspectedBoardSlot.creature.cardId).name} (
                  {getCreatureCardDefinition(inspectedBoardSlot.creature.cardId).subtitle})
                </strong>
                <p>
                  <small>
                    {getCreatureCardDefinition(inspectedBoardSlot.creature.cardId).folkloreNote}
                  </small>
                </p>
              </div>
            ) : null}
          </section>

          <section className="card-realms-chronicle" aria-label="Crônica da Partida">
            <h2>📜 Crônica do Tabuleiro ({state.log.length})</h2>
            <ul className="card-realms-chronicle__list">
              {[...state.log].reverse().map((entry) => (
                <li key={entry.id} className="card-realms-chronicle__item">
                  <strong>
                    [T{entry.turn}] {entry.title}
                  </strong>
                  <span>{entry.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* Grimório das 22 Cartas Modal */}
      {grimoireOpen ? (
        <section className="card-realms-hand-dock" aria-label="Grimório Completo do Vertical Slice">
          <div className="card-realms-hand-dock__header">
            <strong>
              📖 GRIMÓRIO FOLCLÓRICO — 🇧🇷 BRASIL VS 🇯🇵 JAPÃO ({ALL_CARD_REALMS_CARDS.length} Cartas
              Autorais)
            </strong>
            <button type="button" onClick={() => setGrimoireOpen(false)}>
              <X size={14} aria-hidden="true" /> Fechar Grimório
            </button>
          </div>
          <div className="card-realms-hand-grid">
            {ALL_CARD_REALMS_CARDS.map((card) => (
              <CardRealmsCardButton key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
