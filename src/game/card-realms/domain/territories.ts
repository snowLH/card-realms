import { FX_ART, PROP_ART } from "@/game/arpg/art/manifest";
import type { Element } from "@/game/types";
import type { TerritoryBiomeId } from "./types";

export type TerritoryVisualConfig = {
  tilesetRegionId: "mata-encantada" | "arquipelago-das-mares" | "montanhas-runicas";
  tileFrames: readonly [number, number, number, number];
  primaryPropFrame: number;
  secondaryPropFrame: number;
  tertiaryPropFrame: number;
  groundOverlayPropFrame: number;
  ambientFxFrame: number;
  summonAuraFxFrame: number;
  tintHex: number;
};

export type TerritoryBiomeDefinition = {
  id: TerritoryBiomeId;
  name: string;
  shortName: string;
  element: Element;
  tagline: string;
  description: string;
  favoredElements: readonly Element[];
  attackBonusForFavored: number;
  attackPenaltyForElement?: {
    element: Element;
    penalty: number;
  };
  turnStartHealForFavored?: number;
  turnEndBurnNonFire?: number;
  summonShieldBonus?: number;
  summonMaxHpBonus?: number;
  preventsEnemyVeilInLane?: boolean;
  awakeningPowerBonus?: number;
  visual: TerritoryVisualConfig;
};

