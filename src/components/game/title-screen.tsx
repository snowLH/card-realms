"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoginDialog } from "@/components/auth/login-dialog";
import { ArpgAudio } from "@/game/arpg/runtime/arpg-audio";

type TitlePanel = "settings" | "credits" | null;
const SOUND_PREFERENCE_EVENT = "arpg:sound-preference";
let soundEnabledInMemory = true;

function getSoundEnabledSnapshot() {
  try {
    const saved = window.localStorage.getItem("arpg.soundEnabled");
    if (saved === "true" || saved === "false") return saved === "true";
  } catch {
    // Fall back to the current-session value when storage is blocked.
  }
  return soundEnabledInMemory;
}

function subscribeSoundPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SOUND_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SOUND_PREFERENCE_EVENT, onChange);
  };
}

export function TitleScreen({
  loginEnabled,
  signedIn,
  onPlay,
}: {
  loginEnabled: boolean;
  signedIn: boolean;
  onPlay: () => void;
}) {
  const [panel, setPanel] = useState<TitlePanel>(null);
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

  const openSettings = () => setPanel("settings");

  const updateSound = (enabled: boolean) => {
    soundEnabledInMemory = enabled;
    audioRef.current?.setEnabled(enabled);
    try {
      window.localStorage.setItem("arpg.soundEnabled", String(enabled));
    } catch {
      // Keep the preference active for this title screen even if it cannot be persisted.
    }
    window.dispatchEvent(new Event(SOUND_PREFERENCE_EVENT));
  };

  return (
    <section className="title-screen" aria-labelledby="title-screen-heading">
      <div className="title-screen__glow" aria-hidden="true" />
      <div className="title-screen__content">
        <div className="title-screen__brand">
          <span className="title-screen__kicker"><span aria-hidden="true">✦</span> Uma jornada de folclore</span>
          <h1 id="title-screen-heading">Card <span>Realms</span></h1>
          <p>Crônicas de Aurória</p>
        </div>

        <nav className="title-screen__menu" aria-label="Menu principal">
          <button type="button" className="title-screen__play" onClick={onPlay}>
            <span aria-hidden="true">▶</span>
            JOGAR
            <small>{signedIn ? "Entrar na Guilda" : "Começar como visitante"}</small>
          </button>
          {!signedIn ? (
            <LoginDialog
              prominent
              label={loginEnabled ? "ENTRAR COM GOOGLE" : "ENTRAR"}
              className="title-screen__login"
            />
          ) : null}
          <button type="button" className="title-screen__menu-button" onClick={openSettings}>
            CONFIGURAÇÕES
          </button>
          <button type="button" className="title-screen__menu-button" onClick={() => setPanel("credits")}>
            CRÉDITOS
          </button>
        </nav>

        <p className="title-screen__save-note">
          {signedIn
            ? "Seu progresso está vinculado à sua conta."
            : "Visitante · o progresso fica salvo neste aparelho."}
        </p>
      </div>

      <p className="title-screen__caption" aria-hidden="true">As lendas despertam além do portal</p>

      <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}>
        <DialogContent className="title-screen__dialog">
          {panel === "settings" ? (
            <>
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
            </>
          ) : panel === "credits" ? (
            <>
              <DialogHeader>
                <DialogTitle>Créditos</DialogTitle>
                <DialogDescription>Uma aventura original de Card Realms.</DialogDescription>
              </DialogHeader>
              <dl className="title-screen__credits">
                <div><dt>Universo</dt><dd>Card Realms · Crônicas de Aurória</dd></div>
                <div><dt>Inspiração cultural</dt><dd>Folclore brasileiro e tradições representadas no Bestiário</dd></div>
                <div><dt>Jogo</dt><dd>ARPG 2D para navegador, construído com Phaser e Next.js</dd></div>
                <div><dt>Arte de abertura</dt><dd>Ilustração original criada para esta tela</dd></div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
