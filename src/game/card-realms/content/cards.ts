import { ART_ATLASES, FX_ART, PROP_ART } from "@/game/arpg/art/manifest";
import { CHARACTER_PORTRAITS } from "@/game/content/character-portraits";
import type { SpriteDefinition } from "@/game/types";
import type {
  CardDefinition,
  CreatureCardDefinition,
  EventCardDefinition,
  StructureCardDefinition,
  TerritoryCardDefinition,
} from "../domain/types";

function propPortrait(frame: number): SpriteDefinition {
  return {
    sheet: ART_ATLASES.props.path,
    columns: 8,
    rows: 8,
    column: frame % 8,
    row: Math.floor(frame / 8),
  };
}

function fxPortrait(frame: number): SpriteDefinition {
  return {
    sheet: ART_ATLASES.fx.path,
    columns: 8,
    rows: 8,
    column: frame % 8,
    row: Math.floor(frame / 8),
  };
}

export const CREATURE_CARDS: readonly CreatureCardDefinition[] = [
  // ============================================================================
  // 🇧🇷 CULTURA BRASILEIRA (Natureza, Transformação, Engano e Proteção da Mata)
  // ============================================================================
  {
    id: "legend-curupira",
    name: "Curupira",
    subtitle: "Guardião dos Pés Virados",
    culture: "brasil",
    category: "creature",
    rarity: "epic",
    cost: 2,
    element: "nature",
    attack: 3,
    maxHp: 5,
    favoredBiomes: ["mata-encantada"],
    biomeAttackBonus: 2,
    actorId: "curupira",
    resistances: ["nature", "water"],
    weaknesses: ["fire"],
    passiveTrait: {
      name: "Passos Invertidos",
      description: "Regenera +1 PV na Mata Encantada e confunde invasores.",
    },
    portrait: CHARACTER_PORTRAITS["curupira"],
    description:
      "Ganha +2 ATQ e regenera na Mata Encantada. Escolha atacar ou usar seu poder para confundir os rastros do inimigo.",
    folkloreNote:
      "Entidade das matas brasileiras de cabelos de fogo e pés voltados para trás que desorienta invasores e protege a fauna.",
    awakeningPower: {
      id: "curupira-rastro-invertido",
      name: "Rastro Invertido",
      description:
        "Faz brotar Mata Encantada neste território, aplica Confusão à criatura inimiga oposta (desorientando seu próximo ataque) e causa 2 de dano.",
      targetKind: "self-lane",
      animationElement: "nature",
    },
  },
  {
    id: "legend-iara",
    name: "Iara",
    subtitle: "Senhora do Canto das Águas",
    culture: "brasil",
    category: "creature",
    rarity: "epic",
    cost: 3,
    element: "water",
    attack: 3,
    maxHp: 6,
    favoredBiomes: ["rio-dos-espiritos"],
    biomeAttackBonus: 2,
    biomeShieldBonus: 1,
    actorId: "iara",
    resistances: ["water", "fire"],
    weaknesses: ["storm"],
    passiveTrait: {
      name: "Melodia das Águas",
      description: "Recebe +1 Escudo ao surgir no Rio dos Espíritos.",
    },
    portrait: CHARACTER_PORTRAITS["iara"],
    description:
      "Ganha +2 ATQ e +1 Escudo no Rio dos Espíritos. Seu canto inunda o território e restaura aliados.",
    folkloreNote:
      "Encantada das águas doces amazônicas cuja melodia hipnotiza viajantes nas margens dos rios.",
    awakeningPower: {
      id: "iara-canto-da-margem",
      name: "Canto da Margem",
      description:
        "Transforma seu território em Rio dos Espíritos, aplica Enraizado (-1 ATQ) ao inimigo oposto, causa 2 de dano aquático e cura 2 PV de todos os aliados.",
      targetKind: "self-lane",
      animationElement: "water",
    },
  },
  {
    id: "legend-saci",
    name: "Saci-Pererê",
    subtitle: "Travesso do Redemoinho",
    culture: "brasil",
    category: "creature",
    rarity: "rare",
    cost: 2,
    element: "storm",
    attack: 2,
    maxHp: 4,
    favoredBiomes: ["mata-encantada", "reino-espiritual"],
    biomeAttackBonus: 2,
    swiftArrival: true,
    resistances: ["storm"],
    weaknesses: ["fire"],
    passiveTrait: {
      name: "Impulso do Redemoinho",
      description: "Age imediatamente no mesmo turno em que é invocado.",
    },
    portrait: CHARACTER_PORTRAITS["saci-perere"],
    description:
      "Impulso Veloz: pode agir no mesmo turno em que é invocado! Ganha +2 ATQ na Mata Encantada ou Reino Espiritual.",
    folkloreNote:
      "Figura travessa de uma perna só e gorro vermelho que viaja dentro de redemoinhos de vento e prega peças nos caminhos.",
    awakeningPower: {
      id: "saci-redemoinho-de-vento",
      name: "Redemoinho do Saci",
      description:
        "Cria um redemoinho que troca a criatura inimiga oposta de faixa, aplica Confusão, causa 2 de dano de vento e compra 1 carta.",
      targetKind: "self-lane",
      animationElement: "storm",
    },
  },
  {
    id: "legend-boitata",
    name: "Boitatá",
    subtitle: "Serpente de Fogo da Mata",
    culture: "brasil",
    category: "creature",
    rarity: "legendary",
    cost: 4,
    element: "fire",
    attack: 4,
    maxHp: 6,
    favoredBiomes: ["terra-vulcanica", "mata-encantada"],
    biomeAttackBonus: 2,
    resistances: ["fire", "nature"],
    weaknesses: ["water"],
    passiveTrait: {
      name: "Escamas Incandescentes",
      description: "Imune ao dano de brasa da Terra Vulcânica.",
    },
    portrait: CHARACTER_PORTRAITS["boitata"],
    description:
      "Ganha +2 ATQ na Terra Vulcânica ou na Mata Encantada. Incendeia o território invasor com fogo guardião.",
    folkloreNote:
      "Serpente luminosa de fogo vivo que vigia os campos e matas contra aqueles que tentam destruí-los.",
    awakeningPower: {
      id: "boitata-circulo-incandescente",
      name: "Círculo Incandescente",
      description:
        "Incendeia o território inimigo oposto em Terra Vulcânica, causa 3 de dano de fogo com Brasa Viva e concede +2 Escudo ao Boitatá.",
      targetKind: "self-lane",
      animationElement: "fire",
    },
  },
  {
    id: "legend-mapinguari",
    name: "Mapinguari",
    subtitle: "Colosso das Profundezas da Mata",
    culture: "brasil",
    category: "creature",
    rarity: "legendary",
    cost: 5,
    element: "nature",
    attack: 5,
    maxHp: 8,
    favoredBiomes: ["mata-encantada", "montanha-antiga"],
    biomeAttackBonus: 2,
    biomeShieldBonus: 2,
    actorId: "mapinguari",
    resistances: ["nature", "storm"],
    weaknesses: ["fire"],
    passiveTrait: {
      name: "Casco Ancestral",
      description: "Recebe +2 Escudo ao surgir na Mata Encantada ou Montanha Antiga.",
    },
    portrait: CHARACTER_PORTRAITS["mapinguari"],
    description:
      "Guardião colossal. Ganha +2 ATQ e +2 Escudo na Mata Encantada ou Montanha Antiga.",
    folkloreNote:
      "Gigante lendário das matas profundas da Amazônia cujo rugido faz tremer as árvores e afugenta caçadores.",
    awakeningPower: {
      id: "mapinguari-rugido-da-terra",
      name: "Rugido da Terra Viva",
      description:
        "Estremece todo o tabuleiro causando 2 de dano a todas as criaturas inimigas, enraíza a faixa oposta e restaura 3 PV do Mapinguari.",
      targetKind: "global",
      animationElement: "nature",
    },
  },

  // ============================================================================
  // 🇯🇵 CULTURA JAPONESA (Espíritos Yōkai, Ilusões, Troca de Posição e Montanha)
  // ============================================================================
  {
    id: "legend-kitsune",
    name: "Kitsune",
    subtitle: "Raposa das Nove Ilusões",
    culture: "japao",
    category: "creature",
    rarity: "epic",
    cost: 2,
    element: "spirit",
    attack: 3,
    maxHp: 5,
    favoredBiomes: ["reino-espiritual"],
    biomeAttackBonus: 2,
    resistances: ["spirit"],
    weaknesses: ["storm"],
    passiveTrait: {
      name: "Nove Caudas Místicas",
      description: "Amplifica miragens e bloqueia golpes com Véu de Ilusão.",
    },
    portrait: CHARACTER_PORTRAITS["kitsune"],
    description:
      "Ganha +2 ATQ no Reino Espiritual. Tece miragens de fogo-raposa que ocultam aliados e drenam inimigos.",
    folkloreNote:
      "Raposa sobrenatural do folclore japonês dotada de sabedoria ancestral, metamorfose e chamas espirituais (kitsunebi).",
    awakeningPower: {
      id: "kitsune-miragem-kitsunebi",
      name: "Miragem Kitsunebi",
      description:
        "Consagra seu território em Reino Espiritual, envolve a si mesma em Véu de Ilusão (bloqueia o próximo golpe) e causa 2 de dano espiritual na faixa oposta.",
      targetKind: "self-lane",
      animationElement: "spirit",
    },
  },
  {
    id: "legend-kappa",
    name: "Kappa",
    subtitle: "Guardião do Redemoinho Fluvial",
    culture: "japao",
    category: "creature",
    rarity: "rare",
    cost: 2,
    element: "water",
    attack: 2,
    maxHp: 6,
    favoredBiomes: ["rio-dos-espiritos"],
    biomeAttackBonus: 2,
    biomeShieldBonus: 2,
    actorId: "kappa",
    resistances: ["water", "fire"],
    weaknesses: ["nature"],
    passiveTrait: {
      name: "Carapaça Ribeirinha",
      description: "Recebe +2 Escudo ao surgir no Rio dos Espíritos.",
    },
    portrait: CHARACTER_PORTRAITS["kappa"],
    description:
      "Ganha +2 ATQ e +2 Escudo no Rio dos Espíritos. Puxa oponentes para a correnteza e endurece sua carapaça.",
    folkloreNote:
      "Yōkai anfíbio dos rios japoneses que carrega água sagrada no topo da cabeça e desafia viajantes para lutas de sumô.",
    awakeningPower: {
      id: "kappa-desafio-prato-dagua",
      name: "Desafio do Prato d'Água",
      description:
        "Inunda seu território em Rio dos Espíritos, recebe +3 Escudo, puxa um inimigo lateral para a faixa oposta se vazia e causa 2 de dano aquático.",
      targetKind: "self-lane",
      animationElement: "water",
    },
  },
  {
    id: "legend-tengu",
    name: "Tengu",
    subtitle: "Mestre dos Ventos da Montanha",
    culture: "japao",
    category: "creature",
    rarity: "epic",
    cost: 3,
    element: "storm",
    attack: 4,
    maxHp: 5,
    favoredBiomes: ["montanha-antiga", "reino-espiritual"],
    biomeAttackBonus: 2,
    resistances: ["storm", "nature"],
    weaknesses: ["spirit"],
    passiveTrait: {
      name: "Asas de Yamabushi",
      description: "Domina correntes de vento nas Montanhas Antigas.",
    },
    portrait: CHARACTER_PORTRAITS["tengu"],
    description:
      "Ganha +2 ATQ na Montanha Antiga ou Reino Espiritual. Domina as correntes de ar para trocar de posição e emboscar.",
    folkloreNote:
      "Espírito alado das montanhas sagradas do Japão, mestre das artes marciais e senhor dos vendavais.",
    awakeningPower: {
      id: "tengu-vendaval-yamabushi",
      name: "Vendaval de Yamabushi",
      description:
        "Concede +2 ATQ neste turno (Despertar Elevado), golpeia a faixa oposta com 3 de dano de tempestade e pode trocar de faixa com um território aliado.",
      targetKind: "self-lane",
      animationElement: "storm",
    },
  },
  {
    id: "legend-oni",
    name: "Oni",
    subtitle: "Demônio do Trovão Rubro",
    culture: "japao",
    category: "creature",
    rarity: "legendary",
    cost: 4,
    element: "fire",
    attack: 5,
    maxHp: 7,
    favoredBiomes: ["montanha-antiga", "terra-vulcanica"],
    biomeAttackBonus: 2,
    resistances: ["fire", "storm"],
    weaknesses: ["water"],
    passiveTrait: {
      name: "Força Demolidora",
      description: "Sua clava destrói estruturas e racha o território.",
    },
    portrait: CHARACTER_PORTRAITS["oni"],
    description:
      "Força bruta avassaladora. Ganha +2 ATQ na Montanha Antiga ou Terra Vulcânica e esmaga construções inimigas.",
    folkloreNote:
      "Ogro colossal do folclore japonês que empunha uma clava de ferro (kanabō) capaz de partir rochas e santuários.",
    awakeningPower: {
      id: "oni-clava-ferro-ardente",
      name: "Clava de Ferro Ardente",
      description:
        "Destrói imediatamente a Estrutura inimiga na faixa oposta, racha o solo inimigo em Terra Vulcânica e causa 3 de dano ao inimigo ou ao Coração do Reino.",
      targetKind: "self-lane",
      animationElement: "fire",
    },
  },
  {
    id: "legend-raiju",
    name: "Raijū",
    subtitle: "Fera do Relâmpago Celeste",
    culture: "japao",
    category: "creature",
    rarity: "legendary",
    cost: 3,
    element: "storm",
    attack: 4,
    maxHp: 4,
    favoredBiomes: ["montanha-antiga", "reino-espiritual"],
    biomeAttackBonus: 2,
    swiftArrival: true,
    actorId: "raiju",
    resistances: ["storm", "spirit"],
    weaknesses: ["nature"],
    passiveTrait: {
      name: "Corpo de Relâmpago",
      description: "Impulso Veloz: age imediatamente ao surgir.",
    },
    portrait: CHARACTER_PORTRAITS["raiju"],
    description:
      "Impulso Veloz: pode agir no mesmo turno em que é invocado! Ganha +2 ATQ na Montanha Antiga ou Reino Espiritual.",
    folkloreNote:
      "Companheiro das tempestades de Raijin que salta entre nuvens carregadas em forma de lobo elétrico.",
    awakeningPower: {
      id: "raiju-salto-entre-nuvens",
      name: "Salto entre Nuvens",
      description:
        "Descarrega um relâmpago em cadeia que causa 3 de dano à criatura oposta e 2 de dano direto ao Coração do Reino adversário.",
      targetKind: "self-lane",
      animationElement: "storm",
    },
  },
];

