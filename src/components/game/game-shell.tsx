"use client";

import {
  Album,
  Coins,
  Home,
  LayoutDashboard,
  Layers3,
  Map,
  ScrollText,
  ShieldCheck,
  Swords,
  Trophy,
  UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CREATURES, REGIONS } from "@/game/catalog";
import type { PlayerBootstrap, RemotePlayerSnapshot } from "@/game/player";
import type { RegionDefinition } from "@/game/types";
import { loadLocalProgress, saveLocalProgress } from "@/game/save/local-progress";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { CollectionView } from "./collection-view";
import { HubView } from "./hub-view";
import { RefugeView } from "./refuge-view";
import { PvpView } from "./pvp-view";
import { TeamView } from "./team-view";
import { WorldMap } from "./world-map";

const BattleArena = dynamic(
  () => import("./battle-arena").then((module) => module.BattleArena),
  {
    ssr: false,
    loading: () => (
      <div className="battle-loading" role="status">
        Preparando a arena...
      </div>
    ),
  },
);

type View = "hub" | "map" | "collection" | "team" | "refuge" | "pvp" | "profile";

const navigation = [
  { id: "hub", label: "Início", icon: LayoutDashboard },
  { id: "map", label: "Mapa", icon: Map },
  { id: "collection", label: "Coleção", icon: Album },
  { id: "team", label: "Equipe", icon: Layers3 },
  { id: "refuge", label: "Refúgio", icon: Home },
  { id: "pvp", label: "Duelos", icon: Swords },
  { id: "profile", label: "Perfil", icon: UserRound },
] satisfies Array<{ id: View; label: string; icon: typeof Map }>;

const mobileNavigation = navigation.filter((item) =>
  ["hub", "collection", "team", "pvp", "profile"].includes(item.id),
);

