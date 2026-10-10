import type { CorruptedLegendBossDefinition } from "./boss-definition";
import { KING_ARTHUR } from "./king-arthur/definition";

function regional(id: string, title: string): CorruptedLegendBossDefinition {
  return {
    ...KING_ARTHUR, id, playableLegendId: undefined, title,
    corruptedTitle: title + " — LENDA ESQUECIDA",
    arena: { ...KING_ARTHUR.arena, presentation: "regional" },
    phases: [
      { phase: 1, hpThreshold: 1, title: "A Lenda Fragmentada" },
      { phase: 2, hpThreshold: 0.7, title: "Memórias em Conflito" },
      { phase: 3, hpThreshold: 0.35, title: "Última Recordação" },
    ],
    purification: { ...KING_ARTHUR.purification, dialogue: ["Eu me lembro.", "Minha história continua."] },
    unlock: { label: "LENDA RESTAURADA" },
  };
}
export const CORRUPTED_LEGEND_BOSSES = [
  regional("ancestral-curupira", "CURUPIRA ANCESTRAL"),
  regional("deep-iara", "IARA DAS PROFUNDEZAS"),
  KING_ARTHUR,
] as const;
export function bossForRegion(regionId: string) {
  return CORRUPTED_LEGEND_BOSSES[regionId === "arquipelago-das-mares" ? 1 : regionId === "montanhas-runicas" ? 2 : 0];
}
export function bossById(id: string) {
  const definition = CORRUPTED_LEGEND_BOSSES.find((boss) => boss.id === id);
  if (!definition) throw new Error("Lenda Esquecida desconhecida.");
  return definition;
}
