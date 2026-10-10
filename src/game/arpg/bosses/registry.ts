import { ANCESTRAL_CURUPIRA } from "./ancestral-curupira/definition";
import type { CorruptedLegendBossDefinition } from "./boss-definition";
import { DEEP_IARA } from "./deep-iara/definition";
import { KING_ARTHUR } from "./king-arthur/definition";

export const CORRUPTED_LEGEND_BOSSES = [
  ANCESTRAL_CURUPIRA,
  DEEP_IARA,
  KING_ARTHUR,
] as const satisfies readonly CorruptedLegendBossDefinition[];

export function bossForRegion(regionId: string) {
  return CORRUPTED_LEGEND_BOSSES[
    regionId === "arquipelago-das-mares" ? 1 : regionId === "montanhas-runicas" ? 2 : 0
  ];
}

export function bossById(id: string) {
  const definition = CORRUPTED_LEGEND_BOSSES.find((boss) => boss.id === id);
  if (!definition) throw new Error("Lenda Esquecida desconhecida.");
  return definition;
}
