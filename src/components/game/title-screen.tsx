"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Settings, Swords, UsersRound } from "lucide-react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArpgAudio } from "@/game/arpg/runtime/arpg-audio";
import {
  getSoundEnabledSnapshot,
  setSoundEnabledPreference,
  subscribeSoundPreference,
} from "@/game/arpg/runtime/sound-preference";

export function TitleScreen({
  loginEnabled,
  signedIn,
  onPlay,
  onPvp,
  onCooperative,
}: {
  loginEnabled: boolean;
  signedIn: boolean;
  onPlay: () => void;
  onPvp?: () => void;
  onCooperative?: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const soundEnabled = useSyncExternalStore(subscribeSoundPreference, getSoundEnabledSnapshot, () => true);
  const audioRef = useRef<ArpgAudio | null>(null);

  useEffect(() => {
    const audio = new ArpgAudio("title-screen");
    audioRef.current = audio;
    audio.setEnabled(getSoundEnabledSnapshot());

    return () => {
      audio.destroy();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  const updateSound = (enabled: boolean) => {
    audioRef.current?.setEnabled(enabled);
    setSoundEnabledPreference(enabled);
  };

  return (
    <section className="title-screen" aria-labelledby="title-screen-heading">
      <div className="title-screen__glow" aria-hidden="true" />

      <div className="title-screen__content">
        <div className="title-screen__brand">
          <span className="title-screen__kicker"><span aria-hidden="true">✦</span> Uma jornada de folclore</span>
          <h1 id="title-screen-heading">
            <span className="title-screen__logo-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" shapeRendering="crispEdges">
                <path d="M10 2h12v4h4v4h4v16h-4v4H6v-4H2V10h4V6h4z" fill="currentColor" />
                <path d="M12 8h8v4h4v12h-4v4h-8v-4H8V12h4z" fill="#10291f" />
                <path d="M13 12h6v3h3v8h-3v3h-8v-3h-3v-8h3v-3z" fill="#70dfc3" />
                <path d="M15 16h2v2h-2zm-4 6h2v2h-2zm8-8h2v2h-2z" fill="#f5d582" />
              </svg>
            </span>
            Folklard
          </h1>
          <p>Crônicas de Aurória</p>
        </div>
      </div>

      <nav className="title-screen__utility" aria-label="Conta e opções">
        <LoginDialog
          label={loginEnabled ? "CONTA" : "ENTRAR"}
          className="title-screen__login title-screen__utility-login"
        />
        <button
          type="button"
          className="title-screen__menu-button title-screen__utility-settings"
          onClick={() => setSettingsOpen(true)}
          aria-label="CONFIGURAÇÕES"
          title="Configurações"
        >
          <Settings aria-hidden="true" />
        </button>
      </nav>

      <p className="title-screen__save-note">
        {signedIn
          ? "Seu progresso está vinculado à sua conta."
          : "Visitante · o progresso fica salvo neste aparelho."}
      </p>

      <nav className="title-screen__menu" aria-label="Escolher modo de jogo">
        <button type="button" className="title-screen__play" onClick={onPlay}>
          <span aria-hidden="true">▶</span>
          <span className="title-screen__button-copy">
            JOGAR
            <small>{signedIn ? "Entrar na Guilda" : "Começar como visitante"}</small>
          </span>
        </button>
        <button type="button" className="title-screen__mode title-screen__mode--pvp" onClick={onPvp} disabled={!onPvp}>
          <Swords aria-hidden="true" />
          <span>CONFLITO<small>PvP · avatar + 2 poderes</small></span>
        </button>
        <button type="button" className="title-screen__mode title-screen__mode--cooperative" onClick={onCooperative} disabled={!onCooperative}>
          <UsersRound aria-hidden="true" />
          <span>COOPERATIVO<small>Dungeons com amigos</small></span>
        </button>
      </nav>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="title-screen__dialog">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>Ajuste as opções da sua jornada.</DialogDescription>
          </DialogHeader>
          <label className="title-screen__setting-row">
            <span><strong>Áudio do jogo</strong><small>Música e efeitos da aventura</small></span>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => updateSound(event.currentTarget.checked)}
            />
          </label>
        </DialogContent>
      </Dialog>
    </section>
  );
}
