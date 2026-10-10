import type { CorruptedLegendBossDefinition } from "../boss-definition";

export const ANCESTRAL_CURUPIRA: CorruptedLegendBossDefinition = {
  id: "ancestral-curupira",
  playableLegendId: "curupira",
  title: "CURUPIRA ANCESTRAL — GUARDIÃO DA MATA",
  corruptedTitle: "CURUPIRA ANCESTRAL — O GUARDIÃO QUE ESQUECEU A FLORESTA",
  arena: { widthTiles: 61, heightTiles: 31, presentation: "regional" },
  intro: { durationMs: 6200, shortDurationMs: 1700, awakeningAtMs: 2700 },
  phases: [
    { phase: 1, hpThreshold: 1, title: "Rastros Que Não Levam a Lugar Algum" },
    { phase: 2, hpThreshold: 0.7, title: "A Mata Esquece Seus Caminhos" },
    { phase: 3, hpThreshold: 0.35, title: "O Guardião Sem Floresta" },
  ],
  purification: {
    defeatedMs: 1200,
    durationMs: 6200,
    dialogue: ["Eu me lembro das raízes.", "A mata ainda sabe meu nome."],
  },
  unlock: { label: "CURUPIRA ANCESTRAL RESTAURADO" },
};
