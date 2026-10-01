import type { CreatureSeed } from "../creature-seed";

export const ECLIPSE_CREATURE_SEEDS: CreatureSeed[] = [
  {
      id: "black-shuck", name: "Black Shuck", title: "Cão Negro de East Anglia",
      description: "Cão espectral de pelagem negra e olhos ou olho em brasa que percorre estradas e costas inglesas.",
      lore: "Alguns relatos o tratam como presságio perigoso; outros, como acompanhante ou protetor de viajantes solitários.",
      folklore: { tradition: "Folclore inglês", origin: "East Anglia, Inglaterra", sourceNote: "O nome e o comportamento variam em narrativas locais de cães negros espectrais.", adaptation: "Mantém porte canino, pelagem negra e olhar luminoso, incluindo sua ambiguidade entre ameaça e guarda." },
      regionId: "eclipse", element: "spirit", traits: ["canino", "espectral", "presságio"], rarity: "rare", role: "guardian",
      hp: 152, defense: 72, speed: 68, moves: ["Passo na Estrada", "Olho em Brasa", "Vigília de Black Shuck"],
      obtainableBy: "Estradas costeiras do Reino do Eclipse", spriteIndex: 20,
    },
  {
      id: "banshee", name: "Banshee", title: "Mensageira do Lamento",
      description: "Figura feminina sobrenatural irlandesa cujo lamento anuncia uma morte na família.",
      lore: "Não é simplesmente uma atacante: sua função tradicional é pressagiar e lamentar, aparecendo em formas jovens ou idosas.",
      folklore: { tradition: "Folclore irlandês", origin: "Irlanda", sourceNote: "O nome deriva de bean sí, mulher do povo feérico, e os relatos se ligam a famílias e territórios.", adaptation: "Transforma o lamento em controle de batalha sem apagar seu papel de mensageira." },
      regionId: "eclipse", element: "spirit", traits: ["feérico", "lamento", "presságio"], rarity: "epic", role: "controller",
      hp: 118, defense: 44, speed: 76, moves: ["Sussurro do Sídhe", "Véu do Presságio", "Lamento da Banshee"],
      obtainableBy: "Colinas silenciosas do Reino do Eclipse", spriteIndex: 23,
    },
];
