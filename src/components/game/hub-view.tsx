"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Coins,
  Compass,
  Crown,
  Gift,
  Home,
  Layers3,
  Play,
  ShieldCheck,
  Sparkles,
  Swords,
} from "lucide-react";
import type { PlayerBootstrap } from "@/game/player";
import type { RegionDefinition } from "@/game/types";
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";

export function HubView({
  playerName,
  level,
  coins,
  xp,
  collectionCount,
  currentRegionDiscoveryCount,
  combatReady,
  currentRegion,
  source,
  treasureClaimed,
  onContinue,
  onOpenCollection,
  onOpenTeam,
  onOpenRefuge,
  onOpenRaid,
  onOpenPvp,
  onClaimTreasure,
}: {
  playerName: string;
  level: number;
  coins: number;
  xp: number;
  collectionCount: number;
  currentRegionDiscoveryCount: number;
  combatReady: boolean;
  currentRegion: RegionDefinition;
  source: PlayerBootstrap["source"];
  treasureClaimed: boolean;
  onContinue: () => void;
  onOpenCollection: () => void;
  onOpenTeam: () => void;
  onOpenRefuge: () => void;
  onOpenRaid: () => void;
  onOpenPvp: () => void;
  onClaimTreasure: () => void;
}) {
  const initials = playerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section className="content-view hub-view" aria-labelledby="hub-title">
      <header className="hub-player">
        <div className="hub-player__identity">
          <span className="hub-player__avatar" aria-hidden>{initials || "CR"}</span>
          <div>
            <span className="hub-kicker">Cartógrafo</span>
            <h1 id="hub-title">{playerName}</h1>
            <p>Nível {level} · {source === "supabase" ? "progresso online" : "jornada neste aparelho"}</p>
          </div>
        </div>
        <div className="hub-wallet" aria-label="Resumo do jogador">
          <span><Coins /> <strong>{coins.toLocaleString("pt-BR")}</strong><small>moedas</small></span>
          <span><ShieldCheck /> <strong>{xp.toLocaleString("pt-BR")}</strong><small>XP</small></span>
        </div>
      </header>

      <div className="hub-section-heading">
        <span>Jogar</span>
        <small>Retome sua expedição ou entre em um duelo.</small>
      </div>

      <div className="hub-play-grid">
        <button type="button" className="hub-continue" onClick={onContinue}>
          <span className="hub-continue__icon"><Play fill="currentColor" /></span>
          <span className="hub-continue__copy">
            <small>Novo núcleo ARPG</small>
            <strong>Entrar na Mata Encantada</strong>
            <span>Tempo real · dungeon roguelite</span>
          </span>
          <ArrowRight />
        </button>

        <button type="button" className="hub-duel hub-raid" onClick={onOpenRaid}>
          <span className="hub-duel__icon"><Crown /></span>
          <span>
            <small>Evento cooperativo</small>
            <strong>Raid Mítica</strong>
            <em>Sábado · até 5 amigos</em>
          </span>
          <ArrowRight />
        </button>

        <button type="button" className="hub-duel" onClick={onOpenPvp}>
          <span className="hub-duel__icon"><Swords /></span>
          <span>
            <small>Partida online</small>
            <strong>Salão de Duelos</strong>
            <em>{combatReady ? "Avatar e 2 poderes prontos" : "Prepare avatar e 2 poderes"}</em>
          </span>
          <ArrowRight />
        </button>
      </div>

      <PwaInstallButton />

      <div className="hub-section-heading hub-section-heading--rewards">
        <span>Jornada de hoje</span>
        <small>Recompensas e atalhos da sua aventura.</small>
      </div>

      <div className="hub-action-grid">
        <button type="button" className="hub-action-card hub-action-card--reward" onClick={onClaimTreasure}>
          <span className="hub-action-card__icon"><Gift /></span>
          <small>{treasureClaimed ? "Coletado" : "Disponível agora"}</small>
          <strong>Baú da região</strong>
          <span>{treasureClaimed ? "Recompensa registrada" : "+45 moedas e fragmento"}</span>
          {treasureClaimed ? <Check className="hub-action-card__status" /> : <Sparkles className="hub-action-card__status" />}
        </button>

        <button type="button" className="hub-action-card" onClick={onOpenCollection}>
          <span className="hub-action-card__icon"><BookOpen /></span>
          <small>Bestiário</small>
          <strong>{collectionCount} seres</strong>
          <span>Ver coleção e origens</span>
          <ArrowRight className="hub-action-card__status" />
        </button>

        <button type="button" className="hub-action-card" onClick={onOpenTeam}>
          <span className="hub-action-card__icon"><Layers3 /></span>
          <small>Loadout ARPG</small>
          <strong>Arsenal</strong>
          <span>Arma, armadura, relíquia e 2 ataques</span>
          <ArrowRight className="hub-action-card__status" />
        </button>

        <button type="button" className="hub-action-card" onClick={onOpenRefuge}>
          <span className="hub-action-card__icon"><Home /></span>
          <small>Espaço pessoal</small>
          <strong>Seu refúgio</strong>
          <span>Sua casa e criaturas da coleção</span>
          <ArrowRight className="hub-action-card__status" />
        </button>
      </div>

      <button type="button" className="hub-recent" onClick={onContinue}>
        <span className="hub-recent__icon"><Compass /></span>
        <span>
          <small>Última expedição</small>
          <strong>{currentRegion.name}</strong>
        </span>
        <span className="hub-recent__meta">{currentRegionDiscoveryCount}/{currentRegion.totalCreatures} descobertos</span>
        <ArrowRight />
      </button>
    </section>
  );
}