export const TERRITORY_CARDS: readonly TerritoryCardDefinition[] = [
  {
    id: "territory-mata-profunda",
    name: "Mata Profunda",
    subtitle: "Território Vivo — Floresta Ancestral",
    culture: "brasil",
    category: "territory",
    rarity: "common",
    cost: 1,
    element: "nature",
    biomeId: "mata-encantada",
    portrait: propPortrait(PROP_ART.tree),
    description:
      "Transforma uma faixa aliada em Mata Encantada (+2 ATQ para Natureza, regenera +1 PV por turno) e cura 2 PV da criatura aliada posicionada nela.",
    folkloreNote:
      "As matas fechadas onde as árvores se entrelaçam para proteger seus guardiões.",
    onPlaceEffect: {
      healAllyCreature: 2,
    },
  },
  {
    id: "territory-nascente-espiritos",
    name: "Nascente dos Espíritos",
    subtitle: "Território Vivo — Águas Encantadas",
    culture: "neutral",
    category: "territory",
    rarity: "common",
    cost: 1,
    element: "water",
    biomeId: "rio-dos-espiritos",
    portrait: propPortrait(PROP_ART.tideSpring),
    description:
      "Transforma uma faixa aliada em Rio dos Espíritos (+2 ATQ para Água, enfraquece Fogo) e concede +2 Escudo à criatura aliada posicionada nela.",
    folkloreNote:
      "Rios cristalinos e igarapés onde Iara e Kappa encontram força nas correntezas.",
    onPlaceEffect: {
      shieldAllyCreature: 2,
    },
  },
  {
    id: "territory-santuario-espiritual",
    name: "Véu do Reino Espiritual",
    subtitle: "Território Vivo — Fronteira Mística",
    culture: "japao",
    category: "territory",
    rarity: "rare",
    cost: 1,
    element: "spirit",
    biomeId: "reino-espiritual",
    portrait: propPortrait(PROP_ART.lantern),
    description:
      "Transforma uma faixa aliada em Reino Espiritual (+2 ATQ para Espírito e +1 de impacto em Despertar Ancestral) e compra 1 carta.",
    folkloreNote:
      "Solo iluminado por lanternas espirituais onde o mundo visível toca o reino dos yōkai.",
    onPlaceEffect: {
      drawCards: 1,
    },
  },
  {
    id: "territory-picos-montanha",
    name: "Picos da Montanha Antiga",
    subtitle: "Território Vivo — Escarpes Sagrados",
    culture: "japao",
    category: "territory",
    rarity: "common",
    cost: 1,
    element: "storm",
    biomeId: "montanha-antiga",
    portrait: propPortrait(PROP_ART.rock),
    description:
      "Transforma uma faixa aliada em Montanha Antiga (+2 ATQ para Tempestade, +2 PV ao invocar) e concede +2 de Vida à criatura aliada na faixa.",
    folkloreNote:
      "Cumes rochosos envoltos em nuvens onde Tengu e Oni treinam sua força.",
    onPlaceEffect: {
      buffMaxHpAlly: 2,
    },
  },
];

