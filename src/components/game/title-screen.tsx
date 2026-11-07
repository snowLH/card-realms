"use client";
import {ArtSprite} from '@/components/ui/art-sprite';
import {UI_ART} from '@/game/arpg/art/manifest';
import { CHARACTER_PORTRAITS } from "@/game/content/character-portraits";
import { PixelCreature } from "./pixel-creature";


import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, BookOpen, Crown, Download, Play, Settings, ShieldCheck, Sparkles, UsersRound } from "@/components/ui/pixel-icon";
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
import { OfflineLaunch } from "@/components/pwa/offline-launch";

export function TitleScreen({
  loginEnabled,
  signedIn,
  onPlay,
  onCooperative,
  onCollection,
  onProfile,
  offlineMode = false,
}: {
  loginEnabled: boolean;
  signedIn: boolean;
  onPlay: () => void;
  onCooperative?: () => void;
  onCollection?: () => void;
  onProfile?: () => void;
  offlineMode?: boolean;
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
        <span className={styles.worldNote}>14 Lendas <span aria-hidden="true">·</span> 3 biomas</span>
        <nav className={styles.utility} aria-label="Conta e opções">
          <Link href="/guia" className={styles.utilityButton} title="Guia do jogo">
            <BookOpen aria-hidden="true" />
            <span className={styles.settingsLabel}>Guia</span>
          </Link>
          {!offlineMode ? <LoginDialog label={loginEnabled ? "CONTA" : "ENTRAR"} className={styles.utilityButton} /> : null}
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
          <span className={styles.kicker}><ArtSprite pack="ui" frame={UI_ART.star.frame} style={{width:16,height:16}}/> Card Realms · Crônicas das Lendas</span>
          <h1 id="title-screen-heading">
            <span className={styles.logoMark} aria-hidden="true">
              <ArtSprite pack="ui" frame={UI_ART.hero.frame} style={{width:48,height:48}}/>
            </span>
            Folklard
          </h1>
          <p>Card Realms · Crônicas de Aurória</p>
        </div>

        <p className={styles.description}>Lidere lendas do folclore mundial em um campo de batalha vivo de estratégia e cartas, ou explore a Guilda e expedições.</p>

        <div aria-label="Lendas em destaque" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PixelCreature sprite={CHARACTER_PORTRAITS["curupira"]} label="Curupira" />
          <PixelCreature sprite={CHARACTER_PORTRAITS["iara"]} label="Iara" />
          <PixelCreature sprite={CHARACTER_PORTRAITS["kitsune"]} label="Kitsune" />
          <PixelCreature sprite={CHARACTER_PORTRAITS["oni"]} label="Oni" />
        </div>

        <nav className={styles.menu} aria-label="Escolher modo de jogo">
          <button type="button" className={`${styles.action} ${styles.play}`} onClick={onPlay}>
            <span className={styles.playIcon}><Play aria-hidden="true" /></span>
            <span className={styles.buttonCopy}>
              <strong>{offlineMode ? "AVENTURA OFFLINE" : "JOGAR"}</strong>{" "}
              <small>{offlineMode ? "Jogar neste aparelho" : signedIn ? "Entrar na Guilda" : "Começar como visitante"}</small>
            </span>
            <span className={styles.playArrow} aria-hidden="true"><ArrowRight /></span>
          </button>
          {onCollection ? (
            <button type="button" className={styles.action} onClick={onCollection}>
              <Sparkles aria-hidden="true" />
              <span className={styles.buttonCopy}><strong>COLEÇÃO</strong>{" "}<small>Bestiário e Cartas</small></span>
            </button>
          ) : null}
          {onProfile ? (
            <button type="button" className={styles.action} onClick={onProfile}>
              <Crown aria-hidden="true" />
              <span className={styles.buttonCopy}><strong>PERFIL</strong>{" "}<small>Reino e Progresso</small></span>
            </button>
          ) : null}
          {!offlineMode ? <button type="button" className={`${styles.action} ${styles.cooperative}`} onClick={onCooperative} disabled={!onCooperative}>
            <UsersRound aria-hidden="true" />
            <span className={styles.buttonCopy}><strong>COOPERATIVO</strong>{" "}<small>Dungeons com amigos</small></span>
          </button> : null}
          <Link href="/instalar" className={`${styles.action} ${styles.download}`} aria-label="Baixar Folklard para PC ou celular">
            <Download aria-hidden="true" />
            <span className={styles.buttonCopy}><strong>BAIXAR</strong>{" "}<small>PC e celular</small></span>
          </Link>
        </nav>

        <OfflineLaunch offlineMode={offlineMode} />

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
