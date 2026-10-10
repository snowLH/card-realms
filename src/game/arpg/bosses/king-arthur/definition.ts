import type { CorruptedLegendBossDefinition } from "../boss-definition";
import { ARTHUR_DIALOGUE } from "./dialogue";

export const KING_ARTHUR: CorruptedLegendBossDefinition = {
  id: "king-arthur", playableLegendId: "king-arthur",
  title: "REI ARTHUR — O REI OUTRORA E FUTURO",
  corruptedTitle: "REI ARTHUR — O REI QUE SE RECUSOU A TERMINAR",
  arena: { widthTiles: 61, heightTiles: 31, presentation: "camelot" },
  intro: { durationMs: 7000, shortDurationMs: 1800, awakeningAtMs: 3200 },
  phases: [
    { phase: 1, hpThreshold: 1, title: "O Rei Ferido" },
    { phase: 2, hpThreshold: 0.7, title: "Camlann Não Terminou" },
    { phase: 3, hpThreshold: 0.35, title: "O Rei Que Não Pode Ser Esquecido" },
  ],
  purification: { defeatedMs: 1200, durationMs: 6500, dialogue: ARTHUR_DIALOGUE.restored },
  unlock: { label: "REI ARTHUR DESBLOQUEADO" },
};
