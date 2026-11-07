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
  nordico: {
    id: "nordico",
    name: "Mitologia Nórdica",
    countryLabel: "Escandinávia",
    themeSummary: "Fúria do gelo, runas ancestrais, resistência inabalável e bestas de Yggdrasil.",
    playstyleDescription:
      "Congela o tabuleiro em Reinos Glaciais para amplificar o poder de Ratatoskr, Amarok e Yeti, criando muralhas de gelo e estilhaçando adversários com investidas rúnicas.",
    signatureMechanics: [
      "Congelamento e Reino Glacial (concede escudo a aliados de gelo)",
      "Fofoca de Yggdrasil (deslocamento veloz entre faixas com compra de cartas)",
      "Fimbulwinter (enfraquece o ataque dos invasores sem resistência ao frio)",
    ],
    startingBiomes: [
      "reino-congelado",
      "montanha-antiga",
      "reino-congelado",
      "campos-ancestrais",
    ],
    kingdomHeart: {
      name: "Trono Rúnico de Valhalla",
      subtitle: "Fortaleza Ancestral dos Nove Reinos",
      maxHp: 20,
      intactPropFrame: PROP_ART.runicAltar,
      damagedPropFrame: PROP_ART.crystal,
      criticalPropFrame: PROP_ART.ruin,
      destroyedPropFrame: PROP_ART.rubble,
    },
    audioThemeId: "montanhas-runicas",
  },
  grecia: {
    id: "grecia",
    name: "Mitologia Grega",
    countryLabel: "Grécia",
    themeSummary: "Glória heróica, monstros do labirinto, panteão dos deuses e chamas do renascimento.",
    playstyleDescription:
      "Ergue templos de mármore e desencadeia a fúria do Minotauro, Medusa, Quimera e Fênix, petrificando alvos e renascendo das cinzas com ataques devastadores.",
    signatureMechanics: [
      "Olhar Petrificante (converte a defesa inimiga em pedra vulnerável)",
      "Fúria Heroica (bônus de dano massivo em investidas diretas)",
      "Cinzas Imortais (a Fênix cura o Coração do Reino ao ser derrotada)",
    ],
    startingBiomes: [
      "terra-vulcanica",
      "montanha-antiga",
      "campos-ancestrais",
      "terra-vulcanica",
    ],
    kingdomHeart: {
      name: "Partenon do Monte Olimpo",
      subtitle: "Panteão dos Deuses Imortais",
      maxHp: 20,
      intactPropFrame: PROP_ART.throne,
      damagedPropFrame: PROP_ART.relic,
      criticalPropFrame: PROP_ART.ruin,
      destroyedPropFrame: PROP_ART.rubble,
    },
    audioThemeId: "montanhas-runicas",
  },
  egito: {
    id: "egito",
    name: "Mitologia Egípcia",
    countryLabel: "Egito",
    themeSummary: "Dunas douradas, julgamento das almas, enigmas milenares e maldições do deserto.",
    playstyleDescription:
      "Expande o Deserto Sagrado e o Rio das Almas para invocar a Esfinge, Ammit, Anúbis e Ahuizotl, desgastando o oponente com tempestades de areia e pesando seus pecados.",
    signatureMechanics: [
      "Enigma da Esfinge (força o oponente a gastar mais Sopro Ancestral)",
      "Pesagem do Coração (dano proporcional ao número de cartas na mão inimiga)",
      "Oásis do Nilo (cura e proteção contra o calor abrasador)",
    ],
    startingBiomes: [
      "deserto-sagrado",
      "rio-dos-espiritos",
      "deserto-sagrado",
      "campos-ancestrais",
    ],
    kingdomHeart: {
      name: "Grande Pirâmide de Kemet",
      subtitle: "Templo Eterno do Sol e do Além",
      maxHp: 20,
      intactPropFrame: PROP_ART.relic,
      damagedPropFrame: PROP_ART.brazier,
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
