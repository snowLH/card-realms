import { z } from "zod";

export const LOCAL_PROGRESS_KEY = "card-realms:progress:v2";
const LEGACY_PROGRESS_KEY = "card-realms:demo-progress:v1";

const LocalProgressSchema = z.object({
  version: z.literal(2),
  coins: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  xp: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  openedTreasures: z.array(z.string().min(1).max(80)).max(500),
  playerRegionId: z.string().min(1).max(80),
});

export type LocalProgress = z.infer<typeof LocalProgressSchema>;

export const DEFAULT_LOCAL_PROGRESS: LocalProgress = {
  version: 2,
  coins: 840,
  xp: 1240,
  openedTreasures: [],
  playerRegionId: "roots",
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

    const legacy = storage.getItem(LEGACY_PROGRESS_KEY);
    if (!legacy) return DEFAULT_LOCAL_PROGRESS;
    const value = JSON.parse(legacy) as Record<string, unknown>;
    const migrated = LocalProgressSchema.parse({
      version: 2,
      coins: value.coins ?? DEFAULT_LOCAL_PROGRESS.coins,
      xp: value.xp ?? DEFAULT_LOCAL_PROGRESS.xp,
      openedTreasures: value.openedTreasures ?? [],
      playerRegionId: "roots",
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
  });
  storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(validated));
}
