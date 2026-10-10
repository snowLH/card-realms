import type { CorruptedLegendBossDefinition } from "../boss-definition";

export const DEEP_IARA: CorruptedLegendBossDefinition = {
  id: "deep-iara",
  playableLegendId: "iara",
  title: "IARA DAS PROFUNDEZAS — VOZ DAS ÁGUAS",
  corruptedTitle: "IARA DAS PROFUNDEZAS — A CANÇÃO QUE NINGUÉM MAIS OUVE",
  arena: { widthTiles: 61, heightTiles: 31, presentation: "regional" },
  intro: { durationMs: 6400, shortDurationMs: 1700, awakeningAtMs: 2900 },
  phases: [
    { phase: 1, hpThreshold: 1, title: "A Voz Afogada" },
    { phase: 2, hpThreshold: 0.7, title: "O Rio Esqueceu Seu Nome" },
    { phase: 3, hpThreshold: 0.35, title: "A Canção Sob as Profundezas" },
  ],
  purification: {
    defeatedMs: 1200,
    durationMs: 6400,
    dialogue: ["Eu me lembro da correnteza.", "Minha canção ainda encontra a margem."],
  },
  unlock: { label: "IARA DAS PROFUNDEZAS RESTAURADA" },
};
