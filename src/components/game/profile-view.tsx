"use client";

import { Album, Coins, LayoutTemplate, ScrollText, Star, Trophy } from "lucide-react";
import { useState } from "react";
import { BATTLE_BOARDS, type BattleBoardId } from "@/game/battle/presentation";
import type { PlayerBootstrap, RemotePlayerSnapshot } from "@/game/player";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { getLegendAppearance, PLAYABLE_LEGEND_BY_ID } from "@/game/arpg/content/legends";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/auth/login-dialog";
import { CharacterAvatar2D } from "./character-avatar";

export function ProfileView({
  coins,
  xp,
  level,
  collectionCount,
  source,
  snapshot,
  avatar,
  preferredBattleBoard,
  onSaveBattleBoard,
}: {
  coins: number;
  xp: number;
  level: number;
  collectionCount: number;
  source: PlayerBootstrap["source"];
  snapshot: RemotePlayerSnapshot | null;
  avatar: AvatarConfig;
  preferredBattleBoard: BattleBoardId;
  onSaveBattleBoard: (boardId: BattleBoardId) => Promise<void> | void;
}) {
  const online = source === "supabase";
  const [savingBoard, setSavingBoard] = useState<BattleBoardId | null>(null);
  const favoriteLegend = avatar.favoriteLegendId
    ? PLAYABLE_LEGEND_BY_ID.get(avatar.favoriteLegendId) ?? null
    : null;
  const favoriteAvatar = favoriteLegend
    ? { ...DEFAULT_AVATAR_CONFIG, ...getLegendAppearance(favoriteLegend.id) }
    : null;

  async function chooseBoard(boardId: BattleBoardId) {
    setSavingBoard(boardId);
    try {
      await onSaveBattleBoard(boardId);
    } finally {
      setSavingBoard(null);
    }
  }

  return (
    <section className="content-view profile-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Jornada pessoal</span>
          <h1>Seu Cartógrafo</h1>
          <p>Acompanhe seu progresso e mantenha sua lenda favorita em destaque.</p>
        </div>
        <LoginDialog />
      </header>

      <div className="profile-hero">
        <div className="profile-avatar"><CharacterAvatar2D config={avatar} compact /></div>
        <div>
          <span className="profile-level">Personagem ativo · nível {level}</span>
          <h2>{snapshot?.profile.displayName ?? "Explorador das Raízes"}</h2>
          <p>{online ? "Personagem e progresso conectados à sua conta." : "Jornada local neste aparelho."}</p>
        </div>
      </div>

      <div className="profile-stats">
        <article><Coins /><strong>{coins.toLocaleString("pt-BR")}</strong><span>Moedas</span></article>
        <article><ScrollText /><strong>{xp.toLocaleString("pt-BR")}</strong><span>Experiência</span></article>
        <article><Album /><strong>{collectionCount}</strong><span>Seres possuídos</span></article>
        <article><Trophy /><strong>{snapshot?.exploration.filter((entry) => entry.sanctuaryCompleted).length ?? 0}</strong><span>Selos de santuário</span></article>
      </div>

      <section className="profile-hero profile-favorite-legend" aria-labelledby="favorite-legend-title">
        <div className="profile-avatar">
          {favoriteAvatar
            ? <CharacterAvatar2D config={favoriteAvatar} compact ariaLabel={`Visual de ${favoriteLegend?.name}`} />
            : <Star aria-hidden="true" />}
        </div>
        <div>
          <span className="view-eyebrow">Lenda favorita</span>
          {favoriteLegend ? (
            <>
              <h2 id="favorite-legend-title">{favoriteLegend.name}</h2>
              <p>{favoriteLegend.epithet} · Origem: {favoriteLegend.folklore}</p>
              <p>{favoriteLegend.description}</p>
            </>
          ) : (
            <>
              <h2 id="favorite-legend-title">Nenhuma lenda favorita</h2>
              <p>Escolha uma lenda e marque a estrela no lobby para vê-la aqui.</p>
            </>
          )}
        </div>
      </section>

      <section className="battle-board-picker" aria-labelledby="battle-board-picker-title">
        <div className="battle-board-picker__heading">
          <LayoutTemplate />
          <div>
            <span className="view-eyebrow">Personalização</span>
            <h2 id="battle-board-picker-title">Meu Tabuleiro</h2>
            <p>Escolha o cenário cosmético das suas batalhas. O tabuleiro não altera nenhuma regra.</p>
          </div>
        </div>
        <div className="battle-board-picker__grid">
          {BATTLE_BOARDS.map((board) => (
            <button
              key={board.id}
              type="button"
              className={cn(
                "battle-board-choice",
                `battle-board-choice--${board.id}`,
                preferredBattleBoard === board.id && "is-selected",
              )}
              disabled={savingBoard !== null}
              onClick={() => void chooseBoard(board.id)}
            >
              <span className="battle-board-choice__preview">
                <span className="battle-board-choice__horizon" />
                <span className="battle-board-choice__table" />
                <span className="battle-board-choice__spark battle-board-choice__spark--a" />
                <span className="battle-board-choice__spark battle-board-choice__spark--b" />
              </span>
              <span className="battle-board-choice__copy">
                <strong>{board.name}</strong>
                <small>{board.elementLabel} · {board.ambientLabel}</small>
                <span>{board.description}</span>
              </span>
              <span className="battle-board-choice__status">
                {savingBoard === board.id ? "Salvando..." : preferredBattleBoard === board.id ? "Selecionado" : "Usar"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="profile-note">
        <strong>Persistência transparente</strong>
        <p>
          {online
            ? "Perfil, coleção, equipes, energias, personagem, tabuleiro, mundo, missões, conquistas, casa e histórico usam a conta autenticada."
            : source === "supabase-unavailable"
              ? "A sessão está autenticada, mas o backend remoto não respondeu; alterações permanecem no cache até a conexão voltar."
              : "No modo visitante, este personagem fica salvo neste aparelho até a conta Google ser conectada."}
        </p>
      </div>
    </section>
  );
}