export const STRUCTURE_CARDS: readonly StructureCardDefinition[] = [
  {
    id: "structure-altar-clareira",
    name: "Altar da Clareira Viva",
    subtitle: "Estrutura Sagrada da Floresta",
    culture: "brasil",
    category: "structure",
    rarity: "rare",
    cost: 2,
    element: "nature",
    maxHp: 5,
    propFrame: PROP_ART.forestAltar,
    effectId: "altar-clareira-viva",
    attackAuraBonus: 1,
    favorBiomeId: "mata-encantada",
    turnStartHeal: 2,
    portrait: propPortrait(PROP_ART.forestAltar),
    description:
      "Concede +1 ATQ à criatura nesta faixa e restaura 2 PV dela no início de cada turno.",
    folkloreNote:
      "Pedra ritual coberta de musgo e raízes luminosas que renova o vigor dos protetores da mata.",
  },
  {
    id: "structure-fonte-aguas-doces",
    name: "Fonte das Águas Doces",
    subtitle: "Santuário Ribeirinho",
    culture: "brasil",
    category: "structure",
    rarity: "rare",
    cost: 2,
    element: "water",
    maxHp: 6,
    propFrame: PROP_ART.waterAltar,
    effectId: "fonte-aguas-doces",
    turnStartShield: 2,
    heartShieldReduction: 2,
    portrait: propPortrait(PROP_ART.waterAltar),
    description:
      "No início do turno, concede +2 Escudo à criatura aliada na faixa e +1 Escudo ao seu Coração do Reino.",
    folkloreNote:
      "Nascente guardada pelas encantadas que amortece qualquer investida contra o reino.",
  },
  {
    id: "structure-portao-torii",
    name: "Portão Torii Espiritual",
    subtitle: "Portal dos Espíritos",
    culture: "japao",
    category: "structure",
    rarity: "epic",
    cost: 2,
    element: "spirit",
    maxHp: 5,
    propFrame: PROP_ART.legendShrine,
    effectId: "portao-torii-espiritual",
    attackAuraBonus: 1,
    favorBiomeId: "reino-espiritual",
    portrait: propPortrait(PROP_ART.legendShrine),
    description:
      "Concede +1 ATQ à criatura na faixa e aplica Véu de Ilusão sempre que você invoca uma criatura neste território.",
    folkloreNote:
      "Portal sagrado que marca a passagem para o domínio dos espíritos e protege quem o atravessa.",
  },
  {
    id: "structure-torre-montanha",
    name: "Torre de Vigia da Montanha",
    subtitle: "Bastião dos Ventos",
    culture: "japao",
    category: "structure",
    rarity: "rare",
    cost: 2,
    element: "storm",
    maxHp: 6,
    propFrame: PROP_ART.runicAltar,
    effectId: "torre-vigia-montanha",
    turnEndStrikeDamage: 2,
    portrait: propPortrait(PROP_ART.runicAltar),
    description:
      "Ao final do seu turno, dispara rajadas espirituais causando 2 de dano à criatura inimiga na faixa oposta.",
    folkloreNote:
      "Sentinela erguida nos desfiladeiros para fustigar invasores antes que alcancem o santuário.",
  },
];