async function mutateRemoteProgress(body: Record<string, unknown>) {
  const response = await fetch("/api/player/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "A sincronização remota falhou.");
  return payload.result;
}

export function GameShell({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const remoteSnapshot = bootstrap.snapshot;
  const [view, setView] = useState<View>("hub");
  const initialRegion = REGIONS.find(
    (region) => region.id === remoteSnapshot?.world.currentRegionId,
  ) ?? REGIONS[0];
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition | null>(initialRegion);
  const [playerRegionId, setPlayerRegionId] = useState(initialRegion.id);
  const [battleOpen, setBattleOpen] = useState(false);
  const [pvpBattleId, setPvpBattleId] = useState<string | null>(null);
  const [coins, setCoins] = useState(remoteSnapshot?.profile.coins ?? 840);
  const [xp, setXp] = useState(remoteSnapshot?.profile.xp ?? 1240);
  const [toast, setToast] = useState<string | null>(null);
  const [openedTreasures, setOpenedTreasures] = useState<string[]>(
    remoteSnapshot?.world.openedTreasures ?? [],
  );
  const [progressLoaded, setProgressLoaded] = useState(bootstrap.source === "supabase");

  useEffect(() => {
    if (bootstrap.source === "supabase") return;
    try {
      const parsed = loadLocalProgress(window.localStorage);
      setCoins(parsed.coins);
      setXp(parsed.xp);
      setOpenedTreasures(parsed.openedTreasures);
      const savedRegion = REGIONS.find(
        (region) => region.id === parsed.playerRegionId && region.status === "open",
      );
      if (savedRegion) {
        setPlayerRegionId(parsed.playerRegionId);
        setSelectedRegion(savedRegion);
      }
    } finally {
      setProgressLoaded(true);
    }
  }, [bootstrap.source]);

  useEffect(() => {
    if (!progressLoaded) return;
    try {
      saveLocalProgress(window.localStorage, {
        version: 2,
        coins,
        xp,
        openedTreasures,
        playerRegionId,
      });
    } catch (error) {
      console.error("Não foi possível salvar o progresso local.", error);
    }
  }, [coins, openedTreasures, playerRegionId, progressLoaded, xp]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (next: View) => {
    setView(next);
  };

  const handleBattle = () => {
    setBattleOpen(true);
  };

  const handleTreasure = async (region: RegionDefinition) => {
    if (openedTreasures.includes(region.id)) {
      setToast("Este baú já foi recolhido. Ele reaparecerá em outra expedição.");
      return;
    }

    if (bootstrap.source === "supabase") {
      try {
        const result = await mutateRemoteProgress({ action: "claim_treasure", regionId: region.id }) as {
          coins: number;
          openedTreasures: string[];
        };
        setOpenedTreasures(result.openedTreasures);
        setCoins(result.coins);
        setToast("Tesouro confirmado pelo servidor: +45 moedas e 1 fragmento de vínculo.");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Não foi possível recolher o tesouro.");
      }
      return;
    }

    setOpenedTreasures((current) => [...current, region.id]);
    setCoins((current) => current + 45);
    setToast(
      bootstrap.source === "supabase-unavailable"
        ? "Baú salvo somente no cache; a conta remota está indisponível."
        : "Baú cartográfico encontrado: +45 moedas e 1 fragmento de vínculo.",
    );
  };

  const handleTravel = async (region: RegionDefinition) => {
    if (bootstrap.source === "supabase") {
      try {
        await mutateRemoteProgress({ action: "travel", regionId: region.id });
      } catch (error) {
        setToast(error instanceof Error ? error.message : "A viagem não pôde ser sincronizada.");
        return;
      }
    }
    setPlayerRegionId(region.id);
    setSelectedRegion(region);
    setToast(
      bootstrap.source === "supabase-unavailable"
        ? `Você chegou a ${region.name}; posição mantida apenas no cache.`
        : `Você chegou a ${region.name}.`,
    );
  };

  const handleVictory = useCallback(() => {
    if (bootstrap.source === "supabase") {
      setToast("A batalha demonstrativa não altera a economia da conta online.");
      return;
    }
    setCoins((current) => current + 120);
    setXp((current) => current + 80);
  }, [bootstrap.source]);

  const activeTeam = remoteSnapshot?.teams.find((team) => team.isActive);
  const activeTeamIds = activeTeam?.members
    .slice()
    .sort((left, right) => left.slot - right.slot)
    .map((member) => member.catalogId);
  const ownedCatalogIds = remoteSnapshot?.collection.map((creature) => creature.catalogId);
  const currentRegion = REGIONS.find((region) => region.id === playerRegionId) ?? REGIONS[0];
  const pvpSession = useMemo(() => (
    pvpBattleId && bootstrap.identity
      ? { battleId: pvpBattleId, playerId: bootstrap.identity.id }
      : undefined
  ), [bootstrap.identity, pvpBattleId]);

  return (
    <main className="game-app">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => navigate("hub")}>
          <span className="brand__mark">CR</span>
          <span><strong>Card Realms</strong><small>Atlas de Aurória</small></span>
        </button>
        <div className="header-stats">
          <span><Coins /> {coins.toLocaleString("pt-BR")}</span>
          <span><ShieldCheck /> Nv. 7</span>
        </div>
        <div className="header-actions">
          <LoginDialog />
        </div>
      </header>

      <aside className="side-nav">
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={cn(view === item.id && "is-active")} onClick={() => navigate(item.id)}>
                <Icon /> <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="side-quest">
          <span>Missão ativa</span>
          <strong>Vozes da mata</strong>
          <p>Vença a Guardiã Aya na Provação das Raízes.</p>
          <div><span style={{ width: `${Math.min(100, (xp / 1800) * 100)}%` }} /></div>
          <small>{xp}/1.800 XP</small>
        </div>
        <Badge className="side-build">
          {bootstrap.source === "supabase"
            ? "Conta online · Supabase é a fonte de verdade"
            : bootstrap.source === "supabase-unavailable"
              ? "Conta online · cache local de emergência"
              : "Visitante · progresso salvo neste aparelho"}
        </Badge>
      </aside>

      <div className="app-content">
        {view === "hub" ? (
          <HubView
            playerName={remoteSnapshot?.profile.displayName ?? bootstrap.identity?.email?.split("@")[0] ?? "Explorador"}
            level={remoteSnapshot?.profile.level ?? 7}
            coins={coins}
            xp={xp}
            collectionCount={ownedCatalogIds?.length ?? CREATURES.length}
            teamReady={activeTeamIds?.length === 6}
            currentRegion={currentRegion}
            source={bootstrap.source}
            treasureClaimed={openedTreasures.includes(playerRegionId)}
            onContinue={() => navigate("map")}
            onOpenCollection={() => navigate("collection")}
            onOpenTeam={() => navigate("team")}
            onOpenRefuge={() => navigate("refuge")}
            onOpenPvp={() => navigate("pvp")}
            onClaimTreasure={() => void handleTreasure(currentRegion)}
          />
        ) : null}
        {view === "map" ? (
          <WorldMap
            selected={selectedRegion}
            playerRegionId={playerRegionId}
            onSelect={setSelectedRegion}
            onTravel={handleTravel}
            onBattle={handleBattle}
            onTreasure={handleTreasure}
          />
        ) : null}
        {view === "collection" ? <CollectionView ownedCatalogIds={ownedCatalogIds} /> : null}
        {view === "team" ? <TeamView teamIds={activeTeamIds} teamName={activeTeam?.name} /> : null}
        {view === "refuge" ? <RefugeView /> : null}
        {view === "pvp" ? <PvpView bootstrap={bootstrap} onOpenBattle={setPvpBattleId} /> : null}
        {view === "profile" ? (
          <ProfileView coins={coins} xp={xp} source={bootstrap.source} snapshot={remoteSnapshot} />
        ) : null}
      </div>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={cn(view === item.id && "is-active")} onClick={() => navigate(item.id)}>
              <Icon /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {toast ? <div className="game-toast"><Trophy /> {toast}</div> : null}
      {battleOpen || pvpSession ? (
        <div className="battle-overlay">
          <BattleArena
            open
            pvp={pvpSession}
            onClose={() => {
              setBattleOpen(false);
              setPvpBattleId(null);
            }}
            onVictory={pvpSession ? () => undefined : handleVictory}
          />
        </div>
      ) : null}
    </main>
  );
}

function ProfileView({
  coins,
  xp,
  source,
  snapshot,
}: {
  coins: number;
  xp: number;
  source: PlayerBootstrap["source"];
  snapshot: RemotePlayerSnapshot | null;
}) {
  const online = source === "supabase";
  return (
    <section className="content-view profile-view">
      <header className="view-heading">
        <div><span className="view-eyebrow">Jornada pessoal</span><h1>Cartógrafo visitante</h1><p>Entre na sua conta para sincronizar este perfil entre celular, tablet e computador.</p></div>
        <LoginDialog />
      </header>
      <div className="profile-hero">
        <div className="profile-avatar"><UserRound /></div>
        <div><Badge>Nível {snapshot?.profile.level ?? 7}</Badge><h2>{snapshot?.profile.displayName ?? "Explorador das Raízes"}</h2><p>{online ? "Progresso carregado da conta online." : "Jornada local neste aparelho."}</p></div>
      </div>
      <div className="profile-stats">
        <article><Coins /><strong>{coins.toLocaleString("pt-BR")}</strong><span>Moedas</span></article>
        <article><ScrollText /><strong>{xp.toLocaleString("pt-BR")}</strong><span>Experiência</span></article>
        <article><Album /><strong>{snapshot?.collection.length ?? CREATURES.length}</strong><span>Seres possuídos</span></article>
        <article><Trophy /><strong>{snapshot?.exploration.filter((entry) => entry.sanctuaryCompleted).length ?? 0}</strong><span>Selos de santuário</span></article>
      </div>
      <div className="profile-note"><strong>Persistência transparente</strong><p>{online ? "Perfil, coleção, equipes, energias, mundo, missões, conquistas, casa e histórico vêm do snapshot remoto validado. Alterações críticas continuam exclusivamente no servidor." : source === "supabase-unavailable" ? "A sessão está autenticada, mas o backend de progresso não respondeu. O cache permite continuar sem ser apresentado como autoridade da conta." : "No modo visitante, o save v2 local continua sendo a fonte de verdade até a conta ser conectada."}</p></div>
    </section>
  );
}
