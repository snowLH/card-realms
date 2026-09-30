export const BATTLE_BOARD_IDS = [
  "cartographer",
  "ashes",
  "tides",
  "roots",
  "storms",
  "veil",
] as const;

export type BattleBoardId = (typeof BATTLE_BOARD_IDS)[number];

export type BattleBoardDefinition = {
  id: BattleBoardId;
  name: string;
  shortName: string;
  description: string;
  elementLabel: string;
  ambientLabel: string;
};

export const BATTLE_BOARDS: BattleBoardDefinition[] = [
  {
    id: "cartographer",
    name: "Tabuleiro do Cartógrafo",
    shortName: "Cartógrafo",
    description: "Mesa de explorador com mapas, bússola, pergaminhos e velas.",
    elementLabel: "Neutro",
    ambientLabel: "Poeira de pergaminho e velas",
  },
  {
    id: "ashes",
    name: "Santuário das Cinzas",
    shortName: "Cinzas",
    description: "Pedras vulcânicas, brasas, runas e pequenas chamas vivas.",
    elementLabel: "Fogo",
    ambientLabel: "Brasas, fumaça e runas",
  },
  {
    id: "tides",
    name: "Templo das Marés",
    shortName: "Marés",
    description: "Ruínas inundadas cercadas por reflexos, ondas e gotas.",
    elementLabel: "Água",
    ambientLabel: "Ondas, gotas e reflexos",
  },
  {
    id: "roots",
    name: "Bosque das Raízes",
    shortName: "Raízes",
    description: "Floresta antiga com raízes, pedras, cogumelos e vaga-lumes.",
    elementLabel: "Natureza",
    ambientLabel: "Folhas, vaga-lumes e raízes",
  },
  {
    id: "storms",
    name: "Altar das Tempestades",
    shortName: "Tempestades",
    description: "Arena elevada com nuvens, bandeiras e relâmpagos distantes.",
    elementLabel: "Tempestade",
    ambientLabel: "Vento, folhas e relâmpagos",
  },
  {
    id: "veil",
    name: "Santuário do Véu",
    shortName: "Véu",
    description: "Névoa, lanternas, símbolos e luzes espirituais flutuantes.",
    elementLabel: "Espírito",
    ambientLabel: "Névoa, orbes e lanternas",
  },
];

export const BATTLE_BOARD_BY_ID = new Map(BATTLE_BOARDS.map((board) => [board.id, board]));

export function isBattleBoardId(value: unknown): value is BattleBoardId {
  return typeof value === "string" && BATTLE_BOARD_IDS.includes(value as BattleBoardId);
}

export function resolveBattleBoard(value: unknown): BattleBoardId {
  return isBattleBoardId(value) ? value : "cartographer";
}
