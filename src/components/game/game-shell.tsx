"use client";

import {
  Album,
  Coins,
  Crown,
  Gamepad2,
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
import { ARPG_ABILITY_CARD_BY_ID, ARPG_ABILITY_CARD_IDS } from "@/game/arpg/content/ability-cards";
import { ARPG_ARMORS, ARPG_WEAPONS, getDefaultSecondaryArpgWeaponId } from "@/game/arpg/content/equipment";
import {
  ARPG_MERCHANT_PRODUCT_BY_KEY,
  ARPG_MERCHANT_PRODUCT_KEYS,
} from "@/game/arpg/content/merchant-catalog";
import {
  DEFAULT_ARPG_EXPEDITION_ID,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { getOwnedArpgAbilityCardIds } from "@/game/arpg/domain/powers";
import { normalizeLegacyArpgLoadout } from "@/game/arpg/domain/loadout-schema";
import { resolveHubNavigation } from "@/game/arpg/hub/navigation";
import { ARPG_RELIC_BY_ID, ARPG_RELIC_IDS, STARTER_ARPG_RELIC_ID } from "@/game/arpg/content/relics";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import type { GridPoint } from "@/game/exploration/pathfinding";
import type { PlayerBootstrap } from "@/game/player";
import type { RaidGameplayMode } from "@/game/raid";
import { resolveBattleBoard, type BattleBoardId } from "@/game/battle/presentation";
import type { RefugeSavePayload } from "@/game/refuge";
import type { BattleEncounter, BattleReward, Element, EnergyPool, RegionAreaDefinition, RegionDefinition } from "@/game/types";
import {
  DEFAULT_AVATAR_CONFIG,
  AvatarConfigSchema,
  DEFAULT_LOCAL_PROGRESS,
  loadLocalProgress,
  saveLocalProgress,
  type AvatarConfig,
} from "@/game/save/local-progress";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/auth/login-dialog";
import { ArpgExpeditionSelect } from "@/components/arpg/expedition-select";
import { ArpgLoadoutView, type ArpgLoadoutFocus } from "@/components/arpg/loadout-view";
import { ArpgPowerGacha } from "@/components/arpg/power-gacha";
import { Badge } from "@/components/ui/badge";
import { CollectionView } from "./collection-view";
import { HubView } from "./hub-view";
import { MissionPanel } from "./mission-panel";
import { RefugeView } from "./refuge-view";
import { PvpView } from "./pvp-view";
import { RaidView } from "./raid-view";
import { ProfileView } from "./profile-view";
import { VillageView } from "./village-view";
import { WorldMap } from "./world-map";
import { WelcomeView } from "./welcome-view";
import { TitleScreen } from "./title-screen";
import { runAfterPersistingLoadout } from "./loadout-navigation";

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

const RaidArena = dynamic(
  () => import("./raid-arena").then((module) => module.RaidArena),
  {
    ssr: false,
    loading: () => (
      <div className="battle-loading" role="status">
        Preparando a Raid Mítica...
      </div>
    ),
  },
);

const ArpgRaidArena = dynamic(
  () => import("@/components/arpg/arpg-raid-arena").then((module) => module.ArpgRaidArena),
  {
    ssr: false,
    loading: () => <div className="battle-loading">Preparando a Raid ARPG...</div>,
  },
);

const ArpgGame = dynamic(
  () => import("@/components/arpg/arpg-game").then((module) => module.ArpgGame),
  { ssr: false, loading: () => <div className="battle-loading">Carregando Card Realms ARPG...</div> },
);

const ArpgHub = dynamic(
  () => import("@/components/arpg/arpg-hub").then((module) => module.ArpgHub),
  { ssr: false, loading: () => <div className="battle-loading">Abrindo a Guilda dos Cartógrafos...</div> },
);

type View = "hub" | "expeditions" | "play" | "map" | "village" | "collection" | "loadout" | "refuge" | "raid" | "pvp" | "profile";

const navigation = [
  { id: "hub", label: "Início", icon: LayoutDashboard },
  { id: "expeditions", label: "Jogar", icon: Gamepad2 },
  { id: "map", label: "Mapa", icon: Map },
  { id: "collection", label: "Coleção", icon: Album },
  { id: "loadout", label: "Arsenal", icon: Layers3 },
  { id: "refuge", label: "Refúgio", icon: Home },
  { id: "raid", label: "Raids", icon: Crown },
  { id: "pvp", label: "Duelos", icon: Swords },
  { id: "profile", label: "Perfil", icon: UserRound },
] satisfies Array<{ id: View; label: string; icon: typeof Map }>;

const mobileNavigation = navigation.filter((item) =>
  ["expeditions", "map", "collection", "loadout", "raid", "profile"].includes(item.id),
);

const ARPG_EQUIPMENT_IDS = new Set([
  ...ARPG_WEAPONS.map((item) => item.id),
  ...ARPG_ARMORS.map((item) => item.id),
]);

const ARPG_INVENTORY_ITEM_IDS = new Set([
  ...ARPG_EQUIPMENT_IDS,
  ...ARPG_RELIC_IDS,
  ...ARPG_ABILITY_CARD_IDS,
  ...ARPG_MERCHANT_PRODUCT_KEYS,
]);

function normalizeArpgLoadoutOwnership(loadout: ArpgLoadout, inventoryItemKeys: readonly string[]): ArpgLoadout {
  const owned = new Set([
    DEFAULT_ARPG_LOADOUT.weaponId,
    DEFAULT_ARPG_LOADOUT.secondaryWeaponId!,
    DEFAULT_ARPG_LOADOUT.armorId,
    STARTER_ARPG_RELIC_ID,
    ...getOwnedArpgAbilityCardIds(inventoryItemKeys),
    ...inventoryItemKeys,
  ]);
  const abilityIds = loadout.abilityIds.map((id, index) =>
    ARPG_ABILITY_CARD_IDS.has(id) && owned.has(id) ? id : DEFAULT_ARPG_LOADOUT.abilityIds[index]
  ) as [string, string];
  const weaponId = owned.has(loadout.weaponId) ? loadout.weaponId : DEFAULT_ARPG_LOADOUT.weaponId;
  const requestedSecondaryWeaponId = loadout.secondaryWeaponId
    ?? getDefaultSecondaryArpgWeaponId(weaponId);
  const secondaryWeaponId = requestedSecondaryWeaponId !== weaponId && owned.has(requestedSecondaryWeaponId)
    ? requestedSecondaryWeaponId
    : [DEFAULT_ARPG_LOADOUT.secondaryWeaponId, DEFAULT_ARPG_LOADOUT.weaponId]
      .find((id): id is string => Boolean(id && id !== weaponId && owned.has(id)))
      ?? getDefaultSecondaryArpgWeaponId(weaponId);
  return {
    ...loadout,
    weaponId,
    secondaryWeaponId,
    armorId: owned.has(loadout.armorId) ? loadout.armorId : DEFAULT_ARPG_LOADOUT.armorId,
    relicId: ARPG_RELIC_IDS.has(loadout.relicId) && owned.has(loadout.relicId)
      ? loadout.relicId
      : STARTER_ARPG_RELIC_ID,
    abilityIds,
  };
}

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
  const [villageReturnView, setVillageReturnView] = useState<"map" | "hub">("map");
  const [classicHub, setClassicHub] = useState(false);
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<ArpgExpeditionId>(DEFAULT_ARPG_EXPEDITION_ID);
  const [guestPreview, setGuestPreview] = useState(false);
  const initialRegion = REGIONS.find(
    (region) => region.id === remoteSnapshot?.world.currentRegionId,
  ) ?? REGIONS[0];
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition | null>(initialRegion);
  const [playerRegionId, setPlayerRegionId] = useState(initialRegion.id);
  const [battleOpen, setBattleOpen] = useState(false);
  const [battleEncounter, setBattleEncounter] = useState<BattleEncounter | null>(null);
  const [pvpBattleId, setPvpBattleId] = useState<string | null>(null);
  const [raidRoomId, setRaidRoomId] = useState<string | null>(null);
  const [raidGameplayMode, setRaidGameplayMode] = useState<RaidGameplayMode>("avatar");
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
  const [localRefuge, setLocalRefuge] = useState<RefugeSavePayload>(DEFAULT_LOCAL_PROGRESS.refuge);
  const [battleBoard, setBattleBoard] = useState<BattleBoardId>(() => resolveBattleBoard(remoteSnapshot?.house?.layout?.preferredBattleBoard));
  const [equipmentIds, setEquipmentIds] = useState<string[]>(() => {
    const remoteArpgItems = remoteSnapshot?.inventory
      .filter((item) => ARPG_INVENTORY_ITEM_IDS.has(item.itemKey))
      .map((item) => item.itemKey) ?? [];
    return [...new Set(remoteArpgItems)];
  });
  const [arpgLoadout, setArpgLoadout] = useState<ArpgLoadout>(() =>
    remoteSnapshot?.arpgLoadout
      ?? (typeof window === "undefined"
        ? DEFAULT_ARPG_LOADOUT
        : readArpgLoadout(`card-realms-arpg-loadout-v1:${bootstrap.identity?.id ?? "guest"}`))
  );
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
    () => normalizeArpgLoadoutOwnership(arpgLoadout, equipmentIds),
    [arpgLoadout, equipmentIds],
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
      setAvatar(parsed.avatar);
      const legacyArpgCards = readLegacyArpgAbilityIds(arpgLoadoutStorageKey);
      setEquipmentIds([...new Set([...parsed.equipmentIds, ...legacyArpgCards])]);
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openLoadoutFocus = (focus: Exclude<ArpgLoadoutFocus, "all">) => {
    setLoadoutFocus(focus);
    setView("loadout");
  };

  const handleArpgLoadoutChange = useCallback((next: ArpgLoadout) => {
    setArpgLoadout(next);
    setArpgLoadoutDirty(true);
    try {
      window.localStorage.setItem(arpgLoadoutStorageKey, JSON.stringify(next));
    } catch (error) {
      console.warn("Não foi possível salvar o loadout ARPG localmente.", error);
    }
  }, [arpgLoadoutStorageKey]);

  const persistArpgLoadout = async (force = false) => {
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
  };

  const navigate = async (next: View) => {
    await runAfterPersistingLoadout(
      next !== "loadout" && (arpgLoadoutDirty || next === "pvp"),
      () => persistArpgLoadout(next === "pvp"),
      () => {
        if (next === "loadout") setLoadoutFocus("all");
        if (next === "hub") setClassicHub(false);
        setView(next);
      },
    );
  };

  const handleBackToHub = async () => {
    if (!await persistArpgLoadout()) return;
    setClassicHub(false);
    setView("hub");
  };

  const handleStartArpg = async (expeditionId: ArpgExpeditionId = selectedExpeditionId) => {
    if (!await persistArpgLoadout()) return;
    setSelectedExpeditionId(expeditionId);
    setView("play");
  };

  const handleBattle = async (encounter: BattleEncounter) => {
    await runAfterPersistingLoadout(bootstrap.source === "supabase", () => persistArpgLoadout(true), () => {
      setToast(null);
      setBattleEncounter(encounter);
      setBattleOpen(true);
    });
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

  const handlePurchaseAbilityCard = async (cardId: string) => {
    const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
    if (!card || !card.purchasable || card.purchasePrice === null) throw new Error("Este poder não está disponível para compra.");
    const ownedAbilityIds = getOwnedArpgAbilityCardIds(equipmentIds);
    if (ownedAbilityIds.includes(cardId)) return { coins, ownedAbilityIds };
    if (coins < card.purchasePrice) throw new Error("Moedas insuficientes para esta compra.");

    if (bootstrap.source === "supabase") {
      const response = await fetch("/api/arpg/powers/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const payload = await response.json() as {
        coins?: number;
        ownedAbilityIds?: string[];
        error?: string;
      };
      if (!response.ok || typeof payload.coins !== "number" || !Array.isArray(payload.ownedAbilityIds)) {
        throw new Error(payload.error ?? "A compra não pôde ser concluída.");
      }
      setCoins(payload.coins);
      setEquipmentIds((current) => [...new Set([...current, ...payload.ownedAbilityIds!])]);
      return { coins: payload.coins, ownedAbilityIds: payload.ownedAbilityIds };
    }

    const nextCoins = coins - card.purchasePrice;
    const nextOwnedAbilityIds = [...new Set([...ownedAbilityIds, cardId])];
    setCoins(nextCoins);
    setEquipmentIds((current) => [...new Set([...current, cardId])]);
    return { coins: nextCoins, ownedAbilityIds: nextOwnedAbilityIds };
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

  const handleEvolveCreature = async (instanceId: string) => {
    if (bootstrap.source !== "supabase") {
      throw new Error("Entre com uma conta para evoluir cartas.");
    }
    const result = await mutateRemoteProgress({
      action: "evolve_creature",
      instanceId,
    }) as { coins?: number; evolutionStage?: number };
    if (typeof result.coins === "number") setCoins(result.coins);
    setToast("Vínculo persistente evoluído.");
    router.refresh();
  };

  const handleClaimMission = async (missionId: string) => {
    if (bootstrap.source !== "supabase") {
      throw new Error("Entre com uma conta para resgatar missões.");
    }
    const result = await mutateRemoteProgress({
      action: "claim_mission",
      missionId,
    }) as { coins?: number; xp?: number; coinsAwarded?: number; xpAwarded?: number };
    if (typeof result.coins === "number") setCoins(result.coins);
    if (typeof result.xp === "number") setXp(result.xp);
    setToast(
      "Missão resgatada"
      + (result.coinsAwarded ? ": +" + result.coinsAwarded + " moedas" : "")
      + (result.xpAwarded ? " e +" + result.xpAwarded + " XP" : "")
      + ".",
    );
    router.refresh();
  };

  const handleSaveBattleBoard = async (nextBoard: BattleBoardId) => {
    const previous = battleBoard;
    setBattleBoard(nextBoard);
    if (bootstrap.source !== "supabase") {
      setToast("Tabuleiro escolhido para esta sessão.");
      return;
    }
    try {
      await mutateRemoteProgress({ action: "save_battle_board", boardId: nextBoard });
      setToast("Tabuleiro favorito salvo na sua conta.");
    } catch (error) {
      setBattleBoard(previous);
      throw error;
    }
  };

  const handleVictory = useCallback((reward?: BattleReward) => {
    if (bootstrap.source === "supabase") {
      if (reward && !reward.replayed) {
        setCoins((current) => current + reward.coins);
        setXp((current) => current + reward.xp);
        setToast("Vitória registrada: moedas e experiência recebidas. Criaturas vão para a coleção; novos poderes ficam no Arquivo.");
      }
      return;
    }
    setCoins((current) => current + 120);
    setXp((current) => current + 80);
  }, [bootstrap.source]);

  const ownedAbilityCardIds = useMemo(
    () => getOwnedArpgAbilityCardIds(equipmentIds),
    [equipmentIds],
  );
  const combatReady = AvatarConfigSchema.safeParse(avatar).success
    && arpgLoadout.abilityIds.length === 2
    && new Set(arpgLoadout.abilityIds).size === 2
    && arpgLoadout.abilityIds.every((id) => ARPG_ABILITY_CARD_IDS.has(id) && ownedAbilityCardIds.includes(id));
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
  const discoveredByRegion = useMemo(() => {
    const visibleIds = new Set(visibleOwnedCatalogIds ?? CREATURES.map((creature) => creature.id));
    return Object.fromEntries(REGIONS.map((region) => [
      region.id,
      CREATURES.filter((creature) => creature.regionId === region.id && visibleIds.has(creature.id)).length,
    ]));
  }, [visibleOwnedCatalogIds]);
  const currentRegion = REGIONS.find((region) => region.id === playerRegionId) ?? REGIONS[0];
  const showWelcome = isSupabaseConfigured() && !bootstrap.identity && !guestPreview;
  const pvpSession = useMemo(() => (
    pvpBattleId && bootstrap.identity
      ? { battleId: pvpBattleId, playerId: bootstrap.identity.id }
      : undefined
  ), [bootstrap.identity, pvpBattleId]);

  return (
    <main className={cn("game-app", showWelcome && "game-app--welcome", titleOpen && "game-app--title")}>
      {titleOpen ? (
        <TitleScreen
          loginEnabled={isSupabaseConfigured()}
          signedIn={Boolean(bootstrap.identity)}
          onPlay={() => {
            if (showWelcome) setGuestPreview(true);
            setTitleOpen(false);
          }}
        />
      ) : null}
      {!titleOpen ? <header className="app-header">
        <button type="button" className="brand" onClick={() => navigate("hub")}>
          <span className="brand__mark">CR</span>
          <span><strong>Card Realms</strong><small>Atlas de Aurória</small></span>
        </button>
        <div className="header-stats">
          <span><Coins /> {coins.toLocaleString("pt-BR")}</span>
          <span><ShieldCheck /> Nv. {playerLevel}</span>
        </div>
        <div className="header-actions">
          <LoginDialog />
        </div>
      </header> : null}

      {!showWelcome && !titleOpen ? <aside className="side-nav">
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(view === item.id && "is-active")}
                onClick={() => navigate(item.id)}
              >
                <Icon /> <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {remoteSnapshot ? (
          <MissionPanel
            missions={remoteSnapshot.missions}
            onClaim={bootstrap.source === "supabase" ? handleClaimMission : undefined}
          />
        ) : (
          <div className="side-quest">
            <span>Missões online</span>
            <strong>Progresso autoritativo</strong>
            <p>Entre com sua conta para avançar e resgatar missões.</p>
          </div>
        )}
        <Badge className="side-build">
          {bootstrap.source === "supabase"
            ? "Conta online · Supabase é a fonte de verdade"
            : bootstrap.source === "supabase-unavailable"
              ? "Conta online · cache local de emergência"
              : "Visitante · progresso salvo neste aparelho"}
        </Badge>
      </aside> : null}

      {!titleOpen ? <div className={cn("app-content", showWelcome && "app-content--welcome")}>
        {showWelcome ? <WelcomeView onPreview={() => setGuestPreview(true)} /> : null}
        {!showWelcome && view === "hub" ? (
          classicHub ? (
          <HubView
            playerName={remoteSnapshot?.profile.displayName ?? bootstrap.identity?.email?.split("@")[0] ?? "Explorador"}
            level={playerLevel}
            coins={coins}
            xp={xp}
            collectionCount={visibleOwnedCatalogIds?.length ?? CREATURES.length}
            currentRegionDiscoveryCount={discoveredByRegion[currentRegion.id] ?? 0}
            combatReady={combatReady}
            currentRegion={currentRegion}
            source={bootstrap.source}
            treasureClaimed={openedTreasures.includes(playerRegionId)}
            onContinue={() => navigate("expeditions")}
            onOpenCollection={() => navigate("collection")}
            onOpenTeam={() => navigate("loadout")}
            onOpenRefuge={() => navigate("refuge")}
            onOpenRaid={() => navigate("raid")}
            onOpenPvp={() => navigate("pvp")}
            onClaimTreasure={() => void handleTreasure(currentRegion)}
          />
          ) : (
            <ArpgHub
              playerName={remoteSnapshot?.profile.displayName ?? bootstrap.identity?.email?.split("@")[0] ?? "Explorador"}
              level={playerLevel}
              coins={coins}
              avatarConfig={avatar}
              onNavigate={(destination) => {
                const action = resolveHubNavigation(destination);
                if (action.kind === "loadout-focus") {
                  openLoadoutFocus(action.focus);
                  return;
                }
                if (action.view === "village") {
                  setVillageReturnView("hub");
                }
                if (action.toast) setToast(action.toast);
                navigate(action.view);
              }}
              onOpenClassic={() => setClassicHub(true)}
            />
          )
        ) : null}
        {!showWelcome && view === "expeditions" ? (
          <ArpgExpeditionSelect onSelect={(id) => void handleStartArpg(id)} />
        ) : null}
        {!showWelcome && view === "play" ? (
          <ArpgGame
            loadout={playableArpgLoadout}
            avatarConfig={avatar}
            expeditionId={selectedExpeditionId}
            onExit={() => navigate("hub")}
            onRunComplete={(state, extraction) => {
              const newItems = extraction?.reward.newItems ?? [];
              const runLootItems = extraction?.reward.runLootItems ?? [];
              if (extraction?.persisted && !extraction.reward.replayed) {
                setCoins((current) => current + extraction.reward.coins);
                setXp((current) => current + extraction.reward.xp);
                setEquipmentIds((current) => [...new Set([...current, ...extraction.reward.items])]);
              }
              if (extraction?.persisted && (newItems.length > 0 || runLootItems.length > 0)) {
                setEquipmentIds((current) => [...new Set([...current, ...newItems, ...runLootItems])]);
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
            avatar={avatar}
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
            energy={energy}
            ownedItemKeys={equipmentIds}
            onBack={() => navigate(villageReturnView)}
            backLabel={villageReturnView === "hub" ? "Voltar à Guilda" : "Voltar ao Atlas"}
            onBuy={handleBuyEnergy}
            onBuyItem={handleBuyMerchantItem}
          />
        ) : null}
        {!showWelcome && view === "collection" ? (
          <CollectionView
            ownedCatalogIds={visibleOwnedCatalogIds}
            collection={remoteSnapshot?.collection ?? []}
            coins={coins}
            onEvolve={bootstrap.source === "supabase" ? handleEvolveCreature : undefined}
          />
        ) : null}
        {!showWelcome && view === "loadout" ? (
          <ArpgLoadoutView
            focus={loadoutFocus}
            loadout={playableArpgLoadout}
            inventoryItemKeys={equipmentIds}
            ownedAbilityCardIds={ownedAbilityCardIds}
            coins={coins}
            avatarConfig={avatar}
            onChange={handleArpgLoadoutChange}
            onPurchaseAbilityCard={handlePurchaseAbilityCard}
            onSaveAvatar={handleSaveAvatar}
            onBack={() => void handleBackToHub()}
            onPlay={() => navigate("expeditions")}
          >
            {loadoutFocus === "cards" ? (
              <ArpgPowerGacha
                authenticated={bootstrap.source === "supabase"}
                accountId={bootstrap.identity?.id ?? null}
                onResult={(result) => {
                  setCoins(result.coins);
                  setEquipmentIds((current) => [...new Set([...current, result.itemId])]);
                  if (bootstrap.source === "supabase") router.refresh();
                }}
              />
            ) : null}
          </ArpgLoadoutView>
        ) : null}
        {!showWelcome && view === "refuge" ? (
          <RefugeView
            ownedCatalogIds={visibleOwnedCatalogIds ?? []}
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
            onOpenRaid={(roomId, mode) => {
              setRaidGameplayMode(mode);
              setRaidRoomId(roomId);
            }}
          />
        ) : null}
        {!showWelcome && view === "pvp" ? <PvpView bootstrap={bootstrap} onOpenBattle={setPvpBattleId} /> : null}
        {!showWelcome && view === "profile" ? (
          <ProfileView
            coins={coins}
            xp={xp}
            level={playerLevel}
            collectionCount={visibleOwnedCatalogIds?.length ?? CREATURES.length}
            source={bootstrap.source}
            snapshot={remoteSnapshot}
            avatar={avatar}
            equipmentIds={equipmentIds.filter((id) => ARPG_EQUIPMENT_IDS.has(id))}
            onSaveAvatar={handleSaveAvatar}
            preferredBattleBoard={battleBoard}
            onSaveBattleBoard={handleSaveBattleBoard}
          />
        ) : null}
      </div> : null}

      {!showWelcome && !titleOpen ? <nav className="mobile-nav" aria-label="Navegação principal">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(view === item.id && "is-active")}
              onClick={() => navigate(item.id)}
            >
              <Icon /><span>{item.label}</span>
            </button>
          );
        })}
      </nav> : null}

      {toast ? <div className="game-toast" role="status" aria-live="polite"><Trophy /> {toast}</div> : null}
      {raidRoomId && bootstrap.identity ? (
        <div className="battle-overlay raid-overlay">
          {raidGameplayMode === "arpg" ? (
            <ArpgRaidArena
              roomId={raidRoomId}
              playerId={bootstrap.identity.id}
              onClose={() => {
                setRaidRoomId(null);
                if (bootstrap.source === "supabase") router.refresh();
              }}
            />
          ) : (
            <RaidArena
              roomId={raidRoomId}
              playerId={bootstrap.identity.id}
              gameplayMode={raidGameplayMode}
              onClose={() => {
                setRaidRoomId(null);
                setRaidGameplayMode("avatar");
                if (bootstrap.source === "supabase") router.refresh();
              }}
            />
          )}
        </div>
      ) : null}
      {battleOpen || pvpSession ? (
        <div className="battle-overlay">
          <BattleArena
            open
            pvp={pvpSession}
            encounter={pvpSession ? undefined : battleEncounter ?? undefined}
            playerEnergy={energy}
            guestSetup={bootstrap.source === "supabase" ? undefined : {
              avatarConfig: avatar,
              abilityIds: playableArpgLoadout.abilityIds,
            }}
            battleBoard={battleBoard}
            onClose={() => {
              setBattleOpen(false);
              setBattleEncounter(null);
              setPvpBattleId(null);
              if (bootstrap.source === "supabase") router.refresh();
            }}
            onVictory={pvpSession ? () => undefined : handleVictory}
          />
        </div>
      ) : null}
    </main>
  );
}

