"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRightLeft,
  ChevronRight,
  Dice5,
  Flame,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import type { BattleBoardId } from "@/game/battle/presentation";
import type { AvatarConfig } from "@/game/save/local-progress";
import { canPayCost, energyPoolFor, getActive, getSide } from "@/game/engine";
import { presentationDuration, toBattlePresentationEvents, type BattlePresentationEvent } from "@/game/battle/presentation-events";
import { playBattleSfx, unlockBattleAudio } from "@/game/battle/audio";
import { type BattleEncounter, type BattleLogEntry, type BattleState, type Element, type EnergyPool } from "@/game/types";
import type { BattleReward } from "@/game/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "./creature-card";
import { PixelCreature } from "./pixel-creature";
import { BattleActiveCreature } from "./battle-active-creature";
import { BattleBoardScene } from "./battle-board-scene";
import { CharacterAvatar2D } from "./character-avatar";

type BattleResponse = {
  state: BattleState;
  events: BattleLogEntry[];
  reward?: BattleReward;
  token?: string;
  version?: number;
  boardId?: BattleBoardId;
  authority: "server";
};

type PvpSession = {
  battleId: string;
  playerId: string;
};

function actionId() {
  return crypto.randomUUID();
}

async function callBattleApi(body: Record<string, unknown>): Promise<BattleResponse> {
  const response = await fetch("/api/battle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as BattleResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "A ação não pôde ser concluída.");
  return payload;
}

async function loadPvpBattle(battleId: string): Promise<BattleResponse> {
  const response = await fetch(`/api/pvp/battles/${battleId}`, { cache: "no-store" });
  const payload = (await response.json()) as BattleResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "O duelo não pôde ser carregado.");
  return payload;
}