export const EVENT_CARDS: readonly EventCardDefinition[] = [
  {
    id: "event-enchente-pororoca",
    name: "Enchente da Pororoca",
    subtitle: "Evento Climático — Grande Onda do Rio",
    culture: "brasil",
    category: "event",
    rarity: "rare",
    cost: 2,
    element: "water",
    effectId: "enchente-pororoca",
    requiresLane: true,
    fxFrame: FX_ART.waterZone,
    portrait: fxPortrait(FX_ART.waterZone),
    description:
      "Inunda ambos os lados da faixa escolhida transformando-os em Rio dos Espíritos e causa 3 de dano à criatura inimiga naquela faixa.",
    folkloreNote:
      "O encontro estrondoso das águas que redesenha margens inteiras e arrasta invasores.",
  },
  {
    id: "event-incendio-brasa-viva",
    name: "Incêndio de Brasa Viva",
    subtitle: "Evento Climático — Fogo Guardião",
    culture: "brasil",
    category: "event",
    rarity: "rare",
    cost: 2,
    element: "fire",
    effectId: "incendio-brasa-viva",
    requiresLane: true,
    fxFrame: FX_ART.corruptionBurst,
    portrait: fxPortrait(FX_ART.corruptionBurst),
    description:
      "Incendeia o território inimigo na faixa escolhida em Terra Vulcânica, causa 3 de dano à criatura inimiga e 2 de dano à Estrutura inimiga.",
    folkloreNote:
      "Chamas invocadas para purificar o campo e punir quem invade a floresta.",
  },
  {
    id: "event-eclipse-das-lendas",
    name: "Eclipse das Lendas",
    subtitle: "Evento Astral — Despertar dos Mitos",
    culture: "japao",
    category: "event",
    rarity: "legendary",
    cost: 3,
    element: "spirit",
    effectId: "eclipse-das-lendas",
    requiresLane: false,
    fxFrame: FX_ART.purificationRing,
    portrait: fxPortrait(FX_ART.purificationRing),
    description:
      "Consagra seus Campos Ancestrais em Reino Espiritual, concede +2 ATQ a todas as suas criaturas neste turno e compra 1 carta.",
    folkloreNote:
      "Quando o sol se oculta, a fronteira espiritual se abre e todas as lendas atingem seu ápice.",
  },
  {
    id: "event-neblina-dos-espiritos",
    name: "Neblina dos Espíritos",
    subtitle: "Evento Místico — Bruma Yokai",
    culture: "japao",
    category: "event",
    rarity: "epic",
    cost: 2,
    element: "spirit",
    effectId: "neblina-dos-espiritos",
    requiresLane: false,
    fxFrame: FX_ART.wardAppear,
    portrait: fxPortrait(FX_ART.wardAppear),
    description:
      "Cobre todas as suas criaturas com Véu de Ilusão (bloqueia o próximo golpe recebido) e concede +1 Escudo a cada uma.",
    folkloreNote:
      "Espessa cerração espiritual onde silhuetas se multiplicam e golpes inimigos cortam apenas o ar.",
  },
];

export const ALL_CARD_REALMS_CARDS: readonly CardDefinition[] = [
  ...CREATURE_CARDS,
  ...TERRITORY_CARDS,
  ...STRUCTURE_CARDS,
  ...EVENT_CARDS,
];

export const CARD_BY_ID = new Map<string, CardDefinition>(
  ALL_CARD_REALMS_CARDS.map((card) => [card.id, card]),
);
