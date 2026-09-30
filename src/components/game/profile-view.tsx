"use client";

import { Album, Coins, LayoutTemplate, ScrollText, Trophy } from "lucide-react";
import { useState } from "react";
import { BATTLE_BOARDS, type BattleBoardId } from "@/game/battle/presentation";
import type { PlayerBootstrap, RemotePlayerSnapshot } from "@/game/player";
import type { AvatarConfig } from "@/game/save/local-progress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/auth/login-dialog";
import { CharacterAvatar2D, CharacterCreator2D } from "./character-avatar";

export function ProfileView({
  coins,
  xp,
  level,
  collectionCount,
  source,
  snapshot,
  avatar,
  equipmentIds,
  onSaveAvatar,
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
  equipmentIds: string[];
  onSaveAvatar: (config: AvatarConfig) => Promise<void> | void;
  preferredBattleBoard: BattleBoardId;
  onSaveBattleBoard: (boardId: BattleBoardId) => Promise<void> | void;
}) {
  const online = source === "supabase";
  const [savingBoard, setSavingBoard] = useState<BattleBoardId | null>(null);

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
          <p>Crie seu personagem 2D e leve a mesma identidade para mapa, vila, refúgio e duelos.</p>
        </div>
        <LoginDialog />
      </header>

      <div className="profile-hero">
        <div className="profile-avatar"><CharacterAvatar2D config={avatar} compact /></div>
        <div>
          <span className="profile-level">Nível {level}</span>
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

      <CharacterCreator2D initial={avatar} ownedEquipment={equipmentIds} onSave={onSaveAvatar} />

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
