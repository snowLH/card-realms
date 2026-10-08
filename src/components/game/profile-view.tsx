"use client";

import { Album, Coins, ScrollText, Star, Trophy } from "lucide-react";
import type { PlayerBootstrap, RemotePlayerSnapshot } from "@/game/player";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { getLegendAppearance, PLAYABLE_LEGEND_BY_ID } from "@/game/arpg/content/legends";
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
}: {
  coins: number;
  xp: number;
  level: number;
  collectionCount: number;
  source: PlayerBootstrap["source"];
  snapshot: RemotePlayerSnapshot | null;
  avatar: AvatarConfig;
}) {
  const online = source === "supabase";
  const favoriteLegend = avatar.favoriteLegendId
    ? PLAYABLE_LEGEND_BY_ID.get(avatar.favoriteLegendId) ?? null
    : null;
  const favoriteAvatar = favoriteLegend
    ? { ...DEFAULT_AVATAR_CONFIG, ...getLegendAppearance(favoriteLegend.id) }
    : null;

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

      <div className="profile-note">
        <strong>Persistência transparente</strong>
        <p>
          {online
            ? "Perfil, coleção, personagem, arsenal, mundo, missões, conquistas e refúgio usam a conta autenticada."
            : source === "supabase-unavailable"
              ? "A sessão está autenticada, mas o backend remoto não respondeu; alterações permanecem no cache até a conexão voltar."
              : "No modo visitante, este personagem fica salvo neste aparelho até a conta Google ser conectada."}
        </p>
      </div>
    </section>
  );
}
