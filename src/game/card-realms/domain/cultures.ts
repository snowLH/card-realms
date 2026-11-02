import { PROP_ART } from "@/game/arpg/art/manifest";
import type { CultureId, KingdomHeartState, KingdomHeartVisualState, PlayerSide, TerritoryBiomeId } from "./types";

export type CultureDefinition = {
  id: CultureId;
  name: string;
  countryLabel: string;
  themeSummary: string;
  playstyleDescription: string;
  signatureMechanics: readonly string[];
  startingBiomes: readonly [TerritoryBiomeId, TerritoryBiomeId, TerritoryBiomeId, TerritoryBiomeId];
  kingdomHeart: {
    name: string;
    subtitle: string;
    maxHp: number;
    intactPropFrame: number;
    damagedPropFrame: number;
    criticalPropFrame: number;
    destroyedPropFrame: number;
  };
  audioThemeId: "mata-encantada" | "arquipelago-das-mares" | "montanhas-runicas";
};

export const CULTURES: Readonly<Record<CultureId, CultureDefinition>> = {
  brasil: {
    id: "brasil",
    name: "Folclore Brasileiro",
    countryLabel: "Brasil",
    themeSummary: "Natureza viva, transformação do território, astúcia e proteção da mata e dos rios.",
    playstyleDescription:
      "Expande a Mata Encantada e o Rio dos Espíritos para fortalecer guardiões como Curupira, Iara, Saci, Boitatá e Mapinguari, confundindo invasores e regenerando o reino.",
    signatureMechanics: [
      "Transformação de terrenos em Mata Encantada e Rio dos Espíritos",
      "Rastro Invertido (Confusão que desorienta ataques inimigos)",
      "Fogo protetor de Boitatá e regeneração florestal",
    ],
    startingBiomes: [
      "mata-encantada",
      "campos-ancestrais",
      "rio-dos-espiritos",
      "campos-ancestrais",
    ],
    kingdomHeart: {
      name: "Árvore Ancestral de Pindorama",
      subtitle: "Coração Vivo da Floresta e das Águas",
      maxHp: 20,
      intactPropFrame: PROP_ART.forestAltar,
      damagedPropFrame: PROP_ART.tree,
      criticalPropFrame: PROP_ART.stump,
      destroyedPropFrame: PROP_ART.rubble,
    },
    audioThemeId: "mata-encantada",
  },
  japao: {
    id: "japao",
    name: "Folclore Japonês",
    countryLabel: "Japão",
    themeSummary: "Espíritos Yōkai, ilusões de raposa, disciplina da montanha e metamorfose espiritual.",
    playstyleDescription:
      "Consagra o Reino Espiritual e a Montanha Antiga para invocar Kitsune, Kappa, Tengu, Oni e Raijū, usando Véu de Ilusão, troca de faixas e trovões diretos ao coração inimigo.",
    signatureMechanics: [
      "Véu de Ilusão (anula o próximo golpe recebido)",
      "Troca tática de faixas com Vendaval de Tengu e Redemoinho de Kappa",
      "Demolição de estruturas com Oni e relâmpagos de Raijū",
    ],
    startingBiomes: [
      "campos-ancestrais",
      "reino-espiritual",
      "campos-ancestrais",
      "montanha-antiga",
    ],
    kingdomHeart: {
      name: "Santuário Torii das Mil Eras",
      subtitle: "Portal Sagrado dos Oito Milhões de Espíritos",
      maxHp: 20,
      intactPropFrame: PROP_ART.legendShrine,
      damagedPropFrame: PROP_ART.runicAltar,
      criticalPropFrame: PROP_ART.ruin,
      destroyedPropFrame: PROP_ART.rubble,
    },
    audioThemeId: "arquipelago-das-mares",
  },
};

export function getCulture(cultureId: CultureId): CultureDefinition {
  return CULTURES[cultureId];
}

export function createInitialKingdomHeart(owner: PlayerSide, cultureId: CultureId): KingdomHeartState {
  const culture = getCulture(cultureId);
  return {
    owner,
    culture: cultureId,
    name: culture.kingdomHeart.name,
    subtitle: culture.kingdomHeart.subtitle,
    currentHp: culture.kingdomHeart.maxHp,
    maxHp: culture.kingdomHeart.maxHp,
    shield: 0,
  };
}

export function getKingdomHeartVisualState(heart: KingdomHeartState): KingdomHeartVisualState {
  if (heart.currentHp <= 0) return "destroyed";
  const ratio = heart.currentHp / Math.max(1, heart.maxHp);
  if (ratio <= 0.2) return "critical";
  if (ratio <= 0.4) return "severely-damaged";
  if (ratio <= 0.6) return "damaged";
  if (ratio <= 0.8) return "under-pressure";
  return "intact";
}
