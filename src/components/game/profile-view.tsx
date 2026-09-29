"use client";

import { Album, Coins, ScrollText, Trophy } from "lucide-react";
import type { PlayerBootstrap, RemotePlayerSnapshot } from "@/game/player";
import type { AvatarConfig } from "@/game/save/local-progress";
import { CREATURES } from "@/game/catalog";
import { LoginDialog } from "@/components/auth/login-dialog";
import { CharacterAvatar2D, CharacterCreator2D } from "./character-avatar";

export function ProfileView({
  coins,
  xp,
  source,
  snapshot,
  avatar,
  equipmentIds,
  onSaveAvatar,
}: {
  coins: number;
  xp: number;
  source: PlayerBootstrap["source"];
  snapshot: RemotePlayerSnapshot | null;
  avatar: AvatarConfig;
  equipmentIds: string[];
  onSaveAvatar: (config: AvatarConfig) => Promise<void> | void;
}) {
  const online = source === "supabase";
  return (
    <section className="content-view profile-view">
      <header className="view-heading">
        <div><span className="view-eyebrow">Jornada pessoal</span><h1>Seu Cartógrafo</h1><p>Crie seu personagem 2D e leve a mesma identidade para mapa, vila, refúgio e duelos.</p></div>
        <LoginDialog />
      </header>
      <div className="profile-hero">
        <div className="profile-avatar"><CharacterAvatar2D config={avatar} compact /></div>
        <div><span className="profile-level">Nível {snapshot?.profile.level ?? 7}</span><h2>{snapshot?.profile.displayName ?? "Explorador das Raízes"}</h2><p>{online ? "Personagem e progresso conectados à sua conta." : "Jornada local neste aparelho."}</p></div>
      </div>
      <div className="profile-stats">
        <article><Coins /><strong>{coins.toLocaleString("pt-BR")}</strong><span>Moedas</span></article>
        <article><ScrollText /><strong>{xp.toLocaleString("pt-BR")}</strong><span>Experiência</span></article>
        <article><Album /><strong>{snapshot?.collection.length ?? CREATURES.length}</strong><span>Seres possuídos</span></article>
        <article><Trophy /><strong>{snapshot?.exploration.filter((entry) => entry.sanctuaryCompleted).length ?? 0}</strong><span>Selos de santuário</span></article>
      </div>
      <CharacterCreator2D initial={avatar} ownedEquipment={equipmentIds} onSave={onSaveAvatar} />
      <div className="profile-note"><strong>Persistência transparente</strong><p>{online ? "Perfil, coleção, equipes, energias, personagem, mundo, missões, conquistas, casa e histórico usam a conta autenticada." : source === "supabase-unavailable" ? "A sessão está autenticada, mas o backend remoto não respondeu; alterações permanecem no cache até a conexão voltar." : "No modo visitante, este personagem fica salvo neste aparelho até a conta Google ser conectada."}</p></div>
    </section>
  );
}
