import { z } from "zod";
import { PLAYABLE_LEGEND_IDS, legendInventoryKey } from "../content/legends";
import type { BossEncounterSnapshot } from "./boss-encounter-controller";
import { bossById } from "./registry";

const IdList = z.array(z.string().min(1).max(80)).max(500).default([]).transform((ids) => [...new Set(ids)]);
export const BossProgressSchema = z.object({
  purifiedBossIds: IdList,
  unlockedLegendIds: z.array(z.enum(PLAYABLE_LEGEND_IDS)).max(100).default([]).transform((ids) => [...new Set(ids)]),
  seenBossIntroIds: IdList,
});
export type BossProgress = z.infer<typeof BossProgressSchema>;
export const EMPTY_BOSS_PROGRESS: BossProgress = { purifiedBossIds: [], unlockedLegendIds: [], seenBossIntroIds: [] };
export function restoreBossProgress(progress: BossProgress, encounter: BossEncounterSnapshot) {
  if (encounter.state !== "RESTORED" && encounter.state !== "CLEARED") throw new Error("A purificação precisa terminar antes do desbloqueio.");
  const definition = bossById(encounter.bossId);
  return BossProgressSchema.parse({
    purifiedBossIds: [...progress.purifiedBossIds, encounter.bossId],
    seenBossIntroIds: [...progress.seenBossIntroIds, encounter.bossId],
    unlockedLegendIds: [...progress.unlockedLegendIds, ...(definition.playableLegendId ? [definition.playableLegendId] : [])],
  });
}
export function bossProgressInventory(progress: BossProgress) {
  return progress.unlockedLegendIds.map(legendInventoryKey);
}
