import { z } from "zod";
import { DEFAULT_REFUGE_FURNITURE, REFUGE_FURNITURE_KEYS, REFUGE_THEMES } from "@/game/refuge";

export const LOCAL_PROGRESS_KEY = "card-realms:progress:v4";
const V3_PROGRESS_KEY = "card-realms:progress:v3";
const V2_PROGRESS_KEY = "card-realms:progress:v2";
const LEGACY_PROGRESS_KEY = "card-realms:demo-progress:v1";

export const AvatarConfigSchema = z.object({
  skin: z.enum(["amber", "copper", "umber", "rose"]),
  hair: z.enum(["braids", "short", "waves", "mohawk"]),
  outfit: z.enum(["traveler", "scholar", "ranger", "merchant"]),
  armor: z.enum(["none", "leather", "runic", "guardian"]),
  accent: z.enum(["gold", "emerald", "azure", "crimson"]),
});

export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skin: "copper",
  hair: "braids",
  outfit: "traveler",
  armor: "none",
  accent: "gold",
};

const RefugeProgressSchema = z.object({
  companionId: z.string().min(1).max(80).nullable(),
  theme: z.enum(REFUGE_THEMES),
  furniture: z.array(z.object({
    id: z.string().min(1).max(100),
    itemKey: z.enum(REFUGE_FURNITURE_KEYS),
    x: z.number().min(8).max(92),
    y: z.number().min(24).max(88),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  })).max(12),
});

const DEFAULT_LOCAL_REFUGE = {
  companionId: null,
  theme: "cartographer" as const,
  furniture: DEFAULT_REFUGE_FURNITURE.map((item) => ({ ...item })),
};

const LocalProgressSchema = z.object({
  version: z.literal(4),
  coins: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  xp: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  openedTreasures: z.array(z.string().min(1).max(80)).max(500),
  playerRegionId: z.string().min(1).max(80),
  currentAreaId: z.string().min(1).max(80).nullable(),
  visitedAreaIds: z.array(z.string().min(1).max(80)).max(500),
  mapPositions: z.record(
    z.string().min(1).max(80),
    z.object({
      x: z.number().int().min(0).max(39),
      y: z.number().int().min(0).max(24),
    }),
  ),
  energy: z.object({
    fire: z.number().int().nonnegative().max(9999),
    water: z.number().int().nonnegative().max(9999),
    nature: z.number().int().nonnegative().max(9999),
    storm: z.number().int().nonnegative().max(9999),
    spirit: z.number().int().nonnegative().max(9999),
  }),
  equipmentIds: z.array(z.string().min(1).max(80)).max(100),
  avatar: AvatarConfigSchema,
  refuge: RefugeProgressSchema.default(DEFAULT_LOCAL_REFUGE),
});

export type LocalProgress = z.infer<typeof LocalProgressSchema>;

export const DEFAULT_LOCAL_PROGRESS: LocalProgress = {
  version: 4,
  coins: 500,
  xp: 0,
  openedTreasures: [],
  playerRegionId: "roots",
  currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"],
  mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: [],
  avatar: DEFAULT_AVATAR_CONFIG,
  refuge: DEFAULT_LOCAL_REFUGE,
};

function unique(values: string[]) {
  return [...new Set(values)];
}

export function localProgressKey(accountId?: string | null) {
  return accountId ? `${LOCAL_PROGRESS_KEY}:account:${accountId}` : LOCAL_PROGRESS_KEY;
}

export function loadLocalProgress(
  storage: Pick<Storage, "getItem">,
  accountId?: string | null,
): LocalProgress {
  try {
    const current = storage.getItem(localProgressKey(accountId));
    if (current) {
      const parsed = LocalProgressSchema.safeParse(JSON.parse(current));
      if (parsed.success) {
        return { ...parsed.data, openedTreasures: unique(parsed.data.openedTreasures) };
      }
    }

    // An authenticated account never inherits the visitor save or another
    // account's emergency cache. Supabase remains the source of truth.
    if (accountId) return DEFAULT_LOCAL_PROGRESS;

    const legacy = storage.getItem(V3_PROGRESS_KEY)
      ?? storage.getItem(V2_PROGRESS_KEY)
      ?? storage.getItem(LEGACY_PROGRESS_KEY);
    if (!legacy) return DEFAULT_LOCAL_PROGRESS;
    const value = JSON.parse(legacy) as Record<string, unknown>;
    const migrated = LocalProgressSchema.parse({
      version: 4,
      coins: value.coins ?? DEFAULT_LOCAL_PROGRESS.coins,
      xp: value.xp ?? DEFAULT_LOCAL_PROGRESS.xp,
      openedTreasures: value.openedTreasures ?? [],
      playerRegionId: value.playerRegionId ?? "roots",
      currentAreaId: value.currentAreaId ?? "roots-gate",
      visitedAreaIds: value.visitedAreaIds ?? ["roots-gate"],
      mapPositions: value.mapPositions ?? DEFAULT_LOCAL_PROGRESS.mapPositions,
      energy: value.energy ?? DEFAULT_LOCAL_PROGRESS.energy,
      equipmentIds: value.equipmentIds ?? DEFAULT_LOCAL_PROGRESS.equipmentIds,
      avatar: value.avatar ?? DEFAULT_AVATAR_CONFIG,
      refuge: value.refuge ?? DEFAULT_LOCAL_REFUGE,
    });
    return { ...migrated, openedTreasures: unique(migrated.openedTreasures) };
  } catch {
    return DEFAULT_LOCAL_PROGRESS;
  }
}

export function saveLocalProgress(
  storage: Pick<Storage, "setItem">,
  progress: LocalProgress,
  accountId?: string | null,
) {
  const validated = LocalProgressSchema.parse({
    ...progress,
    openedTreasures: unique(progress.openedTreasures),
    visitedAreaIds: unique(progress.visitedAreaIds),
    equipmentIds: unique(progress.equipmentIds),
  });
  storage.setItem(localProgressKey(accountId), JSON.stringify(validated));
}
