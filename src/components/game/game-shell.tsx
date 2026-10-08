"use client";

import { Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURES, REGIONS } from "@/game/catalog";
import { ARPG_ABILITY_CARD_IDS } from "@/game/arpg/content/ability-cards";
import {
  getLegendAppearance,
  getLegendSignatureAbilityIds,
  legendInventoryKey,
  PLAYABLE_LEGEND_BY_ID,
  type PlayableLegendId,
} from "@/game/arpg/content/legends";
import { ARPG_MERCHANT_PRODUCT_BY_KEY } from "@/game/arpg/content/merchant-catalog";
import {
  DEFAULT_ARPG_EXPEDITION_ID,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";
import {
  getArpgExpeditionForAtlasRegion,
  resolveAtlasEncounterTarget,
  type AtlasEncounterReference,
} from "@/game/arpg/content/atlas-encounters";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { normalizeLegacyArpgLoadout } from "@/game/arpg/domain/loadout-schema";
import {
  ARPG_INVENTORY_ITEM_IDS,
  getOwnedPlayableLegendIds,
  normalizeArpgLoadoutOwnership,
} from "@/game/arpg/domain/ownership";
import { resolveHubNavigation } from "@/game/arpg/hub/navigation";
import { ARPG_RELIC_BY_ID } from "@/game/arpg/content/relics";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import type { GridPoint } from "@/game/exploration/pathfinding";
import type { PlayerBootstrap } from "@/game/player";
import type { RefugeSavePayload } from "@/game/refuge";
import type { BattleEncounter, EnergyPool, RegionAreaDefinition, RegionDefinition } from "@/game/types";
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_LOCAL_PROGRESS,
  loadLocalProgress,
  saveLocalProgress,
  type AvatarConfig,
} from "@/game/save/local-progress";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { connectNativeApp, NATIVE_BACK_EVENT, setNativeLandscape } from "@/lib/native-app";
import { ArpgExpeditionSelect } from "@/components/arpg/expedition-select";
import { ArpgLoadoutView, type ArpgLoadoutFocus } from "@/components/arpg/loadout-view";
import { CollectionView } from "./collection-view";
import { GameMenu, type GameMenuAction } from "./game-menu";
import { RefugeView } from "./refuge-view";
import { RaidView } from "./raid-view";
import { ProfileView } from "./profile-view";
import { VillageView } from "./village-view";
import { WorldMap } from "./world-map";
import { WelcomeView } from "./welcome-view";
import { TitleScreen } from "./title-screen";
import { runAfterPersistingLoadout } from "./loadout-navigation";

const ArpgRaidArena = dynamic(
  () => import("@/components/arpg/arpg-raid-arena").then((module) => module.ArpgRaidArena),
  {
    ssr: false,
    loading: () => <div className="battle-loading">Preparando a Raid ARPG...</div>,
  },
);

const ArpgGame = dynamic(
  () => import("@/components/arpg/arpg-game").then((module) => module.ArpgGame),
  { ssr: false, loading: () => <div className="battle-loading">Carregando Folklard...</div> },
);

const ArpgHub = dynamic(
  () => import("@/components/arpg/arpg-hub").then((module) => module.ArpgHub),
  { ssr: false, loading: () => <div className="battle-loading">Abrindo a Guilda dos Cartógrafos...</div> },
);

type View = "hub" | "expeditions" | "play" | "map" | "village" | "collection" | "loadout" | "refuge" | "raid" | "profile";

function readArpgLoadout(storageKey: string): ArpgLoadout {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_ARPG_LOADOUT;
    return normalizeLegacyArpgLoadout(JSON.parse(raw), DEFAULT_ARPG_LOADOUT);
  } catch {
    return DEFAULT_ARPG_LOADOUT;
  }
}

