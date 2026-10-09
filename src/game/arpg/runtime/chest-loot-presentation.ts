import type { DungeonLoot } from "../content/dungeons";
import { ARPG_ARMOR_BY_ID, ARPG_WEAPON_BY_ID } from "../content/equipment";
import { getWeaponVisualDefinition } from "./weapon-visuals";
import type { Rarity } from "../../domain/creatures";
import { gridCellKey, gridCellToWorld, worldToGridCell, type GridNavigation, type WorldPoint } from "../navigation/grid-path";

export type ChestLootSilhouette = "sword" | "bow" | "staff" | "breastplate" | "mantle";

export type ChestLootRarityPresentation = {
  color: number;
  sparkleCount: number;
  outlineCount: number;
  noteCount: number;
  noteDurationMs: number;
};

export const CHEST_LOOT_RARITY_PRESENTATION: Record<Rarity, ChestLootRarityPresentation> = {
  common: { color: 0xd8cba5, sparkleCount: 3, outlineCount: 0, noteCount: 2, noteDurationMs: 180 },
  uncommon: { color: 0x8fc56b, sparkleCount: 6, outlineCount: 1, noteCount: 3, noteDurationMs: 240 },
  rare: { color: 0x6ca4cc, sparkleCount: 10, outlineCount: 2, noteCount: 4, noteDurationMs: 340 },
  epic: { color: 0xa978d1, sparkleCount: 14, outlineCount: 2, noteCount: 5, noteDurationMs: 380 },
  legendary: { color: 0xf0bd5b, sparkleCount: 18, outlineCount: 3, noteCount: 6, noteDurationMs: 420 },
  mythic: { color: 0xe994dc, sparkleCount: 22, outlineCount: 4, noteCount: 7, noteDurationMs: 480 },
};

export function getChestLootVisualDetails(loot: DungeonLoot) {
  if (loot.kind === "weapon") {
    const definition = ARPG_WEAPON_BY_ID.get(loot.id);
    if (!definition) throw new Error(`A arma atribuída ${loot.id} não possui definição ARPG.`);
    const visual = getWeaponVisualDefinition(definition.id);
    return {
      id: definition.id,
      label: loot.label,
      rarity: definition.rarity,
      silhouette: definition.kind,
      textureKey: visual.textureKey,
    } as const;
  }

  const definition = ARPG_ARMOR_BY_ID.get(loot.id);
  if (!definition) throw new Error(`A armadura atribuída ${loot.id} não possui definição ARPG.`);
  const silhouette = /\b(manto|cloak|casaco)\b/i.test(definition.name)
    ? "mantle" as const
    : "breastplate" as const;
  return {
    id: definition.id,
    label: loot.label,
    rarity: definition.rarity,
    silhouette,
    textureKey: `arpg-loot-${silhouette}`,
  };
}

export type ChestLootVisualSlot = { claimed: boolean };

export function claimChestLootVisualSlot(slot: ChestLootVisualSlot) {
  if (slot.claimed) return false;
  slot.claimed = true;
  return true;
}

export function findChestLootLandingPoint(
  navigation: GridNavigation,
  roomId: string,
  chestPosition: WorldPoint,
): WorldPoint | null {
  const candidates = [0, -32, 32].map((offsetX) => ({
    x: chestPosition.x + offsetX,
    y: chestPosition.y + 24,
  }));

  const isSafeInRoom = (point: WorldPoint) => {
    const cell = worldToGridCell(point, navigation);
    const key = gridCellKey(cell.x, cell.y);
    return navigation.walkable.has(key) && navigation.roomIdByCell?.get(key) === roomId;
  };
  const preferred = candidates.find(isSafeInRoom);
  if (preferred) return preferred;

  const center = candidates[0];
  const nearestSafeCell = [...navigation.walkable]
    .filter((key) => navigation.roomIdByCell?.get(key) === roomId)
    .map((key) => {
      const [x, y] = key.split(",").map(Number);
      return gridCellToWorld({ x, y }, navigation);
    })
    .sort((left, right) => {
      const distance = Math.hypot(left.x - center.x, left.y - center.y)
        - Math.hypot(right.x - center.x, right.y - center.y);
      return distance || left.y - right.y || left.x - right.x;
    })[0];
  return nearestSafeCell ?? null;
}
