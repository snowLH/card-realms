import type { CultureId, GuidedStepHint } from "../domain/types";

export const BRASIL_STARTER_DECK_CARD_IDS: readonly string[] = [
  "legend-curupira",
  "legend-curupira",
  "legend-saci",
  "legend-saci",
  "legend-iara",
  "legend-iara",
  "legend-boitata",
  "legend-mapinguari",
  "territory-mata-profunda",
  "territory-mata-profunda",
  "territory-nascente-espiritos",
  "structure-altar-clareira",
  "structure-fonte-aguas-doces",
  "event-enchente-pororoca",
  "event-incendio-brasa-viva",
  "event-enchente-pororoca",
];

export const JAPAO_STARTER_DECK_CARD_IDS: readonly string[] = [
  "legend-kitsune",
  "legend-kitsune",
  "legend-kappa",
  "legend-kappa",
  "legend-tengu",
  "legend-raiju",
  "legend-oni",
  "legend-tengu",
  "territory-santuario-espiritual",
  "territory-santuario-espiritual",
  "territory-picos-montanha",
  "structure-portao-torii",
  "structure-torre-montanha",
  "event-eclipse-das-lendas",
  "event-neblina-dos-espiritos",
  "event-neblina-dos-espiritos",
];

export const NORDICO_STARTER_DECK_CARD_IDS: readonly string[] = [
  "legend-ratatoskr",
  "legend-ratatoskr",
  "legend-kelpie",
  "legend-kelpie",
  "legend-amarok",
  "legend-yeti",
  "legend-amarok",
  "legend-yeti",
  "territory-reino-congelado",
  "territory-reino-congelado",
  "territory-picos-montanha",
  "structure-monolito-runico",
  "structure-monolito-runico",
  "event-fimbulwinter",
  "event-fimbulwinter",
  "event-neblina-dos-espiritos",
];

export const GRECIA_STARTER_DECK_CARD_IDS: readonly string[] = [
  "legend-minotauro",
  "legend-minotauro",
  "legend-medusa",
  "legend-medusa",
  "legend-fenix",
  "legend-fenix",
  "legend-minotauro",
  "legend-medusa",
  "territory-terra-vulcanica",
  "territory-terra-vulcanica",
  "territory-picos-montanha",
  "structure-templo-olimpico",
  "structure-templo-olimpico",
  "event-ira-titas",
  "event-ira-titas",
  "event-incendio-brasa-viva",
];

export const EGITO_STARTER_DECK_CARD_IDS: readonly string[] = [
  "legend-ahuizotl",
  "legend-ahuizotl",
  "legend-esfinge",
  "legend-esfinge",
  "legend-ammit",
  "legend-ammit",
  "legend-esfinge",
  "legend-ahuizotl",
  "territory-deserto-sagrado",
  "territory-deserto-sagrado",
  "territory-nascente-espiritos",
  "structure-obelisco-solar",
  "structure-obelisco-solar",
  "event-tempestade-khamsin",
  "event-tempestade-khamsin",
  "event-enchente-pororoca",
];

export function getStarterDeckForCulture(culture: CultureId): readonly string[] {
  switch (culture) {
    case "brasil":
      return BRASIL_STARTER_DECK_CARD_IDS;
    case "japao":
      return JAPAO_STARTER_DECK_CARD_IDS;
    case "nordico":
      return NORDICO_STARTER_DECK_CARD_IDS;
    case "grecia":
      return GRECIA_STARTER_DECK_CARD_IDS;
    case "egito":
      return EGITO_STARTER_DECK_CARD_IDS;
  }
}

/**
 * Curated opening sequence for Section 14 ("A Primeira Partida Precisa Ser Inesquecível").
 * Guarantees that the Brazilian strategist starts with Curupira, Mata Profunda, Altar da Clareira Viva,
 * and Iara in hand, while the Japanese strategist opens with Kitsune, Véu do Reino Espiritual, Kappa, and Portão Torii.
 */
export const DEMO_GUIDED_DECKS: Readonly<Record<CultureId, readonly string[]>> = {
  brasil: [
    // Initial 4-card hand:
    "legend-curupira",
    "territory-mata-profunda",
    "structure-altar-clareira",
    "legend-iara",
    // Next draws:
    "legend-saci",
    "event-enchente-pororoca",
    "legend-boitata",
    "territory-nascente-espiritos",
    "structure-fonte-aguas-doces",
    "legend-mapinguari",
    "event-incendio-brasa-viva",
    "legend-curupira",
    "legend-saci",
    "legend-iara",
    "territory-mata-profunda",
    "event-enchente-pororoca",
  ],
  japao: [
    // Initial 4-card hand:
    "legend-kitsune",
    "territory-santuario-espiritual",
    "legend-kappa",
    "structure-portao-torii",
    // Next draws:
    "legend-tengu",
    "event-neblina-dos-espiritos",
    "legend-oni",
    "territory-picos-montanha",
    "legend-raiju",
    "structure-torre-montanha",
    "event-eclipse-das-lendas",
    "legend-kitsune",
    "legend-kappa",
    "legend-tengu",
    "territory-santuario-espiritual",
    "event-neblina-dos-espiritos",
  ],
  nordico: NORDICO_STARTER_DECK_CARD_IDS,
  grecia: GRECIA_STARTER_DECK_CARD_IDS,
  egito: EGITO_STARTER_DECK_CARD_IDS,
};

export const DEMO_GUIDED_HINTS: readonly GuidedStepHint[] = [
  {
    stepIndex: 0,
    title: "Passo 1 — A Lenda Ganha Vida na Floresta",
    instruction:
      "Você começa com uma Mata Encantada na Faixa 1. Selecione a carta do Curupira na sua mão e clique na Faixa 1 para invocá-lo sobre o território florestal!",
    recommendedCardId: "legend-curupira",
    recommendedLane: 0,
    recommendedAction: "play-card",
  },
  {
    stepIndex: 1,
    title: "Passo 2 — Expanda Seu Território Vivo",
    instruction:
      "Use seu Sopro Ancestral restante para jogar a carta de território 'Mata Profunda' na Faixa 2, transformando os Campos Ancestrais em floresta viva!",
    recommendedCardId: "territory-mata-profunda",
    recommendedLane: 1,
    recommendedAction: "play-card",
  },
  {
    stepIndex: 2,
    title: "Passo 3 — Encerre o Turno e Observe o Adversário Yokai",
    instruction:
      "Clique em 'Encerrar Turno' para ver o estrategista do Folclore Japonês preparar o Reino Espiritual e materializar a Kitsune!",
    recommendedAction: "end-turn",
  },
  {
    stepIndex: 3,
    title: "Passo 4 — A Decisão Central: Investida ou Despertar Ancestral",
    instruction:
      "Curupira está pronto na Faixa 1 (+2 ATQ pela Mata Encantada)! Clique nele no tabuleiro e escolha entre ⚔️ INVESTIDA (Atacar) ou 🔮 DESPERTAR ANCESTRAL (Rastro Invertido para confundir o inimigo)!",
    recommendedLane: 0,
    recommendedAction: "despertar",
  },
];
