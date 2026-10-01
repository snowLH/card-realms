"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRightLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dice5,
  Flame,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Swords,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import type { BattleBoardId } from "@/game/battle/presentation";
import type { AvatarConfig } from "@/game/save/local-progress";
import { canEvolveActiveCreature, canPayCost, energyPoolFor, getActive, getAttackById, getSide } from "@/game/engine";
import { presentationDuration, toBattlePresentationEvents, type BattlePresentationEvent } from "@/game/battle/presentation-events";
import { playBattleSfx, startBattleMusic, stopBattleMusic, unlockBattleAudio } from "@/game/battle/audio";
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
  const [visualQuality, setVisualQuality] = useState<"high" | "medium" | "low">("high");
  const [logOpen, setLogOpen] = useState(false);
  const [turnBannerVisible, setTurnBannerVisible] = useState(false);
  const [pendingSwitchIndex, setPendingSwitchIndex] = useState<number | null>(null);
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
  const [commandPanel, setCommandPanel] = useState<"menu" | "attack" | "cards" | "team">("menu");
  const [selectedPowerCardId, setSelectedPowerCardId] = useState<string | null>(null);
  const [powerTargetIndex, setPowerTargetIndex] = useState<number | null>(null);
  const [selectedEnergyCardId, setSelectedEnergyCardId] = useState<string | null>(null);
  const [energyTargetIndex, setEnergyTargetIndex] = useState<number | null>(null);
  const [concedeConfirm, setConcedeConfirm] = useState(false);
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
    if (!open) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof navigator === "undefined") return;
    const hardware = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    setVisualQuality(hardware <= 4 || memory <= 4 ? "low" : hardware <= 8 || memory <= 8 ? "medium" : "high");
  }, [open]);

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
      if (soundEnabled) {
        unlockBattleAudio();
        startBattleMusic(pvp ? serverBattleBoard ?? battleBoard : battleBoard);
      }
      setBusy(true);
      setError("");
      setPendingSwitchIndex(null);
      setSelectedAttackId(null);
      setSelectedPowerCardId(null);
      setPowerTargetIndex(null);
      setSelectedEnergyCardId(null);
      setEnergyTargetIndex(null);
      setConcedeConfirm(false);
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
            const attackAnimation = event.attackId ? getAttackById(event.attackId)?.animation : undefined;
            setEffect(event.kind === "miss" ? "miss" : attackAnimation ?? "strike");

            const duration = presentationDuration(event.kind, animationSpeed);
            await new Promise((resolve) => window.setTimeout(resolve, Math.round(duration * 0.42)));
            setBattle(response.state);
            await new Promise((resolve) => window.setTimeout(resolve, Math.round(duration * 0.58)));
            setDie(null);
            setEffect(null);
            continue;
          }

          if (
            event.kind === "ko"
            || event.kind === "switch"
            || event.kind === "forcedSwitch"
            || event.kind === "evolutionComplete"
            || event.kind === "terrainOn"
            || event.kind === "terrainOff"
          ) {
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
    [animationSpeed, battle, battleBoard, busy, pvp, serverBattleBoard, serverVersion, soundEnabled, token],
  );

  useEffect(() => {
    if (!open || !soundEnabled) {
      stopBattleMusic();
      return;
    }
    return () => stopBattleMusic();
  }, [open, soundEnabled]);

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
  const canEvolve = canEvolveActiveCreature(battle, data.player.id);
  const evolutionElement = data.playerDefinition.element;
  const terrain = battle.terrain;
  const terrainMeta = terrain ? ELEMENT_META[terrain.element] : null;
  const pendingSwitch = pendingSwitchIndex === null ? null : data.player.team[pendingSwitchIndex];
  const pendingSwitchDefinition = pendingSwitch
    ? CREATURE_BY_ID.get(pendingSwitch.catalogId) ?? null
    : null;
  const equippedAttackIds = data.playerActive.equippedPowerIds.length > 0
    ? data.playerActive.equippedPowerIds
    : [data.playerDefinition.attacks[0].id];
  const equippedAttacks = equippedAttackIds
    .map((attackId) => getAttackById(attackId))
    .filter((attack): attack is NonNullable<typeof attack> => Boolean(attack));
  const selectedAttack = selectedAttackId
    ? getAttackById(selectedAttackId)
    : null;
  const selectedPowerCard = selectedPowerCardId
    ? data.player.powerHand.find((card) => card.id === selectedPowerCardId) ?? null
    : null;
  const selectedPowerAttack = selectedPowerCard ? getAttackById(selectedPowerCard.attackId) : null;
  const powerTarget = powerTargetIndex === null ? null : data.player.team[powerTargetIndex] ?? null;
  const powerTargetDefinition = powerTarget ? CREATURE_BY_ID.get(powerTarget.catalogId) ?? null : null;
  const selectedEnergyCard = selectedEnergyCardId
    ? data.player.energyHand.find((card) => card.id === selectedEnergyCardId) ?? null
    : null;
  const energyTarget = energyTargetIndex === null ? null : data.player.team[energyTargetIndex] ?? null;
  const energyTargetDefinition = energyTarget ? CREATURE_BY_ID.get(energyTarget.catalogId) ?? null : null;
  const latestBattleMessage = presentationEvent?.message ?? battle.log.at(-1)?.message;
  const dialogueMessage = forcedSwitch
    ? "Escolha sua próxima criatura."
    : presentationEvent
      ? presentationEvent.message
      : playerTurn
        ? `O que ${data.playerDefinition.name} fará?`
        : latestBattleMessage ?? `Vez de ${data.opponent.name}.`;
  const playerIsActor = presentationEvent?.actorId === data.player.id;
  const opponentIsActor = presentationEvent?.actorId === data.opponent.id;
  const cinematic = Boolean(presentationEvent && (
    ["attack", "critical", "miss", "ko", "switch", "evolutionStart", "evolutionComplete", "terrainOn"].includes(presentationEvent.kind)
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
    <div className={cn("battle-screen", `battle-quality--${visualQuality}`)}>
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
            setSoundEnabled((current) => {
              const next = !current;
              if (next) {
                unlockBattleAudio();
                startBattleMusic(effectiveBattleBoard);
              } else {
                stopBattleMusic();
              }
              return next;
            });
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
        <button type="button" className="battle-close" onClick={() => { stopBattleMusic(); onClose(); }} aria-label="Sair da batalha">
          <X />
        </button>
      </header>

      <section className="card-table" aria-label="Mesa de batalha de cartas">
        <BattleBoardScene
          boardId={effectiveBattleBoard}
          cinematic={cinematic}
          terrainElement={terrain?.element}
        >
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

          <div className="classic-battle-status classic-battle-status--opponent">
            <div className="classic-battle-status__heading">
              <strong>{data.opponentDefinition.name}</strong>
              <span>{ELEMENT_META[data.opponentDefinition.element].name} · Estágio {(data.opponentActive.evolutionStage ?? 0) + 1}</span>
            </div>
            <div className="classic-battle-status__hp">
              <span>HP</span>
              <div><i style={{ width: `${Math.max(0, Math.min(100, (data.opponentActive.hp / data.opponentActive.maxHp) * 100))}%` }} /></div>
              <small>{data.opponentActive.hp}/{data.opponentActive.maxHp}</small>
            </div>
            <div className="classic-battle-status__meta">
              <span className="classic-energy-stack">
                {data.opponentActive.attachedEnergy.slice(0, 5).map((card) => (
                  <i key={card.id} title={`Energia de ${ELEMENT_META[card.element].name}`}>
                    {ELEMENT_META[card.element].short}
                  </i>
                ))}
              </span>
              <span>{data.opponentActive.statuses.length > 0 ? data.opponentActive.statuses.map((status) => status.effect).join(" · ") : "Normal"}</span>
            </div>
          </div>

          <div className="classic-battle-status classic-battle-status--player">
            <div className="classic-battle-status__heading">
              <strong>{data.playerDefinition.name}</strong>
              <span>{ELEMENT_META[data.playerDefinition.element].name} · Estágio {(data.playerActive.evolutionStage ?? 0) + 1}</span>
            </div>
            <div className="classic-battle-status__hp">
              <span>HP</span>
              <div><i style={{ width: `${Math.max(0, Math.min(100, (data.playerActive.hp / data.playerActive.maxHp) * 100))}%` }} /></div>
              <small>{data.playerActive.hp}/{data.playerActive.maxHp}</small>
            </div>
            <div className="classic-battle-status__meta">
              <span className="classic-energy-stack">
                {data.playerActive.attachedEnergy.map((card) => (
                  <i key={card.id} title={`Energia de ${ELEMENT_META[card.element].name}`}>
                    {ELEMENT_META[card.element].short}
                  </i>
                ))}
              </span>
              <span>{data.playerActive.statuses.length > 0 ? data.playerActive.statuses.map((status) => status.effect).join(" · ") : "Normal"}</span>
            </div>
          </div>

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

          {terrain && terrainMeta ? (
            <motion.div
              className={cn("battle-terrain-status", `is-${terrain.element}`)}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Sparkles />
              <span>
                <strong>Terreno de {terrainMeta.name}</strong>
                <small>
                  +15% de dano para criaturas de {terrainMeta.name} · até o turno {terrain.expiresAfterTurn}
                </small>
              </span>
            </motion.div>
          ) : null}

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
          {presentationEvent && ["evolutionStart", "evolutionComplete"].includes(presentationEvent.kind) ? (
            <motion.div
              key={`${presentationEvent.id}:evolution`}
              className={cn("battle-evolution-overlay", presentationEvent.kind === "evolutionComplete" && "is-complete")}
              initial={{ opacity: 0, scale: .7, rotate: -4 }}
              animate={{ opacity: 1, scale: [1.08, 1], rotate: 0 }}
              exit={{ opacity: 0, scale: 1.12 }}
            >
              <div className="battle-evolution-overlay__card battle-evolution-overlay__card--base">
                <PixelCreature sprite={data.playerDefinition.sprite} label={data.playerDefinition.name} />
                <strong>{data.playerDefinition.name}</strong>
              </div>
              <Sparkles />
              <div className="battle-evolution-overlay__card battle-evolution-overlay__card--evolved">
                <PixelCreature sprite={data.playerDefinition.sprite} label={`${data.playerDefinition.name} evoluído`} evolved />
                <strong>{data.playerDefinition.name} · Vínculo I</strong>
              </div>
              <span>{presentationEvent.kind === "evolutionComplete" ? "EVOLUÇÃO COMPLETA!" : "EVOLUINDO..."}</span>
            </motion.div>
          ) : null}
          {presentationEvent?.kind === "terrainOn" && presentationEvent.terrainElement ? (
            <motion.div
              key={`${presentationEvent.id}:terrain`}
              className={cn("battle-terrain-callout", `is-${presentationEvent.terrainElement}`)}
              initial={{ opacity: 0, scale: .6 }}
              animate={{ opacity: 1, scale: [1.15, 1] }}
              exit={{ opacity: 0 }}
            >
              <Sparkles />
              <strong>TERRENO: {ELEMENT_META[presentationEvent.terrainElement].name.toUpperCase()}</strong>
              <small>O campo inteiro foi transformado.</small>
            </motion.div>
          ) : null}
          {presentationEvent?.kind === "terrainOff" ? (
            <motion.div
              key={`${presentationEvent.id}:terrain-off`}
              className="battle-terrain-callout is-off"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <strong>TERRENO DISSIPADO</strong>
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

      <section className="battle-controls hybrid-battle-controls">
        <div className="hybrid-command-menu">
          <button type="button" className={cn(commandPanel === "attack" && "is-active")} onClick={() => setCommandPanel("attack")}>
            <Swords /><span>ATACAR</span>
          </button>
          <button type="button" className={cn(commandPanel === "cards" && "is-active")} onClick={() => setCommandPanel("cards")}>
            <BookOpen /><span>CARTAS</span>
          </button>
          <button type="button" className={cn(commandPanel === "team" && "is-active")} onClick={() => setCommandPanel("team")}>
            <Users /><span>EQUIPE</span>
          </button>
          <button type="button" className={cn(commandPanel === "item" && "is-active")} onClick={() => setCommandPanel("item")}>
            <PackageOpen /><span>ITEM</span>
          </button>
          <button
            type="button"
            className="is-flee"
            disabled={Boolean(pvp) || battle.mode === "boss"}
            onClick={() => { stopBattleMusic(); onClose(); }}
          >
            <X /><span>FUGIR</span>
          </button>
        </div>

        <div className="hybrid-command-panel">
          {commandPanel === "menu" ? (
            <div className="hybrid-command-empty">
              <strong>O que {data.playerDefinition.name} deve fazer?</strong>
              <span>Escolha uma ação abaixo. A criatura ativa luta fora da carta; as cartas organizam equipe e poderes.</span>
            </div>
          ) : null}

          {commandPanel === "attack" ? (
            <div className="hybrid-attack-panel">
              <div className="battle-section-title">
                <span>Poderes de {data.playerDefinition.name}</span>
                <small>{equippedAttacks.length}/4 equipados · {data.playerActive.attachedEnergy.length} Energia</small>
              </div>
              <div className="hybrid-power-slots">
                {equippedAttacks.map((attack, index) => {
                  const affordable = canPayCost(data.playerActive.attachedEnergy, attack.cost);
                  const chance = Math.round(((7 - attack.minRoll) / 6) * 100);
                  return (
                    <button
                      key={attack.id}
                      type="button"
                      className={cn("hybrid-power-slot", selectedAttackId === attack.id && "is-selected")}
                      disabled={!mainPhase || busy || !affordable || data.playerActive.defeated}
                      onClick={() => setSelectedAttackId(attack.id)}
                    >
                      <span className="hybrid-power-slot__number">{index + 1}</span>
                      <span>
                        <strong>{attack.name}</strong>
                        <small>
                          {attack.damage} dano · D6 {attack.minRoll}+ · {chance}%
                        </small>
                      </span>
                      <span className="hybrid-power-slot__cost">
                        {Object.entries(attack.cost).map(([element, amount]) => `${amount} ${ELEMENT_META[element as Element].short}`).join(" · ")}
                      </span>
                    </button>
                  );
                })}
                {Array.from({ length: Math.max(0, 4 - equippedAttacks.length) }, (_, index) => (
                  <div className="hybrid-power-slot is-empty" key={`empty-power-${index}`}>
                    <span className="hybrid-power-slot__number">{equippedAttacks.length + index + 1}</span>
                    <span><strong>Espaço vazio</strong><small>Equipe uma Carta de Poder</small></span>
                  </div>
                ))}
              </div>
              {selectedAttack ? (
                <div className="hybrid-attack-confirm">
                  <div>
                    <strong>{selectedAttack.name}</strong>
                    <span>{selectedAttack.description}</span>
                  </div>
                  <Button
                    type="button"
                    variant="game"
                    disabled={!mainPhase || busy || !canPayCost(data.playerActive.attachedEnergy, selectedAttack.cost)}
                    onClick={() => void perform({ action: "attack", attackId: selectedAttack.id, actionId: actionId() })}
                  >
                    <Swords /> USAR PODER
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {commandPanel === "cards" ? (
            <div className="hybrid-cards-panel">
              <div className="power-deck-panel">
                <button
                  type="button"
                  className="power-deck-stack"
                  disabled={!mainPhase || busy || data.player.powerDrawsRemaining < 1}
                  onClick={() => void perform({ action: "draw_power", actionId: actionId() })}
                >
                  <span className="power-deck-card power-deck-card--back">PODER</span>
                  <span>
                    <strong>Baralho de Poder</strong>
                    <small>{data.player.powerDeck.length} cartas · {data.player.powerDrawsRemaining} compra neste turno</small>
                  </span>
                </button>
                <div className="power-hand-grid">
                  {data.player.powerHand.map((card) => {
                    const attack = getAttackById(card.attackId);
                    if (!attack) return null;
                    return (
                      <button
                        type="button"
                        key={card.id}
                        className={cn("power-hand-card", selectedPowerCardId === card.id && "is-selected")}
                        onClick={() => {
                          setSelectedPowerCardId(card.id);
                          setPowerTargetIndex(null);
                        }}
                      >
                        <span style={{ "--power-color": ELEMENT_META[card.element].color } as React.CSSProperties}>
                          {ELEMENT_META[card.element].short}
                        </span>
                        <strong>{attack.name}</strong>
                        <small>{attack.damage} dano · D6 {attack.minRoll}+</small>
                      </button>
                    );
                  })}
                  {data.player.powerHand.length === 0 ? <p>Nenhuma Carta de Poder na mão.</p> : null}
                </div>
              </div>

              {selectedPowerCard && selectedPowerAttack ? (
                <div className="power-equip-panel">
                  <div>
                    <span className="view-eyebrow">Equipar poder</span>
                    <strong>{selectedPowerAttack.name}</strong>
                    <small>Escolha uma criatura de {ELEMENT_META[selectedPowerCard.element].name}.</small>
                  </div>
                  <div className="power-equip-team">
                    {data.player.team.map((creature, index) => {
                      const definition = CREATURE_BY_ID.get(creature.catalogId)!;
                      const compatible = definition.element === selectedPowerCard.element && !creature.defeated;
                      return (
                        <button
                          type="button"
                          key={creature.instanceId}
                          disabled={!compatible}
                          className={cn(powerTargetIndex === index && "is-selected")}
                          onClick={() => setPowerTargetIndex(index)}
                        >
                          <PixelCreature sprite={definition.sprite} label={definition.name} />
                          <span>{definition.name}</span>
                          <small>{creature.equippedPowerIds.length}/4</small>
                        </button>
                      );
                    })}
                  </div>
                  {powerTarget && powerTargetDefinition ? (
                    <div className="power-equip-slots">
                      {powerTarget.equippedPowerIds.length < 4 ? (
                        <Button
                          type="button"
                          variant="game"
                          disabled={!mainPhase || busy}
                          onClick={() => void perform({
                            action: "equip_power",
                            creatureIndex: powerTargetIndex,
                            cardId: selectedPowerCard.id,
                            actionId: actionId(),
                          })}
                        >
                          Equipar em {powerTargetDefinition.name}
                        </Button>
                      ) : (
                        <>
                          <span>Escolha qual poder substituir:</span>
                          {powerTarget.equippedPowerIds.map((attackId, slot) => (
                            <button
                              type="button"
                              key={`${attackId}:${slot}`}
                              onClick={() => void perform({
                                action: "equip_power",
                                creatureIndex: powerTargetIndex,
                                cardId: selectedPowerCard.id,
                                slot,
                                actionId: actionId(),
                              })}
                            >
                              {slot + 1}. {getAttackById(attackId)?.name ?? "Poder"}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="compact-energy-panel">
                <div>
                  <strong>Energia</strong>
                  <small>{data.player.attachmentsRemaining} anexos restantes</small>
                </div>
                <div className="compact-energy-row">
                  {data.player.energyHand.map((card) => {
                    const meta = ELEMENT_META[card.element];
                    return (
                      <button
                        type="button"
                        key={card.id}
                        style={{ "--energy": meta.color } as React.CSSProperties}
                        disabled={!mainPhase || busy || data.player.attachmentsRemaining < 1}
                        onClick={() => void perform({ action: "attach", creatureIndex: data.player.activeIndex, cardId: card.id, actionId: actionId() })}
                      >
                        <span>{meta.short}</span>
                        <small>{meta.name}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {commandPanel === "team" ? (
            <div className="hybrid-team-panel">
              <div className="battle-section-title">
                <span>Equipe · {data.player.team.length}/6</span>
                <small>Escolha quem fica ativa e quem permanece no banco</small>
              </div>
              <div className="hybrid-team-grid">
                {data.player.team.map((creature, index) => {
                  const definition = CREATURE_BY_ID.get(creature.catalogId)!;
                  const active = index === data.player.activeIndex;
                  return (
                    <article className={cn("hybrid-team-card", active && "is-active", creature.defeated && "is-defeated")} key={creature.instanceId}>
                      <PixelCreature sprite={definition.sprite} label={definition.name} />
                      <div>
                        <strong>{definition.name}</strong>
                        <small>{creature.hp}/{creature.maxHp} HP · {creature.attachedEnergy.length} EN · {creature.equippedPowerIds.length}/4 poderes</small>
                      </div>
                      <span className="hybrid-team-card__state">{active ? "ATIVA" : "BANCO"}</span>
                      {!active ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!playerTurn || busy || creature.defeated}
                          onClick={() => setPendingSwitchIndex(index)}
                        >
                          Colocar ativa
                        </Button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {commandPanel === "item" ? (
            <div className="hybrid-item-panel">
              <div className="evolution-control">
                <div>
                  <span className="view-eyebrow">Evolução de Vínculo</span>
                  <strong>
                    {(data.playerActive.evolutionStage ?? 0) > 0
                      ? `${data.playerDefinition.name} já evoluiu`
                      : battle.turn.round < 2
                        ? "Disponível a partir da 2ª rodada"
                        : `Requer 2 Energias de ${ELEMENT_META[evolutionElement].name}`}
                  </strong>
                  <small>Evolução continua autoritativa e usa o estado real da batalha.</small>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canEvolve || busy}
                  onClick={() => void perform({ action: "evolve", actionId: actionId() })}
                >
                  <Sparkles /> EVOLUIR
                </Button>
              </div>
              <div className="hybrid-item-info">
                <strong>{terrainMeta ? `Terreno de ${terrainMeta.name}` : "Sem Terreno ativo"}</strong>
                <span>{terrainMeta ? "O campo continua afetando dano conforme o elemento." : "Ataques de assinatura podem transformar o campo."}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={!mainPhase || busy}
                onClick={() => void perform({ action: "pass", actionId: actionId() })}
              >
                <SkipForward /> Encerrar turno
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className={cn("battle-log", !logOpen && "is-collapsed")}>
        <button
          type="button"
          className="battle-section-title battle-log__toggle"
          onClick={() => setLogOpen((current) => !current)}
          aria-expanded={logOpen}
        >
          <span>Crônica da batalha</span>
          <span className="battle-log__toggle-meta">
            <ShieldCheck />
            {logOpen ? <ChevronUp /> : <ChevronDown />}
          </span>
        </button>
        <div className="battle-log__entries">
          {battle.log.slice(logOpen ? -9 : -3).reverse().map((entry) => (
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

