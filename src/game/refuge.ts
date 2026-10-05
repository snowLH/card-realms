export const REFUGE_THEMES = ["cartographer", "forest", "moonlit"] as const;

export type RefugeTheme = (typeof REFUGE_THEMES)[number];

export const REFUGE_FURNITURE_KEYS = [
  "armchair",
  "lamp",
  "plant",
  "books",
  "chest",
  "map-stand",
] as const;

export type RefugeFurnitureKey = (typeof REFUGE_FURNITURE_KEYS)[number];

export const REFUGE_FURNITURE_UNLOCK_ITEM_KEYS: Partial<Record<RefugeFurnitureKey, string>> = {
  books: "refuge-furniture-books",
  chest: "refuge-furniture-chest",
  "map-stand": "refuge-furniture-map-stand",
};

export const REFUGE_COSMETIC_ITEM_KEYS = Object.values(REFUGE_FURNITURE_UNLOCK_ITEM_KEYS);

export function isRefugeFurnitureUnlocked(
  itemKey: RefugeFurnitureKey,
  ownedItemKeys: readonly string[],
) {
  const requiredItemKey = REFUGE_FURNITURE_UNLOCK_ITEM_KEYS[itemKey];
  return !requiredItemKey || ownedItemKeys.includes(requiredItemKey);
}

export type RefugeFurniturePlacement = {
  id: string;
  itemKey: RefugeFurnitureKey;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
};

export type RefugeSavePayload = {
  companionId: string | null;
  theme: RefugeTheme;
  furniture: RefugeFurniturePlacement[];
};

export const DEFAULT_REFUGE_FURNITURE: RefugeFurniturePlacement[] = [
  { id: "starter-armchair", itemKey: "armchair", x: 73, y: 66, rotation: 0 },
  { id: "starter-lamp", itemKey: "lamp", x: 58, y: 77, rotation: 0 },
  { id: "starter-plant", itemKey: "plant", x: 86, y: 71, rotation: 0 },
];

export function isRefugeTheme(value: unknown): value is RefugeTheme {
  return typeof value === "string"
    && REFUGE_THEMES.includes(value as RefugeTheme);
}

export function isRefugeFurnitureKey(value: unknown): value is RefugeFurnitureKey {
  return typeof value === "string"
    && REFUGE_FURNITURE_KEYS.includes(value as RefugeFurnitureKey);
}

export function resolveRefugeResident(
  savedCreatureId: unknown,
  ownedCatalogIds: readonly string[],
): string | null {
  if (typeof savedCreatureId === "string" && ownedCatalogIds.includes(savedCreatureId)) {
    return savedCreatureId;
  }
  return ownedCatalogIds[0] ?? null;
}
