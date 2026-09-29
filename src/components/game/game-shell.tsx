"use client";

import {
  Album,
  Coins,
  Home,
  LayoutDashboard,
  Layers3,
  Map,
  ShieldCheck,
  Swords,
  Trophy,
  UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CREATURES, REGIONS } from "@/game/catalog";
import type { GridPoint } from "@/game/exploration/pathfinding";
import type { PlayerBootstrap } from "@/game/player";
import type { BattleReward, Element, EnergyPool, RegionAreaDefinition, RegionDefinition } from "@/game/types";
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_LOCAL_PROGRESS,
  loadLocalProgress,
  saveLocalProgress,
  type AvatarConfig,
} from "@/game/save/local-progress";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { CollectionView } from "./collection-view";
import { HubView } from "./hub-view";
import { RefugeView } from "./refuge-view";
import { PvpView } from "./pvp-view";
import { ProfileView } from "./profile-view";
import { TeamView } from "./team-view";
import { VillageView } from "./village-view";
import { WorldMap } from "./world-map";
import { StarterChoice } from "./starter-choice";
import { WelcomeView } from "./welcome-view";

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

type View = "hub" | "map" | "village" | "collection" | "team" | "refuge" | "pvp" | "profile";

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
  const router = useRouter();
  const remoteSnapshot = bootstrap.snapshot;
  const [view, setView] = useState<View>("hub");
  const [guestPreview, setGuestPreview] = useState(false);
  const initialRegion = REGIONS.find(
    (region) => region.id === remoteSnapshot?.world.currentRegionId,
  ) ?? REGIONS[0];
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition | null>(initialRegion);
  const [playerRegionId, setPlayerRegionId] = useState(initialRegion.id);
  const [battleOpen, setBattleOpen] = useState(false);
  const [pvpBattleId, setPvpBattleId] = useState<string | null>(null);
  const [coins, setCoins] = useState(remoteSnapshot?.profile.coins ?? 840);
  const [xp, setXp] = useState(remoteSnapshot?.profile.xp ?? 1240);
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(
    remoteSnapshot?.world.currentAreaId ?? initialRegion.areas?.[0]?.id ?? null,
  );
  const [visitedAreaIds, setVisitedAreaIds] = useState<string[]>(
    remoteSnapshot?.world.visitedAreaIds ?? (initialRegion.areas?.[0] ? [initialRegion.areas[0].id] : []),
  );
  const [mapPositions, setMapPositions] = useState<Record<string, GridPoint>>(
    remoteSnapshot?.world.mapPositions ?? {},
  );
  const [energy, setEnergy] = useState<EnergyPool>(remoteSnapshot?.energy ?? DEFAULT_LOCAL_PROGRESS.energy);
  const [avatar, setAvatar] = useState<AvatarConfig>(remoteSnapshot?.profile.avatarConfig ?? DEFAULT_AVATAR_CONFIG);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(() => {
    const remoteEquipment = remoteSnapshot?.inventory
      .filter((item) => item.itemKey.endsWith("-armor") || item.itemKey === "leather")
      .map((item) => item.itemKey) ?? [];
    return [...new Set(["leather", ...remoteEquipment])];
  });
  const [toast, setToast] = useState<string | null>(null);
  const [newlyOwnedCatalogIds, setNewlyOwnedCatalogIds] = useState<string[]>([]);
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
      setCurrentAreaId(parsed.currentAreaId);
      setVisitedAreaIds(parsed.visitedAreaIds);
      setMapPositions(parsed.mapPositions);
      setEnergy(parsed.energy);
      setAvatar(parsed.avatar);
      setEquipmentIds(parsed.equipmentIds);
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
        version: 4,
        coins,
        xp,
        openedTreasures,
        playerRegionId,
        currentAreaId,
        visitedAreaIds,
        mapPositions,
        energy,
        equipmentIds,
        avatar,
      });
    } catch (error) {
      console.error("Não foi possível salvar o progresso local.", error);
    }
  }, [avatar, coins, currentAreaId, energy, equipmentIds, mapPositions, openedTreasures, playerRegionId, progressLoaded, visitedAreaIds, xp]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (next: View) => {
    setView(next);
  };

  const handleBattle = () => {
    setToast(null);
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
          creatureId?: string;
          itemKey?: string;
        };
        setOpenedTreasures(result.openedTreasures);
        setCoins(result.coins);
        if (result.creatureId) {
          setNewlyOwnedCatalogIds((current) => [...new Set([...current, result.creatureId!])]);
        }
        if (result.itemKey) {
          setEquipmentIds((current) => [...new Set([...current, result.itemKey!])]);
        }
        const cardName = result.creatureId
          ? CREATURES.find((creature) => creature.id === result.creatureId)?.name
          : null;
        setToast(cardName
          ? `Baú aberto: +45 moedas, fragmento${result.itemKey ? ", equipamento" : ""} e a carta ${cardName}.`
          : "Tesouro confirmado pelo servidor: +45 moedas e 1 fragmento de vínculo.");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Não foi possível recolher o tesouro.");
      }
      return;
    }

    setOpenedTreasures((current) => [...current, region.id]);
    setCoins((current) => current + 45);
    const equipmentByRegion: Partial<Record<string, string>> = {
      roots: "guardian-armor",
      runic: "runic-armor",
    };
    const equipment = equipmentByRegion[region.id];
    if (equipment) setEquipmentIds((current) => [...new Set([...current, equipment])]);
    setToast(
      bootstrap.source === "supabase-unavailable"
        ? "Baú salvo somente no cache; a conta remota está indisponível."
        : `Baú cartográfico encontrado: +45 moedas e 1 fragmento de vínculo${equipment ? " · nova armadura" : ""}.`,
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
    const firstArea = region.areas?.[0]?.id ?? null;
    setCurrentAreaId(firstArea);
    if (firstArea) setVisitedAreaIds((current) => [...new Set([...current, firstArea])]);
    setToast(
      bootstrap.source === "supabase-unavailable"
        ? `Você chegou a ${region.name}; posição mantida apenas no cache.`
        : `Você chegou a ${region.name}.`,
    );
  };

  const handleVisitArea = (region: RegionDefinition, area: RegionAreaDefinition) => {
    setCurrentAreaId(area.id);
    setVisitedAreaIds((current) => [...new Set([...current, area.id])]);
    if (bootstrap.source === "supabase") {
      void mutateRemoteProgress({ action: "visit_area", regionId: region.id, areaId: area.id })
        .catch((error) => setToast(error instanceof Error ? error.message : "A área não pôde ser sincronizada."));
    }
    setToast(`Você entrou em ${area.name}.`);
  };

  const handlePositionChange = (region: RegionDefinition, point: GridPoint) => {
    setMapPositions((current) => ({ ...current, [region.id]: point }));
    if (bootstrap.source === "supabase") {
      void mutateRemoteProgress({
        action: "save_position",
        regionId: region.id,
        x: point.x,
        y: point.y,
      }).catch((error) => setToast(error instanceof Error ? error.message : "A posição não pôde ser sincronizada."));
    }
  };

  const handleBuyEnergy = async (element: Element, quantity: 1 | 5, price: number) => {
    if (coins < price) {
      setToast("Moedas insuficientes para este pacote.");
      return;
    }
    if (bootstrap.source === "supabase") {
      try {
        const result = await mutateRemoteProgress({ action: "buy_energy", element, quantity }) as {
          coins: number;
          energy: EnergyPool;
        };
        setCoins(result.coins);
        setEnergy(result.energy);
        setToast(`${quantity} energia(s) adicionada(s) ao inventário.`);
      } catch (error) {
        setToast(error instanceof Error ? error.message : "A compra não pôde ser concluída.");
      }
      return;
    }
    setCoins((current) => current - price);
    setEnergy((current) => ({ ...current, [element]: current[element] + quantity }));
    setToast(`${quantity} energia(s) comprada(s) na Vila Cartógrafa.`);
  };

  const handleSaveAvatar = async (nextAvatar: AvatarConfig) => {
    setAvatar(nextAvatar);
    if (bootstrap.source !== "supabase") return;
    const response = await fetch("/api/player/avatar", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextAvatar),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "O personagem não pôde ser salvo.");
    setToast("Personagem sincronizado com sua conta.");
  };

  const handleVictory = useCallback((reward?: BattleReward) => {
    if (bootstrap.source === "supabase") {
      if (reward && !reward.replayed) {
        setCoins((current) => current + reward.coins);
        setXp((current) => current + reward.xp);
        setToast("Vitória registrada: moedas e experiência recebidas. Cartas de criatura são encontradas em baús.");
      }
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
  const ownedCatalogIds = useMemo(() => remoteSnapshot
    ? [...new Set([
      ...remoteSnapshot.collection.map((creature) => creature.catalogId),
      ...newlyOwnedCatalogIds,
    ])]
    : undefined, [newlyOwnedCatalogIds, remoteSnapshot]);
  const currentRegion = REGIONS.find((region) => region.id === playerRegionId) ?? REGIONS[0];
  const showWelcome = isSupabaseConfigured() && !bootstrap.identity && !guestPreview;
  const needsStarterChoice = bootstrap.source === "supabase"
    && Boolean(bootstrap.identity)
    && remoteSnapshot?.collection.length === 0;
  const pvpSession = useMemo(() => (
    pvpBattleId && bootstrap.identity
      ? { battleId: pvpBattleId, playerId: bootstrap.identity.id }
      : undefined
  ), [bootstrap.identity, pvpBattleId]);

  return (
    <main className={cn("game-app", showWelcome && "game-app--welcome")}>
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

      {!showWelcome ? <aside className="side-nav">
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
      </aside> : null}

      <div className={cn("app-content", showWelcome && "app-content--welcome")}>
        {showWelcome ? <WelcomeView onPreview={() => setGuestPreview(true)} /> : null}
        {!showWelcome && view === "hub" ? (
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
        {!showWelcome && view === "map" ? (
          <WorldMap
            selected={selectedRegion}
            playerRegionId={playerRegionId}
            currentAreaId={currentAreaId}
            visitedAreaIds={visitedAreaIds}
            openedTreasures={openedTreasures}
            avatar={avatar}
            mapPositions={mapPositions}
            onSelect={setSelectedRegion}
            onTravel={handleTravel}
            onVisitArea={handleVisitArea}
            onBattle={handleBattle}
            onTreasure={handleTreasure}
            onPositionChange={handlePositionChange}
            onOpenVillage={() => navigate("village")}
          />
        ) : null}
        {!showWelcome && view === "village" ? (
          <VillageView
            coins={coins}
            energy={energy}
            onBack={() => navigate("map")}
            onBuy={handleBuyEnergy}
          />
        ) : null}
        {!showWelcome && view === "collection" ? <CollectionView ownedCatalogIds={ownedCatalogIds} /> : null}
        {!showWelcome && view === "team" ? <TeamView teamIds={activeTeamIds} teamName={activeTeam?.name} /> : null}
        {!showWelcome && view === "refuge" ? <RefugeView /> : null}
        {!showWelcome && view === "pvp" ? <PvpView bootstrap={bootstrap} onOpenBattle={setPvpBattleId} /> : null}
        {!showWelcome && view === "profile" ? (
          <ProfileView
            coins={coins}
            xp={xp}
            source={bootstrap.source}
            snapshot={remoteSnapshot}
            avatar={avatar}
            equipmentIds={equipmentIds}
            onSaveAvatar={handleSaveAvatar}
          />
        ) : null}
      </div>

      {!showWelcome ? <nav className="mobile-nav" aria-label="Navegação principal">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={cn(view === item.id && "is-active")} onClick={() => navigate(item.id)}>
              <Icon /><span>{item.label}</span>
            </button>
          );
        })}
      </nav> : null}

      {toast ? <div className="game-toast" role="status" aria-live="polite"><Trophy /> {toast}</div> : null}
      {battleOpen || pvpSession ? (
        <div className="battle-overlay">
          <BattleArena
            open
            pvp={pvpSession}
            onClose={() => {
              setBattleOpen(false);
              setPvpBattleId(null);
              if (bootstrap.source === "supabase") router.refresh();
            }}
            onVictory={pvpSession ? () => undefined : handleVictory}
          />
        </div>
      ) : null}
      {needsStarterChoice ? <StarterChoice /> : null}
    </main>
  );
}