export const TERRITORY_BIOMES: Readonly<Record<TerritoryBiomeId, TerritoryBiomeDefinition>> = {
  "campos-ancestrais": {
    id: "campos-ancestrais",
    name: "Campos Ancestrais",
    shortName: "Campos",
    element: "nature",
    tagline: "Terra fértil pronta para ser moldada pelas lendas.",
    description:
      "Solo neutro equilibrado. Criaturas invocadas aqui recebem +1 de Vida Máxima enquanto o terreno aguarda transformação.",
    favoredElements: [],
    attackBonusForFavored: 0,
    summonMaxHpBonus: 1,
    visual: {
      tilesetRegionId: "mata-encantada",
      tileFrames: [0, 1, 2, 0],
      primaryPropFrame: PROP_ART.shrub,
      secondaryPropFrame: PROP_ART.rock,
      tertiaryPropFrame: PROP_ART.relic,
      groundOverlayPropFrame: PROP_ART.moss,
      ambientFxFrame: FX_ART.dust,
      summonAuraFxFrame: FX_ART.purificationRing,
      tintHex: 0xd9cfa8,
    },
  },
  "mata-encantada": {
    id: "mata-encantada",
    name: "Mata Encantada",
    shortName: "Mata",
    element: "nature",
    tagline: "Raízes vivas e copas fechadas que protegem os guardiões da floresta.",
    description:
      "Concede +2 ATQ a lendas de Natureza e restaura +1 PV no início do turno. Reage ao fogo (vira Terra Vulcânica) e às cheias (vira Rio dos Espíritos).",
    favoredElements: ["nature"],
    attackBonusForFavored: 2,
    turnStartHealForFavored: 1,
    visual: {
      tilesetRegionId: "mata-encantada",
      tileFrames: [1, 2, 3, 4],
      primaryPropFrame: PROP_ART.tree,
      secondaryPropFrame: PROP_ART.stump,
      tertiaryPropFrame: PROP_ART.roots,
      groundOverlayPropFrame: PROP_ART.roots,
      ambientFxFrame: FX_ART.leaf,
      summonAuraFxFrame: FX_ART.rootZone,
      tintHex: 0x7fd878,
    },
  },
  "rio-dos-espiritos": {
    id: "rio-dos-espiritos",
    name: "Rio dos Espíritos",
    shortName: "Rio",
    element: "water",
    tagline: "Águas correntes onde vozes encantadas e yōkai fluviais reinam.",
    description:
      "Concede +2 ATQ a lendas de Água, +1 Escudo ao invocar e reduz em -1 ATQ criaturas de Fogo posicionadas nesta faixa.",
    favoredElements: ["water"],
    attackBonusForFavored: 2,
    summonShieldBonus: 1,
    attackPenaltyForElement: {
      element: "fire",
      penalty: 1,
    },
    visual: {
      tilesetRegionId: "arquipelago-das-mares",
      tileFrames: [0, 1, 2, 3],
      primaryPropFrame: PROP_ART.coral,
      secondaryPropFrame: PROP_ART.tideSpring,
      tertiaryPropFrame: PROP_ART.seaweed,
      groundOverlayPropFrame: PROP_ART.puddle,
      ambientFxFrame: FX_ART.waterDrop,
      summonAuraFxFrame: FX_ART.waterZone,
      tintHex: 0x6fd2ff,
    },
  },
  "montanha-antiga": {
    id: "montanha-antiga",
    name: "Montanha Antiga",
    shortName: "Montanha",
    element: "storm",
    tagline: "Escarpes rochosos e ventos altos onde guerreiros e seres alados dominam.",
    description:
      "Concede +2 de Vida Máxima à criatura invocada e +2 ATQ para lendas de Tempestade ou com afinidade montanhosa.",
    favoredElements: ["storm"],
    attackBonusForFavored: 2,
    summonMaxHpBonus: 2,
    visual: {
      tilesetRegionId: "montanhas-runicas",
      tileFrames: [0, 1, 2, 3],
      primaryPropFrame: PROP_ART.rock,
      secondaryPropFrame: PROP_ART.pine,
      tertiaryPropFrame: PROP_ART.crystal,
      groundOverlayPropFrame: PROP_ART.rune,
      ambientFxFrame: FX_ART.lightningFragment,
      summonAuraFxFrame: FX_ART.wardIdle,
      tintHex: 0xb7c6e8,
    },
  },
  "terra-vulcanica": {
    id: "terra-vulcanica",
    name: "Terra Vulcânica",
    shortName: "Vulcânico",
    element: "fire",
    tagline: "Solo rachado por brasas que alimentam serpentes de fogo e ogros.",
    description:
      "Concede +2 ATQ a lendas de Fogo. Ao final do turno, causa 1 de dano de brasa a criaturas não-ígneas posicionadas neste território.",
    favoredElements: ["fire"],
    attackBonusForFavored: 2,
    turnEndBurnNonFire: 1,
    visual: {
      tilesetRegionId: "montanhas-runicas",
      tileFrames: [2, 3, 4, 5],
      primaryPropFrame: PROP_ART.brazier,
      secondaryPropFrame: PROP_ART.campfire,
      tertiaryPropFrame: PROP_ART.cracks,
      groundOverlayPropFrame: PROP_ART.cracks,
      ambientFxFrame: FX_ART.ember,
      summonAuraFxFrame: FX_ART.corruptionBurst,
      tintHex: 0xff8559,
    },
  },
  "reino-congelado": {
    id: "reino-congelado",
    name: "Reino Congelado",
    shortName: "Congelado",
    element: "water",
    tagline: "Geada ancestral que retarda investidas e preserva fortalezas.",
    description:
      "Concede +2 de Escudo ao invocar criaturas aqui e reduz em -1 ATQ investidas de Fogo contra esta faixa.",
    favoredElements: ["water", "spirit"],
    attackBonusForFavored: 1,
    summonShieldBonus: 2,
    attackPenaltyForElement: {
      element: "fire",
      penalty: 1,
    },
    visual: {
      tilesetRegionId: "montanhas-runicas",
      tileFrames: [1, 3, 5, 6],
      primaryPropFrame: PROP_ART.crystal,
      secondaryPropFrame: PROP_ART.pine,
      tertiaryPropFrame: PROP_ART.snow,
      groundOverlayPropFrame: PROP_ART.snow,
      ambientFxFrame: FX_ART.snow,
      summonAuraFxFrame: FX_ART.wardPulse,
      tintHex: 0xa6ecff,
    },
  },
  "deserto-sagrado": {
    id: "deserto-sagrado",
    name: "Deserto Sagrado",
    shortName: "Deserto",
    element: "fire",
    tagline: "Areias solares que dissipam miragens e revelam qualquer emboscada.",
    description:
      "Concede +1 ATQ a criaturas posicionadas aqui e impede que a criatura inimiga oposta mantenha Véu de Ilusão.",
    favoredElements: ["fire", "storm"],
    attackBonusForFavored: 1,
    preventsEnemyVeilInLane: true,
    visual: {
      tilesetRegionId: "mata-encantada",
      tileFrames: [4, 5, 6, 4],
      primaryPropFrame: PROP_ART.ruin,
      secondaryPropFrame: PROP_ART.relic,
      tertiaryPropFrame: PROP_ART.rubble,
      groundOverlayPropFrame: PROP_ART.rubble,
      ambientFxFrame: FX_ART.spark,
      summonAuraFxFrame: FX_ART.purificationRays,
      tintHex: 0xf4cc70,
    },
  },
  "reino-espiritual": {
    id: "reino-espiritual",
    name: "Reino Espiritual",
    shortName: "Espiritual",
    element: "spirit",
    tagline: "Santuário entre mundos onde raposas místicas e encantados despertam.",
    description:
      "Concede +2 ATQ a lendas de Espírito e amplifica em +1 o impacto de qualquer Despertar Ancestral ativado nesta faixa.",
    favoredElements: ["spirit"],
    attackBonusForFavored: 2,
    awakeningPowerBonus: 1,
    visual: {
      tilesetRegionId: "arquipelago-das-mares",
      tileFrames: [4, 5, 6, 7],
      primaryPropFrame: PROP_ART.lantern,
      secondaryPropFrame: PROP_ART.legendShrine,
      tertiaryPropFrame: PROP_ART.rune,
      groundOverlayPropFrame: PROP_ART.rune,
      ambientFxFrame: FX_ART.magicStar,
      summonAuraFxFrame: FX_ART.purificationRing,
      tintHex: 0xd09cff,
    },
  },
};

