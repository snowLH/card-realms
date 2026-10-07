"use client";

import { Coins, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HubDestinationId } from "@/game/arpg/hub/content";
import type { PlayableLegendId } from "@/game/arpg/content/legends";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { createArpgHubGame } from "@/game/arpg/runtime/create-hub-game";
import {
  getSoundEnabledSnapshot,
  setSoundEnabledPreference,
  subscribeSoundPreference,
} from "@/game/arpg/runtime/sound-preference";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { HubTouchControls } from "./hub-touch-controls";

function formatHubPrompt(message: string, touchInput: boolean) {
  if (!touchInput) return message;
  return message
    .replace(/Clique ou toque no chão/gi, "Toque no chão")
    .replace(/WASD e joystick também funcionam/gi, "Use o joystick para mover")
    .replace(/WASD, joystick ou direcional movem sua Lenda/gi, "Use o joystick para mover")
    .replace(/Pressione E\b/g, "Toque em Interagir")
    .replace(/pressione E\b/g, "toque em Interagir");
}

export function ArpgHub({
  playerName,
  level,
  coins,
  avatarConfig = DEFAULT_AVATAR_CONFIG,
  onNavigate,
}: {
  playerName: string;
  level: number;
  coins: number;
  avatarConfig?: AvatarConfig;
  onNavigate: (destination: HubDestinationId, legendId?: PlayableLegendId) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const navigateRef = useRef(onNavigate);
  const [bridge] = useState(() => new ArpgBridge());
  const [soundEnabled, setSoundEnabled] = useState(() => bridge.getSoundEnabled());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Carregando Guilda dos Cartógrafos...");
  const [portraitMobile, setPortraitMobile] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const unsubscribeBridge = bridge.onSoundEnabled((enabled) => {
      setSoundEnabled(enabled);
      setSoundEnabledPreference(enabled);
    });
    const syncPreference = () => bridge.setSoundEnabled(getSoundEnabledSnapshot());
    syncPreference();
    const unsubscribePreference = subscribeSoundPreference(syncPreference);
    return () => {
      unsubscribeBridge();
      unsubscribePreference();
    };
  }, [bridge]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
    const update = () => setPortraitMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setTouchDevice(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let destroyGame: (() => void) | null = null;
    setReady(false);
    setError(null);

    void createArpgHubGame(
      hostRef.current,
      bridge,
      (destination, legendId) => navigateRef.current(destination, legendId),
      (message) => setPrompt(formatHubPrompt(message, touchDevice || portraitMobile)),
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
  }, [avatarConfig, bridge, portraitMobile, touchDevice]);

  return (
    <section
      className={`arpg-hub-shell${portraitMobile ? " arpg-hub-shell--portrait-mobile" : ""}`}
      aria-label="Guilda dos Cartógrafos"
    >
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
            {soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          </button>
        </div>
        <div className="arpg-hub-topbar__menu-space" aria-hidden="true" />
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
        <span>Chegue perto de uma estação para interagir.</span>
      </div>
    </section>
  );
}
