"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Play, Settings, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArpgAudio } from "@/game/arpg/runtime/arpg-audio";
import {
  getSoundEnabledSnapshot,
  setSoundEnabledPreference,
  subscribeSoundPreference,
} from "@/game/arpg/runtime/sound-preference";
import styles from "./title-screen.module.css";

export function TitleScreen({
  loginEnabled,
  signedIn,
  onPlay,
  onCooperative,
}: {
  loginEnabled: boolean;
  signedIn: boolean;
  onPlay: () => void;
  onCooperative?: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const soundEnabled = useSyncExternalStore(subscribeSoundPreference, getSoundEnabledSnapshot, () => true);
  const audioRef = useRef<ArpgAudio | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

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
    <section className={styles.screen} aria-labelledby="title-screen-heading" data-title-screen>
      <header className={styles.toolbar}>
        <span className={styles.worldNote}>13 Lendas <span aria-hidden="true">·</span> 3 biomas</span>
        <nav className={styles.utility} aria-label="Conta e opções">
          <LoginDialog label={loginEnabled ? "CONTA" : "ENTRAR"} className={styles.utilityButton} />
          <button
            ref={settingsButtonRef}
            type="button"
            className={styles.utilityButton}
            onClick={() => setSettingsOpen(true)}
            aria-label="CONFIGURAÇÕES"
            title="Configurações"
          >
            <Settings aria-hidden="true" />
            <span className={styles.settingsLabel}>Configurações</span>
          </button>
        </nav>
      </header>

      <div className={styles.content}>
        <div className={styles.brand}>
          <span className={styles.kicker}><span aria-hidden="true">✦</span> Uma jornada de folclore</span>
          <h1 id="title-screen-heading">
            <span className={styles.logoMark} aria-hidden="true">
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

        <p className={styles.description}>Explore masmorras, encontre armas e enfrente criaturas do folclore. Sua jornada começa na Guilda.</p>

        <nav className={styles.menu} aria-label="Escolher modo de jogo">
          <button type="button" className={`${styles.action} ${styles.play}`} onClick={onPlay}>
            <span className={styles.playIcon}><Play aria-hidden="true" /></span>
            <span className={styles.buttonCopy}>
              <strong>JOGAR</strong>{" "}
              <small>{signedIn ? "Entrar na Guilda" : "Começar como visitante"}</small>
            </span>
            <span className={styles.playArrow} aria-hidden="true">→</span>
          </button>
          <button type="button" className={`${styles.action} ${styles.cooperative}`} onClick={onCooperative} disabled={!onCooperative}>
            <UsersRound aria-hidden="true" />
            <span className={styles.buttonCopy}><strong>COOPERATIVO</strong>{" "}<small>Dungeons com amigos</small></span>
          </button>
          <Link href="/instalar" className={`${styles.action} ${styles.download}`} aria-label="Baixar Folklard para PC ou celular">
            <Download aria-hidden="true" />
            <span className={styles.buttonCopy}><strong>BAIXAR</strong>{" "}<small>PC e celular</small></span>
          </Link>
        </nav>

        <p className={styles.saveNote}>
          <ShieldCheck aria-hidden="true" />
          <span>{signedIn
            ? "Seu progresso está vinculado à sua conta."
            : "Visitante · o progresso fica salvo neste aparelho."}</span>
        </p>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          className={styles.dialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            settingsButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>Ajuste as opções da sua jornada.</DialogDescription>
          </DialogHeader>
          <label className={styles.settingRow}>
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
