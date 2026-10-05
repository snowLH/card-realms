"use client";

import { Map as MapIcon, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ARPG_EXPEDITION_ID,
  getArpgExpedition,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { getDefaultSecondaryArpgWeaponId } from "@/game/arpg/content/equipment";
import type { ArpgHudState, ArpgLoadout, ArpgRunCheckpointState } from "@/game/arpg/domain/types";
import type { ArpgRunCheckpoint } from "@/game/arpg/dungeon/run-checkpoint";
import type { ArpgDungeonCombatState } from "@/game/arpg/dungeon/combat-authority";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { createArpgGame } from "@/game/arpg/runtime/create-game";
import { LootChoice } from "./loot-choice";
import { RoomChoice } from "./room-choice";
import { DungeonMapOverlay, RunHud } from "./run-hud";
import { TouchControls } from "./touch-controls";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";

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

export function ArpgGame({
  onExit,
  onRunComplete,
  loadout = DEFAULT_ARPG_LOADOUT,
  expeditionId = DEFAULT_ARPG_EXPEDITION_ID,
  avatarConfig = DEFAULT_AVATAR_CONFIG,
}: {
  onExit: () => void;
  onRunComplete?: (state: ArpgHudState, extraction?: ArpgExtractionResult) => void;
  loadout?: ArpgLoadout;
  expeditionId?: ArpgExpeditionId;
  avatarConfig?: AvatarConfig;
}) {
  const expedition = getArpgExpedition(expeditionId);
  const hostRef = useRef<HTMLDivElement>(null);
  const gameControlRef = useRef<{ setPaused: (paused: boolean) => void } | null>(null);
  const loadoutForBootRef = useRef(loadout);
  const bootStartedRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const persistentRunRef = useRef(false);
  const checkpointRevisionRef = useRef(0);
  const checkpointQueueRef = useRef<Promise<void>>(Promise.resolve());
  const onRunCompleteRef = useRef(onRunComplete);
  const [bridge] = useState(() => new ArpgBridge());
  const [soundEnabled, setSoundEnabled] = useState(() => bridge.getSoundEnabled());
  const [portraitMobile, setPortraitMobile] = useState(false);
  const [hud, setHud] = useState<ArpgHudState | null>(null);
  const [message, setMessage] = useState(() => `Entrando em ${expedition.name}...`);
  const [ready, setReady] = useState(false);
  const [runResult, setRunResult] = useState<ArpgHudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

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
    const query = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
    const update = () => setPortraitMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !ready || runResult) return;
      if (event.code === "Tab") {
        event.preventDefault();
        if (!paused) setMapOpen((current) => !current);
      } else if (event.code === "Escape") {
        event.preventDefault();
        if (mapOpen) setMapOpen(false);
        else setPaused((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ready, runResult, mapOpen, paused]);

  useEffect(() => {
    gameControlRef.current?.setPaused(paused || mapOpen);
  }, [paused, mapOpen]);

  useEffect(() => {
    if (portraitMobile || !hostRef.current) return;
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
        const payload = await response.json() as {
          revision?: number;
          state?: ArpgDungeonCombatState;
          error?: string;
        };
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
        const payload = await response.json() as { revision?: number; error?: string };
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

    const completeRun = async (state: ArpgHudState) => {
      setRunResult(state);
      const token = runTokenRef.current;
      if (!token) {
        setExtractionMessage("Run concluída localmente; sessão de extração indisponível.");
        onRunCompleteRef.current?.(state);
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
        const payload = await response.json() as ArpgExtractionResult & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "A extração não pôde ser validada.");
        setExtractionMessage(payload.persisted ? "Extração registrada na conta." : "Run de visitante: progresso permanente não alterado.");
        onRunCompleteRef.current?.(state, payload);
      } catch (error) {
        setExtractionMessage(error instanceof Error ? error.message : "Falha ao registrar extração.");
        onRunCompleteRef.current?.(state);
      }
    };

    const offEnd = bridge.onRunEnd((state) => void completeRun(state));
    const offCheckpoint = bridge.onRunCheckpoint(saveCheckpoint);

    const boot = async () => {
      try {
        const response = await fetch("/api/arpg/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start", expeditionId }),
        });
        const payload = await response.json() as {
          token?: string;
          lootItemIds?: string[];
          runSeed?: string;
          checkpoint?: ArpgRunCheckpoint;
          loadout?: ArpgLoadout;
          revision?: number;
          persistent?: boolean;
          resumed?: boolean;
          error?: string;
        };
        if (!response.ok || !payload.token || !payload.runSeed || !payload.checkpoint) {
          throw new Error(payload.error ?? "A sessão da run não pôde ser criada.");
        }
        runTokenRef.current = payload.token;
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
          avatarConfig,
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
      gameControlRef.current = null;
      destroyGame?.();
      setReady(false);
    };
  }, [avatarConfig, bridge, expedition, expeditionId, portraitMobile]);

  const requestFullscreen = async () => {
    const element = document.documentElement;
    if (!document.fullscreenElement) await element.requestFullscreen?.();
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

  if (portraitMobile) {
    return (
      <section className="arpg-rotate-gate">
        <RotateCcw />
        <strong>Gire o dispositivo para jogar</strong>
        <span>Card Realms foi projetado para gameplay em modo paisagem.</span>
        <button type="button" onClick={onExit}>Voltar à Guilda</button>
      </section>
    );
  }
  return (
    <section className="arpg-shell">
      <div className="arpg-shell__topbar">
        <div>
          <strong>{expedition.name}</strong>
          <span>{message}</span>
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
            type="button"
            aria-label={mapOpen ? "Fechar mapa" : "Abrir mapa"}
            aria-pressed={mapOpen}
            disabled={!ready || Boolean(runResult) || paused || !hud?.dungeonMap}
            onClick={() => setMapOpen((current) => !current)}
          >
            <MapIcon />
          </button>
          <button type="button" onClick={() => void requestFullscreen()} aria-label="Tela cheia">
            <Maximize2 />
          </button>
          <button type="button" onClick={onExit} aria-label="Voltar ao HUB">
            <X />
          </button>
        </div>
      </div>

      <div className="arpg-stage">
        <div ref={hostRef} className="arpg-stage__canvas" />
        {!ready ? <div className="arpg-stage__loading">{bootError ?? "Carregando motor ARPG..."}</div> : null}
        <RunHud state={hud} />
        <TouchControls
          bridge={bridge}
          weaponId={hud?.weaponId ?? loadout.weaponId}
          secondaryWeaponId={hud?.secondaryWeaponId ?? loadout.secondaryWeaponId ?? getDefaultSecondaryArpgWeaponId(loadout.weaponId)}
          abilityIds={hud?.abilityIds ?? loadout.abilityIds}
          abilityReadyAt={hud?.abilityReadyAt ?? {}}
          nowMs={hud?.nowMs ?? 0}
          dashReadyAt={hud?.dashReadyAt ?? 0}
          chestAvailable={hud?.chestAvailable ?? false}
          exitPortalAvailable={hud?.exitPortalAvailable ?? false}
          specialRoomAvailable={specialRoomAvailable}
        />
        <LootChoice state={hud} bridge={bridge} />
        <RoomChoice state={hud} bridge={bridge} />
        {paused ? (
          <section className="arpg-pause" role="dialog" aria-modal="true" aria-labelledby="arpg-pause-title">
            <div className="arpg-pause__panel">
              <small>EXPEDIÇÃO INTERROMPIDA</small>
              <h1 id="arpg-pause-title">Pausa</h1>
              <p>Retome quando estiver pronto para continuar a jornada.</p>
              <button type="button" autoFocus onClick={() => setPaused(false)}>Retomar</button>
              <button type="button" onClick={onExit}>Voltar à Guilda</button>
            </div>
          </section>
        ) : null}
        {mapOpen && hud?.dungeonMap ? (
          <DungeonMapOverlay map={hud.dungeonMap} onClose={() => setMapOpen(false)} />
        ) : null}
      </div>

      <div className="arpg-help">
        <span>WASD mover</span>
        <span>Mouse mirar</span>
        <span>Click atacar</span>
        <span>SPACE dash</span>
        <span>1 / 2 ataques</span>
        <span>E interagir/abrir baú</span>
        <span>Click direito: ataque 2</span>
        <span>Gamepad: LS mover · RS mirar · A atacar · B dash</span>
        <span>D-pad ↑ / ↓ ataques · RB interagir</span>
      </div>

      {runResult ? (
        <div className="arpg-run-result">
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
            {extractionMessage ? <span className="arpg-run-result__extraction">{extractionMessage}</span> : null}
            <button type="button" onClick={onExit}>Voltar à Guilda</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