export function getTerritoryBiome(biomeId: TerritoryBiomeId): TerritoryBiomeDefinition {
  return TERRITORY_BIOMES[biomeId];
}

/**
 * Resolves how a territory biome transforms when exposed to an elemental catalyst
 * (e.g. fire burning a forest into volcanic earth, water flooding volcanic earth or forest into a river).
 */
export function resolveElementalBiomeReaction(
  currentBiome: TerritoryBiomeId,
  catalyst: "fire" | "water" | "nature" | "spirit" | "frost",
): { nextBiome: TerritoryBiomeId; reacted: boolean; reason: string } {
  if (catalyst === "fire") {
    if (currentBiome === "mata-encantada" || currentBiome === "campos-ancestrais") {
      return {
        nextBiome: "terra-vulcanica",
        reacted: true,
        reason: "As chamas consumiram a vegetação e abriram fendas de Terra Vulcânica!",
      };
    }
    if (currentBiome === "reino-congelado") {
      return {
        nextBiome: "rio-dos-espiritos",
        reacted: true,
        reason: "O calor derreteu a geada ancestral, formando um Rio dos Espíritos!",
      };
    }
  }

  if (catalyst === "water") {
    if (currentBiome === "terra-vulcanica") {
      return {
        nextBiome: "campos-ancestrais",
        reacted: true,
        reason: "As águas apagaram as brasas vulcânicas e fertilizaram os Campos Ancestrais!",
      };
    }
    if (currentBiome !== "rio-dos-espiritos") {
      return {
        nextBiome: "rio-dos-espiritos",
        reacted: true,
        reason: "A correnteza inundou o território e abriu o Rio dos Espíritos!",
      };
    }
  }

  if (catalyst === "nature") {
    if (currentBiome !== "mata-encantada") {
      return {
        nextBiome: "mata-encantada",
        reacted: true,
        reason: "Raízes e copas brotaram, transformando o território em Mata Encantada!",
      };
    }
  }

  if (catalyst === "spirit") {
    if (currentBiome !== "reino-espiritual") {
      return {
        nextBiome: "reino-espiritual",
        reacted: true,
        reason: "O véu místico consagrou o solo como Reino Espiritual!",
      };
    }
  }

  if (catalyst === "frost") {
    if (currentBiome === "rio-dos-espiritos" || currentBiome === "campos-ancestrais") {
      return {
        nextBiome: "reino-congelado",
        reacted: true,
        reason: "O sopro invernal congelou a paisagem em um Reino Congelado!",
      };
    }
  }

  return {
    nextBiome: currentBiome,
    reacted: false,
    reason: "O terreno manteve sua forma atual.",
  };
}
