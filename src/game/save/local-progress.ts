import { z } from "zod";

export const LOCAL_PROGRESS_KEY = "card-realms:progress:v3";
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

const LocalProgressSchema = z.object({
  version: z.literal(3),
  coins: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  xp: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  openedTreasures: z.array(z.string().min(1).max(80)).max(500),
  playerRegionId: z.string().min(1).max(80),
  currentAreaId: z.string().min(1).max(80).nullable(),
  visitedAreaIds: z.array(z.string().min(1).max(80)).max(500),
  energy: z.object({
    fire: z.number().int().nonnegative().max(9999),
    water: z.number().int().nonnegative().max(9999),
    nature: z.number().int().nonnegative().max(9999),
    storm: z.number().int().nonnegative().max(9999),
    spirit: z.number().int().nonnegative().max(9999),
  }),
  equipmentIds: z.array(z.string().min(1).max(80)).max(100),
  avatar: AvatarConfigSchema,
});

export type LocalProgress = z.infer<typeof LocalProgressSchema>;

export const DEFAULT_LOCAL_PROGRESS: LocalProgress = {
  version: 3,
  coins: 840,
  xp: 1240,
  openedTreasures: [],
  playerRegionId: "roots",
  currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"],
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: ["leather"],
  avatar: DEFAULT_AVATAR_CONFIG,
};

function unique(values: string[]) {
  return [...new Set(values)];
}

export function loadLocalProgress(storage: Pick<Storage, "getItem">): LocalProgress {
  try {
    const current = storage.getItem(LOCAL_PROGRESS_KEY);
    if (current) {
      const parsed = LocalProgressSchema.safeParse(JSON.parse(current));
      if (parsed.success) {
        return { ...parsed.data, openedTreasures: unique(parsed.data.openedTreasures) };
      }
    }

    const legacy = storage.getItem(V2_PROGRESS_KEY) ?? storage.getItem(LEGACY_PROGRESS_KEY);
    if (!legacy) return DEFAULT_LOCAL_PROGRESS;
    const value = JSON.parse(legacy) as Record<string, unknown>;
    const migrated = LocalProgressSchema.parse({
      version: 3,
      coins: value.coins ?? DEFAULT_LOCAL_PROGRESS.coins,
      xp: value.xp ?? DEFAULT_LOCAL_PROGRESS.xp,
      openedTreasures: value.openedTreasures ?? [],
      playerRegionId: value.playerRegionId ?? "roots",
      currentAreaId: "roots-gate",
      visitedAreaIds: ["roots-gate"],
      energy: DEFAULT_LOCAL_PROGRESS.energy,
      equipmentIds: ["leather"],
      avatar: DEFAULT_AVATAR_CONFIG,
    });
    return { ...migrated, openedTreasures: unique(migrated.openedTreasures) };
  } catch {
    return DEFAULT_LOCAL_PROGRESS;
  }
}

export function saveLocalProgress(
  storage: Pick<Storage, "setItem">,
  progress: LocalProgress,
) {
  const validated = LocalProgressSchema.parse({
    ...progress,
    openedTreasures: unique(progress.openedTreasures),
    visitedAreaIds: unique(progress.visitedAreaIds),
    equipmentIds: unique(progress.equipmentIds),
  });
  storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(validated));
}
