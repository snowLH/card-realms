"use client";

import { NATIVE_BACK_EVENT } from "@/lib/native-app";

import { Map as MapIcon, Maximize2, Pause, Play, Smartphone, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_ARPG_EXPEDITION_ID,
  getArpgExpedition,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import type { ArpgHudState, ArpgLoadout, ArpgRunCheckpointState } from "@/game/arpg/domain/types";
import type { ArpgRunCheckpoint } from "@/game/arpg/dungeon/run-checkpoint";
import type { ArpgDungeonCombatState } from "@/game/arpg/dungeon/combat-authority";
import { getLocalDungeonCompletionReward } from "@/game/arpg/dungeon/rewards";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { createArpgGame } from "@/game/arpg/runtime/create-game";
import { bindInputLifecycle } from "@/game/arpg/runtime/input-lifecycle";
import { LootChoice } from "./loot-choice";
import { RoomChoice } from "./room-choice";
import { DungeonMapOverlay, RunHud } from "./run-hud";
import { TouchControls } from "./touch-controls";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { readJsonResponse } from "@/lib/http/read-json-response";
import {
  resolveAtlasEncounterTarget,
  type AtlasEncounterReference,
  type AtlasEncounterTarget,
} from "@/game/arpg/content/atlas-encounters";

type ArpgExtractionResult = {
  persisted: boolean;
  reward: {
    coins: number;
    xp: number;
    victory: boolean;
    items: string[];
    runLootItems?: string[];
    runLootReplayed?: boolean;
    newItems?: string[];
    replayed?: boolean;
  };
};

const PORTRAIT_MOBILE_QUERY = "(max-width: 900px) and (orientation: portrait)";

function subscribeToPortraitMode(onChange: () => void) {
  const query = window.matchMedia(PORTRAIT_MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getPortraitModeSnapshot() {
  return window.matchMedia(PORTRAIT_MOBILE_QUERY).matches;
}

function getPortraitModeServerSnapshot() {
  return null;
}

export function ArpgGame({
  onExit,
  exitLabel = "Voltar à Guilda",
  onRunComplete,
  loadout = DEFAULT_ARPG_LOADOUT,
  expeditionId = DEFAULT_ARPG_EXPEDITION_ID,
  avatarConfig = DEFAULT_AVATAR_CONFIG,
  atlasEncounter = null,
}: {
  onExit: () => void;
  exitLabel?: string;
  onRunComplete?: (state: ArpgHudState, extraction?: ArpgExtractionResult) => void;
  loadout?: ArpgLoadout;
  expeditionId?: ArpgExpeditionId;
  avatarConfig?: AvatarConfig;
  atlasEncounter?: AtlasEncounterReference | null;
}) {
  const expedition = getArpgExpedition(expeditionId);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapButtonRef = useRef<HTMLButtonElement>(null);
  const gameControlRef = useRef<{ setPaused: (paused: boolean) => void } | null>(null);
  const loadoutForBootRef = useRef(loadout);
  const bootStartedRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const persistentRunRef = useRef(false);
  const checkpointRevisionRef = useRef(0);
  const checkpointQueueRef = useRef<Promise<void>>(Promise.resolve());
  const onRunCompleteRef = useRef(onRunComplete);
  const runCompletedRef = useRef(false);
  const extractionInFlightRef = useRef(false);
  const retryExtractionRef = useRef<(() => Promise<void>) | null>(null);
  const [bridge] = useState(() => new ArpgBridge());
  const [soundEnabled, setSoundEnabled] = useState(() => bridge.getSoundEnabled());
  const portraitMobile = useSyncExternalStore(
    subscribeToPortraitMode,
    getPortraitModeSnapshot,
    getPortraitModeServerSnapshot,
  );
  const [hud, setHud] = useState<ArpgHudState | null>(null);
  const [message, setMessage] = useState(() => `Entrando em ${expedition.name}...`);
  const [ready, setReady] = useState(false);
  const [runResult, setRunResult] = useState<ArpgHudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<"idle" | "pending" | "error" | "complete">("idle");
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [atlasTarget, setAtlasTarget] = useState<AtlasEncounterTarget | null>(null);
  const hasDungeonMap = Boolean(hud?.dungeonMap);
  const extractionPending = extractionStatus === "pending";
  const requestExit = () => {
    if (!extractionInFlightRef.current) onExit();
  };

  useEffect(() => {
    onRunCompleteRef.current = onRunComplete;
  }, [onRunComplete]);

  useEffect(() => {
    const unsubscribe = bridge.onSoundEnabled((enabled) => {
      setSoundEnabled(enabled);
      try {
        window.localStorage.setItem("arpg.soundEnabled", String(enabled));
      } catch {
        // The toggle still applies to the current run if storage is blocked.
      }
    });

    try {
      const saved = window.localStorage.getItem("arpg.soundEnabled");
      if (saved === "true" || saved === "false") {
        bridge.setSoundEnabled(saved === "true");
      }
    } catch {
      // Sound preferences remain available for the current run if storage is blocked.
    }

    return unsubscribe;
  }, [bridge]);

  useEffect(() => {
    if (!bootStartedRef.current) loadoutForBootRef.current = loadout;
  }, [loadout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !ready || runResult || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (event.code === "KeyM") {
        if (!paused && hasDungeonMap) {
          event.preventDefault();
          setMapOpen((current) => !current);
        }
      } else if (event.code === "Escape") {
        event.preventDefault();
        if (mapOpen) setMapOpen(false);
        else setPaused((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ready, runResult, mapOpen, paused, hasDungeonMap]);

  useEffect(() => {
    gameControlRef.current?.setPaused(paused || mapOpen || portraitMobile === true);
  }, [paused, mapOpen, portraitMobile, ready]);

  useEffect(() => bindInputLifecycle(bridge, () => {
    if (ready && !runResult) setPaused(true);
  }), [bridge, ready, runResult]);

  useEffect(() => {
    const onBack = (event: Event) => {
      event.preventDefault();
      bridge.clearGameplayInput();
      if (runResult) {
        if (!extractionInFlightRef.current) onExit();
      }
      else if (mapOpen) setMapOpen(false);
      else setPaused(true);
    };
    window.addEventListener(NATIVE_BACK_EVENT, onBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, onBack);
  }, [bridge, mapOpen, runResult, onExit]);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let destroyGame: (() => void) | null = null;

    const host = hostRef.current;
    const offHud = bridge.onHud((state) => setHud(state));
    const offMessage = bridge.onMessage((next) => setMessage(next));
    const offEncounter = bridge.setEncounterActionHandler(async (roomId, command) => {
      const token = runTokenRef.current;
      if (!token || !persistentRunRef.current) return null;
      const submit = async () => {
        const response = await fetch("/api/arpg/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "encounter",
            token,
            expectedRevision: checkpointRevisionRef.current,
            roomId,
            command,
          }),
        });
        const payload = await readJsonResponse<{
          revision?: number;
          state?: ArpgDungeonCombatState;
          error?: string;
        }>(response, "O servidor enviou uma resposta inválida para o combate.");
        if (!response.ok || typeof payload.revision !== "number" || !payload.state) {
          throw new Error(payload.error ?? "O combate não pôde ser sincronizado com o servidor.");
        }
        checkpointRevisionRef.current = payload.revision;
        return { revision: payload.revision, state: payload.state };
      };
      const queued = checkpointQueueRef.current.then(submit);
      checkpointQueueRef.current = queued.then(() => undefined).catch((error: unknown) => {
        setExtractionMessage(error instanceof Error ? error.message : "Falha ao validar o combate.");
      });
      return queued;
    });

    const saveCheckpoint = (checkpoint: ArpgRunCheckpointState) => {
      const token = runTokenRef.current;
      if (!token || !persistentRunRef.current) return;
      const save = async () => {
        const response = await fetch("/api/arpg/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            action: "checkpoint",
            token,
            expectedRevision: checkpointRevisionRef.current,
            checkpoint,
          }),
        });
        const payload = await readJsonResponse<{ revision?: number; error?: string }>(
          response,
          "O servidor enviou uma resposta inválida ao salvar a sala.",
        );
        if (!response.ok || typeof payload.revision !== "number") {
          throw new Error(payload.error ?? "O checkpoint não pôde ser salvo.");
        }
        checkpointRevisionRef.current = payload.revision;
      };

      const queued = checkpointQueueRef.current.then(save);
      checkpointQueueRef.current = queued.catch((error: unknown) => {
        setExtractionMessage(error instanceof Error ? error.message : "Falha ao salvar o checkpoint.");
      });
    };

    const completeRun = async (state: ArpgHudState, retry = false) => {
      if (disposed || extractionInFlightRef.current || (runCompletedRef.current && !retry)) return;
      runCompletedRef.current = true;
      extractionInFlightRef.current = true;
      setExtractionStatus("pending");
      setRunResult(state);
      const persistent = persistentRunRef.current;
      retryExtractionRef.current = persistent ? () => completeRun(state, true) : null;
      const localExtraction: ArpgExtractionResult = {
        persisted: false,
        reward: {
          ...getLocalDungeonCompletionReward(expeditionId, state.victory),
          victory: state.victory,
          items: [],
          replayed: false,
        },
      };
      const token = runTokenRef.current;
      if (!token) {
        setExtractionMessage(state.victory
          ? `Vitória local: +${localExtraction.reward.coins} moedas e +${localExtraction.reward.xp} XP.`
          : "Expedição local encerrada sem recompensa de vitória.");
        extractionInFlightRef.current = false;
        setExtractionStatus("complete");
        retryExtractionRef.current = null;
        onRunCompleteRef.current?.(state, persistent ? undefined : localExtraction);
        return;
      }
      setExtractionMessage("Validando extração...");
      try {
        await checkpointQueueRef.current;
        const response = await fetch("/api/arpg/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "complete", token, victory: state.victory }),
        });
        const payload = await readJsonResponse<ArpgExtractionResult & { error?: string }>(
          response,
          "O servidor enviou uma resposta inválida ao registrar a extração.",
        );
        if (!response.ok) throw new Error(payload.error ?? "A extração não pôde ser validada.");
        setExtractionMessage(payload.persisted
          ? state.victory ? "Extração registrada na conta." : "Resultado registrado na conta."
          : state.victory
            ? `Vitória local: +${payload.reward.coins} moedas e +${payload.reward.xp} XP.`
            : "Expedição local encerrada sem recompensa de vitória.");
        retryExtractionRef.current = null;
        setExtractionStatus("complete");
        onRunCompleteRef.current?.(state, payload);
      } catch (error) {
        setExtractionMessage(persistent
          ? error instanceof Error ? error.message : "Falha ao registrar extração."
          : state.victory
            ? `Vitória local: +${localExtraction.reward.coins} moedas e +${localExtraction.reward.xp} XP.`
            : "Expedição local encerrada sem recompensa de vitória.");
        setExtractionStatus(persistent ? "error" : "complete");
        if (!persistent) onRunCompleteRef.current?.(state, localExtraction);
      } finally {
        extractionInFlightRef.current = false;
      }
    };

    const offEnd = bridge.onRunEnd((state) => void completeRun(state));
    const offCheckpoint = bridge.onRunCheckpoint(saveCheckpoint);

    const boot = async () => {
      try {
        runTokenRef.current = null;
        persistentRunRef.current = false;
        runCompletedRef.current = false;
        checkpointRevisionRef.current = 0;
        checkpointQueueRef.current = Promise.resolve();
        retryExtractionRef.current = null;
        extractionInFlightRef.current = false;
        bootStartedRef.current = false;
        setReady(false);
        setHud(null);
        setRunResult(null);
        setPaused(false);
        setMapOpen(false);
        setExtractionMessage(null);
        setExtractionStatus("idle");
        setBootError(null);
        const response = await fetch("/api/arpg/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "start",
            expeditionId,
            ...(atlasEncounter ? { atlasEncounter } : {}),
          }),
        });
        const payload = await readJsonResponse<{
          token?: string;
          lootItemIds?: string[];
          runSeed?: string;
          checkpoint?: ArpgRunCheckpoint;
          loadout?: ArpgLoadout;
          avatarConfig?: AvatarConfig | null;
          revision?: number;
          persistent?: boolean;
          resumed?: boolean;
          atlasEncounter?: AtlasEncounterReference | null;
          error?: string;
        }>(response, "O servidor enviou uma resposta inválida ao abrir a expedição.");
        if (!response.ok || !payload.token || !payload.runSeed || !payload.checkpoint) {
          throw new Error(payload.error ?? "A sessão da run não pôde ser criada.");
        }
        if (disposed) return;
        runTokenRef.current = payload.token;
        const resolvedTarget = resolveAtlasEncounterTarget(payload.atlasEncounter ?? null);
        if (atlasEncounter && !resolvedTarget) {
          throw new Error("O alvo selecionado do Atlas não foi preservado pela sessão.");
        }
        setAtlasTarget(resolvedTarget);
        persistentRunRef.current = payload.persistent === true;
        bridge.setServerAuthoritativeCombat(persistentRunRef.current);
        checkpointRevisionRef.current = payload.revision ?? 0;

        if (disposed) return;
        setBootError(null);
        setMessage(payload.resumed
          ? `Retomando sua run em ${expedition.name}...`
          : `Entrando em ${expedition.name}...`);
        bootStartedRef.current = true;
        const session = await createArpgGame(
          host,
          bridge,
          payload.loadout ?? loadoutForBootRef.current,
          expeditionId,
          payload.lootItemIds,
          payload.runSeed,
          payload.resumed ? payload.checkpoint : undefined,
          payload.avatarConfig ?? avatarConfig,
        );
        if (disposed) {
          session.destroy();
          return;
        }
        destroyGame = session.destroy;
        gameControlRef.current = session;
        setReady(true);
      } catch (error) {
        if (disposed) return;
        const reason = error instanceof Error ? error.message : "Falha ao iniciar a run.";
        setBootError(reason);
        setMessage(reason);
      }
    };
    void boot();

    return () => {
      disposed = true;
      offHud();
      offMessage();
      offEnd();
      offCheckpoint();
      offEncounter();
      bridge.setServerAuthoritativeCombat(false);
      retryExtractionRef.current = null;
      gameControlRef.current = null;
      destroyGame?.();
      setReady(false);
    };
  }, [atlasEncounter, avatarConfig, bootAttempt, bridge, expedition, expeditionId]);

  const requestFullscreen = async () => {
    try {
      const element = document.documentElement;
      if (!document.fullscreenElement) await element.requestFullscreen?.();
    } catch {
      setMessage("Tela cheia indisponível neste navegador. A expedição continua nesta janela.");
    }
  };
  const currentDungeonRoom = hud?.dungeonMap?.rooms.find(
    (room) => room.id === hud?.dungeonMap?.currentRoomId,
  );
  const specialRoomAvailable = Boolean(
    currentDungeonRoom?.state === "active"
    && ["event", "rest", "shop"].includes(currentDungeonRoom.type)
    && !hud?.pendingRoomChoice
    && !hud?.pendingLoot
    && !hud?.runEnded,
  );

  return (
    <section className={`arpg-shell${portraitMobile === true ? " arpg-shell--portrait-mobile" : ""}`}>
      <div className="arpg-playfield" inert={portraitMobile === true}>
        <div className="arpg-shell__topbar">
          <div>
            <strong>{expedition.name}</strong>
            <span>{message}</span>
            {atlasTarget ? (
              <em className="arpg-shell__atlas-target">
                {atlasTarget.kind === "npc" ? "Duelo com" : "Alvo do Atlas"}: {atlasTarget.name}
              </em>
            ) : null}
          </div>
          <div>
            <button
              type="button"
              onClick={() => bridge.setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
              aria-pressed={soundEnabled}
              title={soundEnabled ? "Desativar som" : "Ativar som"}
            >
              {soundEnabled ? <Volume2 /> : <VolumeX />}
            </button>
            <button
              type="button"
              aria-label={paused ? "Retomar jogo" : "Pausar jogo"}
              aria-pressed={paused}
              disabled={!ready || Boolean(runResult)}
              onClick={() => {
                setMapOpen(false);
                setPaused((current) => !current);
              }}
            >
              {paused ? <Play /> : <Pause />}
            </button>
            <button
              ref={mapButtonRef}
              type="button"
              aria-label={mapOpen ? "Fechar mapa (M)" : "Abrir mapa (M)"}
              aria-pressed={mapOpen}
              disabled={!ready || Boolean(runResult) || paused || !hud?.dungeonMap}
              onClick={() => setMapOpen((current) => !current)}
            >
              <MapIcon />
            </button>
            <button type="button" onClick={() => void requestFullscreen()} aria-label="Tela cheia">
              <Maximize2 />
            </button>
            <button type="button" disabled={extractionPending} onClick={requestExit} aria-label={exitLabel}>
              <X />
            </button>
          </div>
        </div>

        <div className="arpg-stage">
          <div ref={hostRef} className="arpg-stage__canvas" />
          {!ready ? (
            <div className="arpg-stage__loading" role={bootError ? "alert" : "status"}>
              {bootError ? (
                <div className="arpg-stage__loading-panel">
                  <strong>Não foi possível entrar na dungeon</strong>
                  <p>{bootError}</p>
                  <button type="button" onClick={() => setBootAttempt((attempt) => attempt + 1)}>
                    Tentar novamente
                  </button>
                  <button type="button" onClick={requestExit}>{exitLabel}</button>
                </div>
              ) : "Carregando motor ARPG..."}
            </div>
          ) : null}
          <RunHud state={hud} />
          {ready ? (
            <TouchControls
              bridge={bridge}
              abilityIds={hud?.abilityIds ?? loadout.abilityIds}
              abilityReadyAt={hud?.abilityReadyAt ?? {}}
              nowMs={hud?.nowMs ?? 0}
              dashReadyAt={hud?.dashReadyAt ?? 0}
              chestAvailable={hud?.chestAvailable ?? false}
              exitPortalAvailable={hud?.exitPortalAvailable ?? false}
              specialRoomAvailable={specialRoomAvailable}
              weaponBId={hud?.weaponSlots?.B ?? null}
              activeWeaponSlot={hud?.weaponSlots?.active ?? "A"}
            />
          ) : null}
          <LootChoice state={hud} bridge={bridge} />
          <RoomChoice state={hud} bridge={bridge} />
          {paused ? (
            <section className="arpg-pause" role="dialog" aria-modal="true" aria-labelledby="arpg-pause-title">
              <div className="arpg-pause__panel">
                <small>EXPEDIÇÃO INTERROMPIDA</small>
                <h1 id="arpg-pause-title">Pausa</h1>
                <p>Retome quando estiver pronto para continuar a jornada.</p>
                <button type="button" autoFocus onClick={() => setPaused(false)}>Retomar</button>
                <button type="button" disabled={extractionPending} onClick={requestExit}>{exitLabel}</button>
              </div>
            </section>
          ) : null}
          {hud?.dungeonMap ? (
            <DungeonMapOverlay
              map={hud.dungeonMap}
              open={mapOpen}
              onClose={() => setMapOpen(false)}
              restoreFocus={() => mapButtonRef.current?.focus()}
            />
          ) : null}
        </div>
        </div>

      <div className="arpg-help">
        <span>WASD mover</span>
        <span>Mouse mirar</span>
        <span>Click atacar</span>
        <span>SPACE dash</span>
        <span>1 / 2 ataques</span>
        <span>E interagir/abrir baú</span>
        <span>M mapa</span>
        <span>ESC pausar/retomar</span>
        <span>Click direito: ataque 2</span>
        <span>Gamepad: LS mover · RS mirar · A atacar · B dash</span>
        <span>D-pad ↑ / ↓ ataques · RB interagir</span>
      </div>

      {portraitMobile === true ? (
        <div className="arpg-rotate-gate" role="status">
          <Smartphone aria-hidden="true" />
          <strong>Gire o aparelho</strong>
          <span>A dungeon foi pausada. Jogue com a tela na horizontal para ter espaço para mover, atacar e usar seus poderes.</span>
          <button type="button" disabled={extractionPending} onClick={requestExit}>{exitLabel}</button>
        </div>
      ) : null}
      {runResult ? (
        <div className="arpg-run-result" aria-busy={extractionPending}>
          <div>
            <small>{runResult.victory ? "RUN CONCLUÍDA" : "FIM DA EXPEDIÇÃO"}</small>
            <strong>{runResult.victory ? expedition.victoryTitle : `${expedition.name} venceu desta vez`}</strong>
            <span>{runResult.xpEarned} XP de run · sala {runResult.room}/{runResult.roomCount}</span>
            <div className="arpg-run-result__loot">
              {runResult.runLoot.length
                ? runResult.runLoot.map((loot, index) => <span key={`${loot.kind}:${loot.id}:${index}`}>{loot.label}</span>)
                : <span>Nenhum loot encontrado</span>}
            </div>
            <small>{runResult.victory ? "Loot elegível para extração." : "Loot da run ainda não foi extraído."}</small>
            {extractionMessage ? <span className="arpg-run-result__extraction" role={extractionStatus === "error" ? "alert" : "status"}>{extractionMessage}</span> : null}
            {extractionStatus === "error" ? (
              <button type="button" onClick={() => void retryExtractionRef.current?.()}>Tentar registrar novamente</button>
            ) : null}
            {!runResult.victory && extractionStatus === "complete" ? (
              <button type="button" onClick={() => setBootAttempt((attempt) => attempt + 1)}>Tentar outra vez</button>
            ) : null}
            <button type="button" disabled={extractionPending} onClick={requestExit}>{extractionPending ? "Registrando resultado..." : exitLabel}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
