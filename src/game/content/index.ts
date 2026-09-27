export { CREATURES, CREATURE_BY_ID, NPC_TEAM_IDS, STARTER_TEAM_IDS } from "./creatures";
export { REGIONS } from "./regions";
export { ELEMENT_META, emptyEnergyPool } from "../domain/elements";

import { CREATURES } from "./creatures";

export const IMPLEMENTATION_NOTE = {
  completeCreatures: CREATURES.length,
  catalogTarget: 400,
  statement: "Esta fundação usa seres documentados em folclores e mitologias reais. Novas entradas devem incluir tradição, origem, nota de fonte e limites da adaptação.",
};