async function callPvpActionApi(body: Record<string, unknown>): Promise<BattleResponse> {
  const response = await fetch("/api/pvp/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as BattleResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "A ação PVP não pôde ser confirmada.");
  return payload;
}

export function BattleArena({
  open,
  onClose,
  onVictory,
  pvp,
  encounter,
  playerEnergy,
  battleBoard = "cartographer",
  playerAvatar,
}: {
  open: boolean;
  onClose: () => void;
  onVictory: (reward?: BattleReward) => void;
  pvp?: PvpSession;
  encounter?: BattleEncounter;
  playerEnergy?: EnergyPool;
  battleBoard?: BattleBoardId;
  playerAvatar?: AvatarConfig;
}) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<number | null>(null);
  const [serverBattleBoard, setServerBattleBoard] = useState<BattleBoardId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [die, setDie] = useState<number | null>(null);
  const [effect, setEffect] = useState<string | null>(null);
  const [presentationEvent, setPresentationEvent] = useState<BattlePresentationEvent | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState<"normal" | "fast" | "very-fast">("normal");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [turnBannerVisible, setTurnBannerVisible] = useState(false);
  const [pendingSwitchIndex, setPendingSwitchIndex] = useState<number | null>(null);
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
  const [reward, setReward] = useState<BattleReward | null>(null);
  const victoryReported = useRef(false);
  const pvpBattleId = pvp?.battleId ?? null;

  const startBattle = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = pvp
        ? await loadPvpBattle(pvp.battleId)
        : await callBattleApi({ action: "start", encounter, playerEnergy });
      setBattle(response.state);
      setToken(response.token ?? null);
      setServerVersion(response.version ?? null);
      setServerBattleBoard(response.boardId ?? null);
      setReward(response.reward ?? null);
      setPendingSwitchIndex(null);
      victoryReported.current = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a batalha.");
    } finally {
      setBusy(false);
    }
  }, [encounter, playerEnergy, pvp]);

  useEffect(() => {
    if (!open || battle || busy) return;
    const timer = window.setTimeout(() => void startBattle(), 0);
    return () => window.clearTimeout(timer);
  }, [battle, busy, open, startBattle]);

  useEffect(() => {
    if (!open || !pvpBattleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let removeChannel: (() => void) | null = null;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      const channel = supabase
        .channel(`pvp:battle:${pvpBattleId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => void startBattle())
        .subscribe();
      removeChannel = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [open, pvpBattleId, startBattle]);

  useEffect(() => {
    if (!open || !pvp || !battle || battle.status !== "active" || battle.turn.sideId === pvp.playerId) return;
    const timer = window.setInterval(() => void startBattle(), 5000);
    return () => window.clearInterval(timer);
  }, [battle, open, pvp, startBattle]);

  const perform = useCallback(
    async (payload: Record<string, unknown>) => {
      if ((!pvp && !token) || (pvp && serverVersion === null) || busy) return;
      if (soundEnabled) unlockBattleAudio();
      setBusy(true);
      setError("");
      setPendingSwitchIndex(null);
      setSelectedAttackId(null);
      try {
        const response = pvp
          ? await callPvpActionApi({
            ...payload,
            battleId: pvp.battleId,
            expectedVersion: serverVersion,
          })
          : await callBattleApi({ ...payload, token });

        const sequence = toBattlePresentationEvents(response.events);
        for (const event of sequence) {
          setPresentationEvent(event);
          if (soundEnabled) playBattleSfx(event.kind);
          if (typeof event.die === "number") setDie(event.die);

          if (["attack", "miss", "critical"].includes(event.kind)) {
            const attackingSide = battle?.sides.find((side) => side.id === event.actorId);
            const active = attackingSide ? getActive(attackingSide) : null;
            const definition = active ? CREATURE_BY_ID.get(active.catalogId) : null;
            const attackAnimation = definition?.attacks.find((attack) => attack.id === event.attackId)?.animation;
            setEffect(event.kind === "miss" ? "miss" : attackAnimation ?? "strike");

            const duration = presentationDuration(event.kind, animationSpeed);
            await new Promise((resolve) => window.setTimeout(resolve, Math.round(duration * 0.42)));
            setBattle(response.state);
            await new Promise((resolve) => window.setTimeout(resolve, Math.round(duration * 0.58)));
            setDie(null);
            setEffect(null);
            continue;
          }

          if (event.kind === "ko" || event.kind === "switch" || event.kind === "forcedSwitch") {
            setBattle(response.state);
          }

          await new Promise((resolve) =>
            window.setTimeout(resolve, presentationDuration(event.kind, animationSpeed)),
          );
          if (event.kind === "roll") setDie(null);
        }

        setBattle(response.state);
        setPresentationEvent(null);
        setDie(null);
        setEffect(null);
        setToken(response.token ?? null);
        setServerVersion(response.version ?? null);
        if (response.boardId) setServerBattleBoard(response.boardId);
        if (response.reward) setReward(response.reward);
      } catch (caught) {
        setPresentationEvent(null);
        setDie(null);
        setEffect(null);
        setError(caught instanceof Error ? caught.message : "A ação falhou.");
      } finally {
        setBusy(false);
      }
    },
    [animationSpeed, battle, busy, pvp, serverVersion, soundEnabled, token],
  );

  useEffect(() => {
    const playerId = pvp?.playerId ?? "player-one";
    if (battle?.status === "finished" && battle.winnerId === playerId && !victoryReported.current) {
      victoryReported.current = true;
      onVictory(reward ?? undefined);
    }
  }, [battle, onVictory, pvp?.playerId, reward]);

  const data = useMemo(() => {
    if (!battle) return null;
    const playerId = pvp?.playerId ?? "player-one";
    const player = getSide(battle, playerId);
    const opponent = battle.sides.find((side) => side.id !== playerId)!;
    const playerActive = getActive(player);
    const opponentActive = getActive(opponent);
    return {
      player,
      opponent,
      playerActive,
      opponentActive,
      playerDefinition: CREATURE_BY_ID.get(playerActive.catalogId)!,
      opponentDefinition: CREATURE_BY_ID.get(opponentActive.catalogId)!,
    };
  }, [battle, pvp?.playerId]);

  useEffect(() => {
    if (!battle || battle.status !== "active") return;
    setTurnBannerVisible(true);
    const timer = window.setTimeout(() => setTurnBannerVisible(false), 1100);
    return () => window.clearTimeout(timer);
  }, [battle?.status, battle?.turn.number, battle?.turn.sideId]);

  if (!open) return null;

  if (!battle || !data) {
    return (
      <div className="battle-screen battle-screen--loading">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <strong>Preparando a batalha...</strong>
        {error ? <p>{error}</p> : null}
        {error ? <Button onClick={startBattle}>Tentar novamente</Button> : null}
      </div>
    );
  }

  const effectiveBattleBoard = pvp ? serverBattleBoard ?? battleBoard : battleBoard;
  const playerTurn = battle.turn.sideId === data.player.id && battle.status === "active";
  const mainPhase = playerTurn && battle.turn.phase === "main";
  const forcedSwitch = playerTurn && battle.turn.phase === "forced_switch";
  const attachedPool = energyPoolFor(data.playerActive.attachedEnergy);
  const pendingSwitch = pendingSwitchIndex === null ? null : data.player.team[pendingSwitchIndex];
  const pendingSwitchDefinition = pendingSwitch
    ? CREATURE_BY_ID.get(pendingSwitch.catalogId) ?? null
    : null;
  const selectedAttack = selectedAttackId
    ? data.playerDefinition.attacks.find((attack) => attack.id === selectedAttackId) ?? null
    : null;
  const playerIsActor = presentationEvent?.actorId === data.player.id;
  const opponentIsActor = presentationEvent?.actorId === data.opponent.id;
  const cinematic = Boolean(presentationEvent && (
    ["attack", "critical", "miss", "ko", "switch"].includes(presentationEvent.kind)
  ));
  const playerHit = Boolean(
    presentationEvent
    && opponentIsActor
    && ["attack", "critical"].includes(presentationEvent.kind),
  );
  const opponentHit = Boolean(
    presentationEvent
    && playerIsActor
    && ["attack", "critical"].includes(presentationEvent.kind),
  );
  return (
    <div className="battle-screen">
      <header className="battle-topbar">
        <div>
          <span className="battle-eyebrow">{
            pvp
              ? "Duelo entre cartógrafos"
              : battle.mode === "wild"
                ? "Encontro selvagem"
                : battle.mode === "boss"
                  ? "Confronto de guardião"
                  : battle.mode === "sanctuary"
                    ? "Provação de santuário"
                    : "Duelo de viajante"
          }</span>
          <strong>Rodada {battle.turn.round}</strong>
        </div>
        <div className="battle-turn">
          <span className={cn("battle-turn__dot", playerTurn && "battle-turn__dot--active")} />
          {battle.status === "finished"
            ? "Batalha concluída"
            : playerTurn
              ? forcedSwitch
                ? "Escolha a próxima criatura"
                : "Seu turno"
              : `Turno de ${data.opponent.name}`}
        </div>
        <button
          type="button"
          className={cn("battle-sound-toggle", soundEnabled && "is-active")}
          onClick={() => {
            setSoundEnabled((current) => !current);
            unlockBattleAudio();
          }}
          aria-label={soundEnabled ? "Desativar sons da batalha" : "Ativar sons da batalha"}
        >
          {soundEnabled ? <Volume2 /> : <VolumeX />}
        </button>
        <div className="battle-speed" aria-label="Velocidade das animações">
          {(["normal", "fast", "very-fast"] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              className={cn(animationSpeed === speed && "is-active")}
              onClick={() => setAnimationSpeed(speed)}
              disabled={busy}
            >
              {speed === "normal" ? "1×" : speed === "fast" ? "1.6×" : "2.6×"}
            </button>
          ))}
        </div>
        <button type="button" className="battle-close" onClick={onClose} aria-label="Sair da batalha">
          <X />
        </button>
      </header>

      <section className="card-table" aria-label="Mesa de batalha de cartas">
        <BattleBoardScene boardId={effectiveBattleBoard} cinematic={cinematic}>
        <div className="card-table__felt">
          <div
            className={cn(
              "battle-avatar battle-avatar--opponent",
              opponentIsActor && presentationEvent?.kind === "energy" && "is-playing-card",
              opponentIsActor && ["attack", "critical"].includes(presentationEvent?.kind ?? "") && "is-commanding",
              opponentHit && "is-reacting",
            )}
            aria-label={`Cartógrafo de ${data.opponent.name}`}
          >
            <CharacterAvatar2D compact />
            <span>{data.opponent.name}</span>
          </div>
          <div
            className={cn(
              "battle-avatar battle-avatar--player",
              playerIsActor && presentationEvent?.kind === "energy" && "is-playing-card",
              playerIsActor && ["attack", "critical"].includes(presentationEvent?.kind ?? "") && "is-commanding",
              playerHit && "is-reacting",
            )}
            aria-label="Seu Cartógrafo"
          >
            <CharacterAvatar2D config={playerAvatar} compact />
            <span>Você</span>
          </div>
          <AnimatePresence mode="wait">
            {turnBannerVisible ? (
              <motion.div
                key={`${battle.turn.number}:${battle.turn.sideId}`}
                className={cn("battle-turn-banner", playerTurn && "is-player")}
                initial={{ opacity: 0, scaleX: .72, y: -8 }}
                animate={{ opacity: 1, scaleX: 1, y: 0 }}
                exit={{ opacity: 0, scaleX: 1.08, y: 8 }}
                transition={{ duration: .24 }}
              >
                <span>{playerTurn ? "SUA VEZ" : `VEZ DE ${data.opponent.name.toUpperCase()}`}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="card-table__resource-row card-table__resource-row--opponent">
            <div className="table-pile tcg-zone tcg-zone--deck" data-zone="Baralho">
              <span className="table-card-back">CR</span>
              <small>{data.opponent.energyDeck.length || "?"} no baralho</small>
            </div>
            <div className="table-hidden-hand tcg-zone tcg-zone--hand" data-zone="Mão adversária" aria-label="Mão do adversário oculta">
              {Array.from({ length: Math.min(5, data.opponent.energyHand.length || 5) }, (_, index) => (
                <span className="table-card-back" style={{ "--card-index": index } as React.CSSProperties} key={`opponent-card-${index}`}>CR</span>
              ))}
            </div>
            <div className="table-discard tcg-zone tcg-zone--discard" data-zone="Descarte">
              <span>{data.opponent.energyDiscard.length}</span>
              <small>descarte</small>
            </div>
          </div>

          <div className="card-table__side card-table__side--opponent">
            <div className="table-bench tcg-zone tcg-zone--bench" data-zone="Banco adversário" aria-label="Banco do adversário">
              {data.opponent.team.map((card, index) => {
                if (index === data.opponent.activeIndex) return null;
                const definition = CREATURE_BY_ID.get(card.catalogId)!;
                return (
                  <article className={cn("bench-card", card.defeated && "is-defeated")} key={card.instanceId}>
                    <PixelCreature sprite={definition.sprite} label={definition.name} mirrored />
                    <span>{definition.name}</span>
                    <small>{card.hp}/{card.maxHp} PV</small>
                  </article>
                );
              })}
            </div>
            <div className={cn(
              "table-active-zone table-active-zone--opponent tcg-zone tcg-zone--active",
              opponentHit && "is-under-impact",
            )} data-zone="Criatura ativa">
              <span>Carta ativa de {data.opponent.name}</span>
              <BattleActiveCreature
                definition={data.opponentDefinition}
                battle={data.opponentActive}
                sideId={data.opponent.id}
                presentationEvent={presentationEvent}
                mirrored
              />
            </div>
          </div>

          <div className="card-table__centerline">
            <span>{battle.turn.number}</span>
            <div>
              <strong>{playerTurn ? "Sua jogada" : "Jogada adversária"}</strong>
              <small>{forcedSwitch ? "Escolha uma carta do banco" : `Rodada ${battle.turn.round}`}</small>
            </div>
            <Swords />
          </div>

          <div className="card-table__side card-table__side--player">
            <div className={cn(
              "table-active-zone table-active-zone--player tcg-zone tcg-zone--active",
              playerHit && "is-under-impact",
            )} data-zone="Criatura ativa">
              <span>Sua carta ativa</span>
              <BattleActiveCreature
                definition={data.playerDefinition}
                battle={data.playerActive}
                sideId={data.player.id}
                presentationEvent={presentationEvent}
              />
            </div>
            <div className="table-bench tcg-zone tcg-zone--bench" data-zone="Seu banco" aria-label="Seu banco de cartas">
              {data.player.team.map((card, index) => {
                if (index === data.player.activeIndex) return null;
                const definition = CREATURE_BY_ID.get(card.catalogId)!;
                return (
                  <button
                    type="button"
                    className={cn(
                      "bench-card",
                      card.defeated && "is-defeated",
                      pendingSwitchIndex === index && "is-selected",
                    )}
                    key={card.instanceId}
                    disabled={!playerTurn || busy || card.defeated}
                    onClick={() => setPendingSwitchIndex(index)}
                  >
                    <PixelCreature sprite={definition.sprite} label={definition.name} />
                    <span>{definition.name}</span>
                    <small>{card.hp}/{card.maxHp} PV · {card.attachedEnergy.length} EN</small>
                  </button>
                );
              })}
              {data.player.team.length === 1 ? (
                <div className="bench-card bench-card--empty">
                  <span>Banco vazio</span>
                  <small>Ganhe cartas em batalhas e baús</small>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card-table__resource-row card-table__resource-row--player">
            <div className="table-pile tcg-zone tcg-zone--deck" data-zone="Baralho">
              <span className="table-card-back">CR</span>
              <small>{data.player.energyDeck.length} no baralho</small>
            </div>
            <div className="table-zone-label">
              <strong>{data.player.team.length}/6 cartas</strong>
              <small>{forcedSwitch ? "Troca obrigatória" : "Banco da equipe"}</small>
            </div>
            <div className="table-discard tcg-zone tcg-zone--discard" data-zone="Descarte">
              <span>{data.player.energyDiscard.length}</span>
              <small>descarte</small>
            </div>
          </div>
        </div>
        </BattleBoardScene>

        <AnimatePresence>
          {effect ? (
            <motion.div
              key={effect}
              className={`attack-effect attack-effect--${effect}`}
              initial={{ opacity: 0, scale: 0.3, x: "-35%" }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 0.8], x: ["-35%", "30%", "42%"] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
            >
              <Sparkles />
            </motion.div>
          ) : null}
          {die ? (
            <motion.div
              className={cn("dice-result", die === 1 && "dice-result--miss", die === 6 && "dice-result--critical")}
              initial={{ rotate: -520, scale: 0.1, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 13 }}
            >
              <Dice5 />
              <strong>{die}</strong>
              <span>{die === 1 ? "Falha crítica" : die === 6 ? "Acerto crítico" : "Ataque certeiro"}</span>
            </motion.div>
          ) : null}
          {presentationEvent?.kind === "energy" ? (
            <motion.div
              key={presentationEvent.id}
              className={cn("battle-energy-flight", presentationEvent.actorId === data.opponent.id && "is-opponent")}
              initial={{ opacity: 0, y: 120, x: presentationEvent.actorId === data.opponent.id ? 160 : -160, scale: .7, rotate: -12 }}
              animate={{ opacity: [0, 1, 1, 0], y: [120, 20, -45], x: [presentationEvent.actorId === data.opponent.id ? 160 : -160, 0, 0], scale: [.7, 1.05, .5], rotate: [-12, 6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: .52 }}
            >
              <Sparkles />
              <strong>ENERGIA</strong>
            </motion.div>
          ) : null}
          {presentationEvent?.kind === "draw" ? (
            <motion.div
              key={presentationEvent.id}
              className="battle-draw-flight"
              initial={{ opacity: 0, x: -180, y: 70, rotate: -18 }}
              animate={{ opacity: [0, 1, 1], x: [-180, -20, 150], y: [70, 10, 80], rotate: [-18, 4, 12] }}
              exit={{ opacity: 0 }}
              transition={{ duration: .46 }}
            >
              <span>CR</span>
            </motion.div>
          ) : null}
          {presentationEvent && ["miss", "critical", "ko"].includes(presentationEvent.kind) ? (
            <motion.div
              key={`${presentationEvent.id}:callout`}
              className={cn("battle-impact-callout", `is-${presentationEvent.kind}`)}
              initial={{ opacity: 0, scale: .55 }}
              animate={{ opacity: 1, scale: [1.25, 1] }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: .2 }}
            >
              {presentationEvent.kind === "miss" ? "FALHOU!" : presentationEvent.kind === "critical" ? "CRÍTICO!" : "NOCAUTE!"}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {pendingSwitchDefinition && pendingSwitchIndex !== null ? (
          <motion.div
            className="switch-confirmation"
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <ArrowRightLeft />
            <div>
              <strong>Colocar {pendingSwitchDefinition.name} em campo?</strong>
              <span>
                {forcedSwitch
                  ? "Esta substituição é obrigatória; depois dela, seu turno continua."
                  : `A troca usa sua ação principal e passa o turno para ${data.opponent.name}.`}
              </span>
            </div>
            <Button
              type="button"
              variant="game"
              size="sm"
              disabled={!playerTurn || busy}
              onClick={() =>
                void perform({
                  action: "switch",
                  creatureIndex: pendingSwitchIndex,
                  actionId: actionId(),
                })
              }
            >
              Confirmar troca
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setPendingSwitchIndex(null)}
            >
              Cancelar
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section className="battle-controls">
        <div className="energy-tray">
          <div className="battle-section-title">
            <span>Mão de energia</span>
            <small>
              {data.player.energyHand.length} na mão · {data.player.energyDeck.length} no baralho · {data.player.attachmentsRemaining} anexos restantes
            </small>
          </div>
          <div className="energy-tray__rail">
            {data.player.energyHand.map((card) => {
              const meta = ELEMENT_META[card.element];
              return (
                <div className="energy-card" key={card.id} style={{ "--energy": meta.color } as React.CSSProperties}>
                  <span className="energy-card__sigil">{meta.short}</span>
                  <strong>{meta.name}</strong>
                  <span>Carta de energia</span>
                  <span>Na ativa {attachedPool[card.element]}</span>
                  <div className="energy-card__actions">
                    <button
                      type="button"
                      disabled={!mainPhase || busy || data.player.attachmentsRemaining < 1}
                      onClick={() => void perform({ action: "attach", creatureIndex: data.player.activeIndex, cardId: card.id, actionId: actionId() })}
                    >
                      Anexar à ativa
                    </button>
                  </div>
                </div>
              );
            })}
            {data.player.energyHand.length === 0 ? (
              <p className="energy-tray__empty">Sua mão está vazia. Encerre o turno para comprar novas cartas.</p>
            ) : null}
          </div>
        </div>

        <div className="attack-panel">
          <div className="battle-section-title">
            <span>Ataques de {data.playerDefinition.name}</span>
            <small>O servidor sorteia o dado após a confirmação</small>
          </div>
          <div className="attack-list">
            {data.playerDefinition.attacks.map((attack) => {
              const affordable = canPayCost(data.playerActive.attachedEnergy, attack.cost);
              const chance = Math.round(((7 - attack.minRoll) / 6) * 100);
              return (
                <button
                  key={attack.id}
                  type="button"
                  className={cn("attack-button", selectedAttackId === attack.id && "is-selected")}
                  disabled={!mainPhase || busy || !affordable || data.playerActive.defeated}
                  onClick={() => setSelectedAttackId(attack.id)}
                >
                  <span className="attack-button__icon"><Swords /></span>
                  <span>
                    <strong>{attack.name}</strong>
                    <small>
                      {Object.entries(attack.cost).map(([element, amount]) => `${amount} ${ELEMENT_META[element as Element].short}`).join(" · ")}
                    </small>
                  </span>
                  <span className="attack-button__stats">
                    <strong>{attack.damage}</strong>
                    <small>{chance}%</small>
                  </span>
                  <ChevronRight />
                </button>
              );
            })}
            {selectedAttack ? (
              <motion.div
                className="attack-preview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="attack-preview__heading">
                  <span>PREVIEW DO ATAQUE</span>
                  <strong>{selectedAttack.name}</strong>
                </div>
                <div className="attack-preview__stats">
                  <span><small>Dano base</small><strong>{selectedAttack.damage}</strong></span>
                  <span><small>Precisão</small><strong>D6 {selectedAttack.minRoll}+</strong></span>
                  <span>
                    <small>Custo</small>
                    <strong>{Object.entries(selectedAttack.cost).map(([element, amount]) => `${amount} ${ELEMENT_META[element as Element].short}`).join(" · ")}</strong>
                  </span>
                  <span>
                    <small>Efeito</small>
                    <strong>{selectedAttack.effect?.type ?? "Dano direto"}</strong>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="game"
                  disabled={!mainPhase || busy || !canPayCost(data.playerActive.attachedEnergy, selectedAttack.cost)}
                  onClick={() => void perform({ action: "attack", attackId: selectedAttack.id, actionId: actionId() })}
                >
                  <Swords /> ATACAR
                </Button>
              </motion.div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={!mainPhase || busy}
              onClick={() => void perform({ action: "pass", actionId: actionId() })}
            >
              <SkipForward /> Encerrar turno sem atacar
            </Button>
          </div>
        </div>
      </section>

      <aside className="battle-log">
        <div className="battle-section-title">
          <span>Crônica da batalha</span>
          <ShieldCheck />
        </div>
        <div className="battle-log__entries">
          {battle.log.slice(-5).reverse().map((entry) => (
            <p key={entry.id}>
              {entry.die ? <strong>D{entry.die}</strong> : null} {entry.message}
            </p>
          ))}
        </div>
      </aside>

      {error ? <div className="battle-error">{error}</div> : null}
      {busy ? <div className="battle-busy"><LoaderCircle className="animate-spin" /> Validando ação...</div> : null}

      {battle.status === "finished" ? (
        <div className="battle-victory">
          <div className="battle-victory__mark"><Flame /></div>
          <span>{pvp ? "Duelo concluído" : "Provação concluída"}</span>
          <h2>{battle.winnerId === data.player.id ? "Sua equipe venceu" : `${data.opponent.name} venceu o duelo`}</h2>
          <p>
            {pvp
              ? "O resultado foi confirmado no histórico do servidor. Recompensas competitivas permanecem desativadas nesta fase."
              : battle.winnerId === data.player.id
                ? "Você conquistou 120 moedas, experiência e um fragmento de vínculo."
                : "Revise suas energias, troque a carta ativa e tente novamente."}
          </p>
          {reward?.creatureId && CREATURE_BY_ID.get(reward.creatureId) ? (
            <div className="battle-reward-card">
              <span>Nova carta conquistada</span>
              <CreatureCard creature={CREATURE_BY_ID.get(reward.creatureId)!} compact />
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="game" size="lg" onClick={onClose}>
              Voltar ao mapa
            </Button>
            {!pvp ? (
              <Button variant="secondary" size="lg" onClick={startBattle}>
                <RotateCcw /> Nova batalha
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