function readLegacyArpgAbilityIds(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { abilityIds?: unknown };
    if (!Array.isArray(parsed.abilityIds) || parsed.abilityIds.length <= 2) return [];
    return [...new Set(parsed.abilityIds.filter(
      (id): id is string => typeof id === "string" && ARPG_ABILITY_CARD_IDS.has(id),
    ))];
  } catch {
    return [];
  }
}

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
  const [titleOpen, setTitleOpen] = useState(true);
  const [view, setView] = useState<View>("hub");
  const [loadoutFocus, setLoadoutFocus] = useState<ArpgLoadoutFocus>("all");
  const [focusedLegendId, setFocusedLegendId] = useState<PlayableLegendId | null>(null);
  const [pendingLegendId, setPendingLegendId] = useState<PlayableLegendId | null>(null);
  const [villageReturnView, setVillageReturnView] = useState<"map" | "hub">("map");
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<ArpgExpeditionId>(DEFAULT_ARPG_EXPEDITION_ID);
  const [selectedAtlasEncounter, setSelectedAtlasEncounter] = useState<AtlasEncounterReference | null>(null);
  const [playReturnView, setPlayReturnView] = useState<"hub" | "map">("hub");
  const [guestPreview, setGuestPreview] = useState(false);
  const initialRegion = REGIONS.find(
    (region) => region.id === remoteSnapshot?.world.currentRegionId,
  ) ?? REGIONS[0];
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition | null>(initialRegion);
  const [playerRegionId, setPlayerRegionId] = useState(initialRegion.id);
  const [raidRoomId, setRaidRoomId] = useState<string | null>(null);
  const [dismissedRaidRoomId, setDismissedRaidRoomId] = useState<string | null>(null);
  const [coins, setCoins] = useState(remoteSnapshot?.profile.coins ?? DEFAULT_LOCAL_PROGRESS.coins);
  const [xp, setXp] = useState(remoteSnapshot?.profile.xp ?? DEFAULT_LOCAL_PROGRESS.xp);
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
  const avatarSavePending = useRef(false);
  const [localRefuge, setLocalRefuge] = useState<RefugeSavePayload>(DEFAULT_LOCAL_PROGRESS.refuge);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(() => {
    const remoteArpgItems = remoteSnapshot?.inventory
      .filter((item) => item.quantity > 0 && ARPG_INVENTORY_ITEM_IDS.has(item.itemKey))
      .map((item) => item.itemKey) ?? [];
    return [...new Set(remoteArpgItems)];
  });
  const ownedLegendIds = getOwnedPlayableLegendIds(equipmentIds);
  const activeLegendId = ownedLegendIds.includes(avatar.legendId) ? avatar.legendId : "curupira";
  const [arpgLoadout, setArpgLoadout] = useState<ArpgLoadout>(() => normalizeArpgLoadoutOwnership(
    remoteSnapshot?.arpgLoadout ?? DEFAULT_ARPG_LOADOUT,
    equipmentIds,
    activeLegendId,
  ));
  const [arpgLoadoutDirty, setArpgLoadoutDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newlyOwnedCatalogIds, setNewlyOwnedCatalogIds] = useState<string[]>([]);
  const [openedTreasures, setOpenedTreasures] = useState<string[]>(
    remoteSnapshot?.world.openedTreasures ?? [],
  );
  const [progressLoaded, setProgressLoaded] = useState(bootstrap.source === "supabase");
  const cacheAccountId = bootstrap.identity?.id ?? null;
  const arpgLoadoutStorageKey = `card-realms-arpg-loadout-v1:${cacheAccountId ?? "guest"}`;
  const playableArpgLoadout = useMemo(
    () => normalizeArpgLoadoutOwnership(arpgLoadout, equipmentIds, activeLegendId),
    [activeLegendId, arpgLoadout, equipmentIds],
  );

  useEffect(() => {
    if (bootstrap.source === "supabase") return;
    try {
      const parsed = loadLocalProgress(window.localStorage, cacheAccountId);
      setCoins(parsed.coins);
      setXp(parsed.xp);
      setOpenedTreasures(parsed.openedTreasures);
      setCurrentAreaId(parsed.currentAreaId);
      setVisitedAreaIds(parsed.visitedAreaIds);
      setMapPositions(parsed.mapPositions);
      setEnergy(parsed.energy);
      const legacyArpgCards = readLegacyArpgAbilityIds(arpgLoadoutStorageKey);
      const savedEquipmentIds = [...new Set([...parsed.equipmentIds, ...legacyArpgCards])];
      const savedLegendIds = getOwnedPlayableLegendIds(savedEquipmentIds);
      const savedLegendId = savedLegendIds.includes(parsed.avatar.legendId) ? parsed.avatar.legendId : "curupira";
      setAvatar({ ...parsed.avatar, legendId: savedLegendId });
      setEquipmentIds(savedEquipmentIds);
      setArpgLoadout(normalizeArpgLoadoutOwnership(
        readArpgLoadout(arpgLoadoutStorageKey),
        savedEquipmentIds,
        savedLegendId,
      ));
      setLocalRefuge(parsed.refuge);
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
  }, [arpgLoadoutStorageKey, bootstrap.source, cacheAccountId]);

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
        refuge: localRefuge,
      }, cacheAccountId);
    } catch (error) {
      console.error("Não foi possível salvar o progresso local.", error);
    }
  }, [avatar, cacheAccountId, coins, currentAreaId, energy, equipmentIds, localRefuge, mapPositions, openedTreasures, playerRegionId, progressLoaded, visitedAreaIds, xp]);

  useEffect(() => {
    if (!progressLoaded) return;
    try {
      window.localStorage.setItem(arpgLoadoutStorageKey, JSON.stringify(playableArpgLoadout));
    } catch (error) {
      console.warn("Não foi possível salvar o loadout ARPG localmente.", error);
    }
  }, [arpgLoadoutStorageKey, playableArpgLoadout, progressLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openLoadoutFocus = (
    focus: Exclude<ArpgLoadoutFocus, "all">,
    focusLegendId: PlayableLegendId | null = null,
  ) => {
    setLoadoutFocus(focus);
    setFocusedLegendId(focusLegendId);
    setView("loadout");
  };

  const handleArpgLoadoutChange = useCallback((next: ArpgLoadout, legendId = activeLegendId) => {
    setArpgLoadout(normalizeArpgLoadoutOwnership(next, equipmentIds, legendId));
    setArpgLoadoutDirty(true);
  }, [activeLegendId, equipmentIds]);

  const persistArpgLoadout = useCallback(async (force = false) => {
    if (avatarSavePending.current) {
      setToast("Aguarde a confirmação da Lenda escolhida antes de continuar.");
      return false;
    }
    if (bootstrap.source !== "supabase" || (!arpgLoadoutDirty && !force)) return true;
    try {
      const response = await fetch("/api/arpg/loadout", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(playableArpgLoadout),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar o Arsenal.");
      setArpgLoadoutDirty(false);
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Não foi possível salvar o Arsenal.");
      return false;
    }
  }, [arpgLoadoutDirty, bootstrap.source, playableArpgLoadout]);

  const navigate = async (next: View) => {
    const requiresRemoteLoadout = next === "raid";
    await runAfterPersistingLoadout(
      next !== "loadout" && (arpgLoadoutDirty || requiresRemoteLoadout),
      () => persistArpgLoadout(requiresRemoteLoadout),
      () => {
        if (next === "loadout") setLoadoutFocus("all");
        setView(next);
      },
    );
  };

  const handleBackToHub = async () => {
    if (!await persistArpgLoadout()) return;
    setView("hub");
  };

  const handleStartArpg = async (expeditionId: ArpgExpeditionId = selectedExpeditionId) => {
    if (!await persistArpgLoadout(true)) return;
    setSelectedAtlasEncounter(null);
    setSelectedExpeditionId(expeditionId);
    setPlayReturnView("hub");
    setView("play");
  };

  const handleBattle = async (encounter: BattleEncounter) => {
    const expeditionId = getArpgExpeditionForAtlasRegion(encounter.regionId);
    if (!expeditionId) {
      setToast("Ainda não há uma expedição de ação para esta região.");
      return;
    }
    const atlasEncounter: AtlasEncounterReference | null = encounter.kind === "wild"
      ? { kind: "wild", regionId: encounter.regionId, id: encounter.creatureId }
      : encounter.kind === "npc"
        ? { kind: "npc", regionId: encounter.regionId, id: encounter.npcId }
        : null;
    if (atlasEncounter && !resolveAtlasEncounterTarget(atlasEncounter)) {
      setToast("Este alvo não pertence ao Atlas desta região.");
      return;
    }
    if (!await persistArpgLoadout(true)) return;
    setSelectedExpeditionId(expeditionId);
    setSelectedAtlasEncounter(atlasEncounter);
    setPlayReturnView("map");
    setView("play");
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
        if (result.itemKey && ARPG_INVENTORY_ITEM_IDS.has(result.itemKey)) {
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
      roots: "forest-bow",
      runic: "runic-sabre",
    };
    const equipment = equipmentByRegion[region.id];
    if (equipment) setEquipmentIds((current) => [...new Set([...current, equipment])]);
    setToast(
      bootstrap.source === "supabase-unavailable"
        ? "Baú salvo somente no cache; a conta remota está indisponível."
        : `Baú cartográfico encontrado: +45 moedas e 1 fragmento de vínculo${equipment ? " · nova arma" : ""}.`,
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

  const handleBuyMerchantItem = async (itemKey: string) => {
    const product = ARPG_MERCHANT_PRODUCT_BY_KEY.get(itemKey);
    if (!product) {
      setToast("Este item não está disponível no catálogo.");
      return;
    }
    if (equipmentIds.some((ownedItemKey) => ownedItemKey === itemKey)) {
      setToast("Você já possui este item.");
      return;
    }
    if (coins < product.price) {
      setToast("Moedas insuficientes para esta compra.");
      return;
    }

    if (bootstrap.source === "supabase") {
      try {
        const result = await mutateRemoteProgress({ action: "buy_merchant_item", itemKey }) as {
          coins: number;
          itemKey: string;
          quantity: number;
        };
        setCoins(result.coins);
        setEquipmentIds((current) => [...new Set([...current, result.itemKey])]);
        setToast(product.category === "cosmetic"
          ? `${product.name} desbloqueado para o Refúgio.`
          : `${product.name} desbloqueado no Arsenal.`);
      } catch (error) {
        setToast(error instanceof Error ? error.message : "A compra não pôde ser concluída.");
      }
      return;
    }

    setCoins((current) => current - product.price);
    setEquipmentIds((current) => [...new Set([...current, itemKey])]);
    setToast(product.category === "cosmetic"
      ? `${product.name} desbloqueado para o Refúgio.`
      : `${product.name} desbloqueado no Arsenal.`);
  };

  const handleSaveAvatar = async (nextAvatar: AvatarConfig) => {
    if (avatarSavePending.current) return false;
    avatarSavePending.current = true;
    try {
      if (bootstrap.source === "supabase") {
        const response = await fetch("/api/player/avatar", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextAvatar),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "O personagem não pôde ser salvo.");
      }
      setAvatar(nextAvatar);
      return true;
    } finally {
      avatarSavePending.current = false;
    }
  };

  const handleSelectLegend = async (legendId: PlayableLegendId) => {
    const legend = PLAYABLE_LEGEND_BY_ID.get(legendId);
    if (!legend || !ownedLegendIds.includes(legendId)) return;
    const nextAvatar: AvatarConfig = {
      ...avatar,
      ...getLegendAppearance(legendId),
      favoriteLegendId: avatar.favoriteLegendId,
    };
    const nextLoadout = {
      ...playableArpgLoadout,
      abilityIds: getLegendSignatureAbilityIds(legendId),
    };
    try {
      if (!await handleSaveAvatar(nextAvatar)) return;
      handleArpgLoadoutChange(nextLoadout, legendId);
      setToast(`${legend.name} foi escolhida para as próximas aventuras. Você poderá trocar na Guilda quando quiser.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "A Lenda escolhida não pôde ser salva.");
    }
  };

  const handleToggleFavoriteLegend = async (legendId: PlayableLegendId) => {
    if (!ownedLegendIds.includes(legendId)) return;
    const nextAvatar: AvatarConfig = {
      ...avatar,
      favoriteLegendId: avatar.favoriteLegendId === legendId ? null : legendId,
    };
    try {
      if (!await handleSaveAvatar(nextAvatar)) return;
      setToast(nextAvatar.favoriteLegendId
        ? `${PLAYABLE_LEGEND_BY_ID.get(legendId)?.name ?? "Lenda"} agora aparece como sua favorita no perfil.`
        : "Lenda favorita removida do perfil.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "A Lenda favorita não pôde ser salva.");
    }
  };

  const handlePurchaseLegend = async (legendId: PlayableLegendId) => {
    const legend = PLAYABLE_LEGEND_BY_ID.get(legendId);
    if (!legend || legend.price <= 0) return;
    if (ownedLegendIds.includes(legendId)) return;
    if (coins < legend.price) {
      setToast("Moedas insuficientes para esta lenda.");
      return;
    }

    setPendingLegendId(legendId);
    try {
      if (bootstrap.source === "supabase") {
      const response = await fetch("/api/player/legends/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ legendId }),
        });
        const payload = await response.json() as {
          coins?: number;
          itemKey?: string;
          signatureAbilityIds?: string[];
          ownedAbilityIds?: string[];
          error?: string;
        };
        if (
          !response.ok
          || typeof payload.coins !== "number"
          || payload.itemKey !== legendInventoryKey(legendId)
          || !Array.isArray(payload.signatureAbilityIds)
          || payload.signatureAbilityIds[0] !== legend.signatureAbilityIds[0]
          || payload.signatureAbilityIds[1] !== legend.signatureAbilityIds[1]
        ) {
          throw new Error(payload.error ?? "A compra da lenda não pôde ser concluída.");
        }
        setCoins(payload.coins);
        setEquipmentIds((current) => [...new Set([
          ...current,
          legendInventoryKey(legendId),
          ...(payload.ownedAbilityIds ?? legend.signatureAbilityIds),
        ])]);
      } else {
        setCoins((current) => current - legend.price);
        setEquipmentIds((current) => [...new Set([
          ...current,
          legendInventoryKey(legendId),
          ...legend.signatureAbilityIds,
        ])]);
      }
      setToast(`${legend.name} desbloqueada. Os dois ataques dela também foram adicionados.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "A compra da lenda não pôde ser concluída.");
    } finally {
      setPendingLegendId(null);
    }
  };

  const handleSaveRefuge = async (payload: RefugeSavePayload) => {
    if (bootstrap.source === "supabase") {
      await mutateRemoteProgress({ action: "save_refuge", ...payload });
      setToast("Refúgio sincronizado com sua conta.");
      router.refresh();
      return;
    }
    setLocalRefuge(payload);
    setToast(bootstrap.source === "supabase-unavailable"
      ? "Refúgio salvo neste aparelho enquanto a conta está indisponível."
      : "Refúgio salvo neste aparelho.");
  };

  const activeAvatar = useMemo(() => ({
    ...avatar,
    ...getLegendAppearance(activeLegendId),
    favoriteLegendId: avatar.favoriteLegendId,
  }), [activeLegendId, avatar]);
  const ownedCatalogIds = useMemo(() => remoteSnapshot
    ? [...new Set([
      ...remoteSnapshot.collection.map((creature) => creature.catalogId),
      ...newlyOwnedCatalogIds,
    ])]
    : undefined, [newlyOwnedCatalogIds, remoteSnapshot]);
  const visibleOwnedCatalogIds = useMemo(
    () => ownedCatalogIds ?? (bootstrap.identity ? [] : undefined),
    [bootstrap.identity, ownedCatalogIds],
  );
  const playerLevel = remoteSnapshot?.profile.level ?? Math.max(1, Math.floor(xp / 600) + 1);
  const playerName = remoteSnapshot?.profile.displayName
    ?? bootstrap.identity?.email?.split("@")[0]
    ?? "Explorador";
  const discoveredByRegion = useMemo(() => {
    const visibleIds = new Set(visibleOwnedCatalogIds ?? CREATURES.map((creature) => creature.id));
    return Object.fromEntries(REGIONS.map((region) => [
      region.id,
      CREATURES.filter((creature) => creature.regionId === region.id && visibleIds.has(creature.id)).length,
    ]));
  }, [visibleOwnedCatalogIds]);
  const showWelcome = isSupabaseConfigured() && !bootstrap.identity && !guestPreview;
  const beginTitleMode = (nextView: View) => {
    if (showWelcome) setGuestPreview(true);
    setTitleOpen(false);
    if (nextView !== "hub") void navigate(nextView);
  };

  const handleGameMenuAction = (action: GameMenuAction) => {
    if (action === "powers") {
      openLoadoutFocus("cards");
      return;
    }
    if (action === "appearance") {
      openLoadoutFocus("legend");
      return;
    }
    const destination: Record<Exclude<GameMenuAction, "powers" | "appearance">, View> = {
      lobby: "hub",
      expeditions: "expeditions",
      arsenal: "loadout",
      bestiary: "collection",
      refuge: "refuge",
      cooperative: "raid",
      profile: "profile",
    };
    void navigate(destination[action]);
  };

  useEffect(() => connectNativeApp(), []);
  useEffect(() => {
    void setNativeLandscape(!titleOpen && (view === "play" || Boolean(raidRoomId)));
    return () => { void setNativeLandscape(false); };
  }, [titleOpen, view, raidRoomId]);

  useEffect(() => {
    const onBack = (event: Event) => {
      if (event.defaultPrevented || titleOpen) return;
      event.preventDefault();
      if (view === "play") return; // The dungeon handles map/pause without abandoning the run.
      if (raidRoomId) {
        setToast("Use Sair da raid para encerrar sua participação.");
      } else if (view === "hub") {
        setTitleOpen(true);
      } else {
        void runAfterPersistingLoadout(arpgLoadoutDirty, () => persistArpgLoadout(), () => setView("hub"));
      }
    };
    window.addEventListener(NATIVE_BACK_EVENT, onBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, onBack);
  }, [titleOpen, view, raidRoomId, arpgLoadoutDirty, persistArpgLoadout]);

  return (
    <main className={cn("game-app", showWelcome && "game-app--welcome", titleOpen && "game-app--title")}>
      {titleOpen ? (
        <TitleScreen
          loginEnabled={isSupabaseConfigured()}
          signedIn={Boolean(bootstrap.identity)}
          onPlay={() => beginTitleMode("hub")}
          onCooperative={() => beginTitleMode("raid")}
        />
      ) : null}

      {!titleOpen ? <div className={cn("app-content", !showWelcome && "app-content--game", showWelcome && "app-content--welcome")}>
        {showWelcome ? <WelcomeView onPreview={() => setGuestPreview(true)} /> : null}
        {!showWelcome && view === "hub" ? (
            <ArpgHub
            playerName={playerName}
            level={playerLevel}
            coins={coins}
            avatarConfig={activeAvatar}
            onNavigate={(destination, legendId) => {
              const action = resolveHubNavigation(destination);
              if (action.kind === "loadout-focus") {
                openLoadoutFocus(action.focus, legendId ?? null);
                if (legendId && ownedLegendIds.includes(legendId)) void handleSelectLegend(legendId);
                return;
              }
              if (action.view === "village") setVillageReturnView("hub");
              if (action.toast) setToast(action.toast);
              void navigate(action.view);
            }}
          />
        ) : null}
        {!showWelcome && view === "expeditions" ? (
          <ArpgExpeditionSelect onSelect={(id) => void handleStartArpg(id)} />
        ) : null}
        {!showWelcome && view === "play" ? (
          <ArpgGame
            loadout={playableArpgLoadout}
            avatarConfig={activeAvatar}
            expeditionId={selectedExpeditionId}
            atlasEncounter={selectedAtlasEncounter}
            exitLabel={playReturnView === "map" ? "Voltar ao Atlas" : "Voltar à Guilda"}
            onExit={() => navigate(playReturnView)}
            onRunComplete={(state, extraction) => {
              const newItems = extraction?.reward.newItems ?? [];
              const runLootItems = extraction?.reward.runLootItems ?? [];
              const localVictoryReward = bootstrap.source !== "supabase"
                && state.victory
                && extraction
                && !extraction.persisted
                && !extraction.reward.replayed
                ? extraction.reward
                : null;
              if (localVictoryReward) {
                setCoins((current) => current + localVictoryReward.coins);
                setXp((current) => current + localVictoryReward.xp);
              }
              if (extraction?.persisted && !extraction.reward.replayed) {
                setCoins((current) => current + extraction.reward.coins);
                setXp((current) => current + extraction.reward.xp);
                setEquipmentIds((current) => [...new Set([
                  ...current,
                  ...extraction.reward.items.filter((itemKey) => ARPG_INVENTORY_ITEM_IDS.has(itemKey)),
                ])]);
              }
              if (extraction?.persisted && (newItems.length > 0 || runLootItems.length > 0)) {
                setEquipmentIds((current) => [...new Set([
                  ...current,
                  ...[...newItems, ...runLootItems].filter((itemKey) => ARPG_INVENTORY_ITEM_IDS.has(itemKey)),
                ])]);
              }
              if (bootstrap.source === "supabase" && extraction?.persisted) router.refresh();
              const unlockedRelic = newItems
                .map((id) => ARPG_RELIC_BY_ID.get(id))
                .find(Boolean);
              setToast(
                unlockedRelic
                    ? `Nova relíquia desbloqueada: ${unlockedRelic.name}. Já pode ser equipada no Arsenal.`
                    : extraction?.persisted && runLootItems.length > 0
                      ? `Extração registrada: ${runLootItems.length} equipamento(s) da run enviados ao Arsenal.`
                      : extraction?.persisted
                        ? extraction.reward.replayed
                          ? "A primeira recompensa desta expedição já havia sido extraída nesta conta."
                          : `Extração registrada: +${extraction.reward.coins} moedas e +${extraction.reward.xp} XP.`
                        : localVictoryReward
                          ? `Vitória local: +${localVictoryReward.coins} moedas e +${localVictoryReward.xp} XP.`
                          : state.victory
                            ? `Run concluída: ${state.xpEarned} XP de expedição local.`
                            : `Expedição encerrada na sala ${state.room}.`,
              );
            }}
          />
        ) : null}
        {!showWelcome && view === "map" ? (
          <WorldMap
            selected={selectedRegion}
            playerRegionId={playerRegionId}
            currentAreaId={currentAreaId}
            visitedAreaIds={visitedAreaIds}
            openedTreasures={openedTreasures}
            avatar={activeAvatar}
            mapPositions={mapPositions}
            discoveredByRegion={discoveredByRegion}
            onlineParty={bootstrap.source === "supabase"}
            playerId={bootstrap.identity?.id}
            playerName={remoteSnapshot?.profile.displayName ?? bootstrap.identity?.email?.split("@")[0] ?? "Visitante"}
            onSelect={setSelectedRegion}
            onTravel={handleTravel}
            onVisitArea={handleVisitArea}
            onBattle={handleBattle}
            onTreasure={handleTreasure}
            onPositionChange={handlePositionChange}
            onOpenVillage={() => {
              setVillageReturnView("map");
              navigate("village");
            }}
          />
        ) : null}
        {!showWelcome && view === "village" ? (
          <VillageView
            coins={coins}
            ownedItemKeys={equipmentIds}
            onBack={() => navigate(villageReturnView)}
            backLabel={villageReturnView === "hub" ? "Voltar à Guilda" : "Voltar ao Atlas"}
            onBuyItem={handleBuyMerchantItem}
          />
        ) : null}
        {!showWelcome && view === "collection" ? (
          <CollectionView />
        ) : null}
        {!showWelcome && view === "loadout" ? (
          <ArpgLoadoutView
            focus={loadoutFocus}
            focusLegendId={focusedLegendId}
            loadout={playableArpgLoadout}
            inventoryItemKeys={equipmentIds}
            ownedLegendIds={ownedLegendIds}
            coins={coins}
            avatarConfig={activeAvatar}
            pendingLegendId={pendingLegendId}
            onChange={handleArpgLoadoutChange}
            onSelectLegend={handleSelectLegend}
            onPurchaseLegend={handlePurchaseLegend}
            onToggleFavoriteLegend={handleToggleFavoriteLegend}
            onBack={() => void handleBackToHub()}
            onPlay={() => navigate("expeditions")}
          />
        ) : null}
        {!showWelcome && view === "refuge" ? (
          <RefugeView
            avatarConfig={activeAvatar}
            ownedItemKeys={equipmentIds}
            house={remoteSnapshot?.house ?? null}
            savedLayout={bootstrap.source === "supabase" ? undefined : localRefuge}
            source={bootstrap.source}
            onSave={handleSaveRefuge}
          />
        ) : null}
        {!showWelcome && view === "raid" ? (
          <RaidView
            bootstrap={bootstrap}
            dismissedRoomId={dismissedRaidRoomId}
            onDismissRaid={setDismissedRaidRoomId}
            onOpenRaid={(roomId, mode) => {
              if (mode !== "arpg") {
                setToast("A Raid de cartas foi desativada. Use uma dungeon cooperativa.");
                return;
              }
              setDismissedRaidRoomId(null);
              setRaidRoomId(roomId);
            }}
          />
        ) : null}
        {!showWelcome && view === "profile" ? (
          <ProfileView
            coins={coins}
            xp={xp}
            level={playerLevel}
            collectionCount={visibleOwnedCatalogIds?.length ?? CREATURES.length}
            source={bootstrap.source}
            snapshot={remoteSnapshot}
            avatar={activeAvatar}
          />
        ) : null}
      </div> : null}

      {!showWelcome && !titleOpen && view !== "play" && !raidRoomId ? (
        <GameMenu
          currentView={view === "hub" ? "hub" : "other"}
          playerName={playerName}
          level={playerLevel}
          coins={coins}
          onNavigate={handleGameMenuAction}
        />
      ) : null}

      {toast ? <div className="game-toast" role="status" aria-live="polite"><Trophy /> {toast}</div> : null}
      {raidRoomId && bootstrap.identity ? (
        <div className="battle-overlay raid-overlay">
          <ArpgRaidArena
            roomId={raidRoomId}
            playerId={bootstrap.identity.id}
            onClose={() => {
              setDismissedRaidRoomId(raidRoomId);
              setRaidRoomId(null);
              if (bootstrap.source === "supabase") router.refresh();
            }}
          />
        </div>
      ) : null}
    </main>
  );
}

