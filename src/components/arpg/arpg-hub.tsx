"use client";

import { Coins, LayoutDashboard, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HubDestinationId } from "@/game/arpg/hub/content";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { createArpgHubGame } from "@/game/arpg/runtime/create-hub-game";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { HubTouchControls } from "./hub-touch-controls";

export function ArpgHub({
  playerName,
  level,
  coins,
  avatarConfig = DEFAULT_AVATAR_CONFIG,
  onNavigate,
  onOpenClassic,
}: {
  playerName: string;
  level: number;
  coins: number;
  avatarConfig?: AvatarConfig;
  onNavigate: (destination: HubDestinationId) => void;
  onOpenClassic: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const navigateRef = useRef(onNavigate);
  const [bridge] = useState(() => new ArpgBridge());
  const [soundEnabled, setSoundEnabled] = useState(() => bridge.getSoundEnabled());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Carregando Guilda dos Cartógrafos...");
  const [portraitMobile, setPortraitMobile] = useState(false);

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const unsubscribe = bridge.onSoundEnabled((enabled) => {
      setSoundEnabled(enabled);
      try {
        window.localStorage.setItem("arpg.soundEnabled", String(enabled));
      } catch {
        // The toggle still applies to the current hub if storage is blocked.
      }
    });

    try {
      const saved = window.localStorage.getItem("arpg.soundEnabled");
      if (saved === "true" || saved === "false") bridge.setSoundEnabled(saved === "true");
    } catch {
      // Sound preferences remain available for the current hub if storage is blocked.
    }

    return unsubscribe;
  }, [bridge]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
    const update = () => setPortraitMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (portraitMobile || !hostRef.current) return;
    let disposed = false;
    let destroyGame: (() => void) | null = null;
    setReady(false);
    setError(null);

    void createArpgHubGame(
      hostRef.current,
      bridge,
      (destination) => navigateRef.current(destination),
      (message) => setPrompt(message),
      avatarConfig,
    ).then((session) => {
      if (disposed) return session.destroy();
      destroyGame = session.destroy;
      setReady(true);
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o HUB jogável.");
    });

    return () => {
      disposed = true;
      destroyGame?.();
      bridge.setMove(0, 0);
    };
  }, [avatarConfig, bridge, portraitMobile]);

  if (portraitMobile) {
    return (
      <section className="arpg-hub-rotate">
        <strong>Gire o dispositivo para explorar a Guilda</strong>
        <span>O HUB físico usa o mesmo modo paisagem das expedições.</span>
        <button type="button" onClick={onOpenClassic}>Usar menu clássico</button>
      </section>
    );
  }

  return (
    <section className="arpg-hub-shell" aria-label="Guilda dos Cartógrafos">
      <div className="arpg-hub-topbar">
        <div>
          <small>HUB JOGÁVEL</small>
          <strong>{playerName}</strong>
        </div>
        <div className="arpg-hub-topbar__stats">
          <span><Coins /> {coins.toLocaleString("pt-BR")}</span>
          <span><ShieldCheck /> Nv. {level}</span>
        </div>
        <div className="arpg-hub-topbar__actions">
          <button
            type="button"
            onClick={() => bridge.setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? "Desativar música e sons" : "Ativar música e sons"}
            aria-pressed={soundEnabled}
            title={soundEnabled ? "Desativar música e sons" : "Ativar música e sons"}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </button>
          <button type="button" onClick={onOpenClassic}>
            <LayoutDashboard /> Menu clássico
          </button>
        </div>
      </div>

      <div className="arpg-hub-stage">
        <div ref={hostRef} className="arpg-hub-stage__canvas" />
        {!ready && !error ? <div className="arpg-hub-loading">Abrindo a Guilda...</div> : null}
        {error ? <div className="arpg-hub-error">{error}</div> : null}
        <div className="arpg-hub-prompt">{prompt}</div>
        <HubTouchControls bridge={bridge} />
      </div>

      <div className="arpg-hub-help">
        <span>WASD / joystick: mover</span>
        <span>E / RB / Interagir: entrar</span>
        <span>Também é possível tocar/clicar diretamente em uma estação.</span>
      </div>
    </section>
  );
}
