import type { CreatureSeed } from "../creature-seed";

export const DEEP_SEA_CREATURE_SEEDS: CreatureSeed[] = [
  {
      id: "kelpie", name: "Kelpie", title: "Cavalo das Águas Profundas",
      description: "Espírito aquático escocês que assume a forma de cavalo junto a rios e lagos.",
      lore: "Atrai viajantes para o dorso e os leva para a água; algumas versões permitem dominá-lo ao tomar suas rédeas.",
      folklore: { tradition: "Folclore escocês", origin: "Escócia", sourceNote: "Pertence a um conjunto amplo de tradições célticas sobre cavalos d'água.", adaptation: "Mantém forma equina, crina molhada e comportamento traiçoeiro." },
      regionId: "deep-sea", element: "water", traits: ["equino", "metamorfo", "lago"], rarity: "rare", role: "striker",
      hp: 136, defense: 54, speed: 78, moves: ["Casco de Lago", "Rédea Encharcada", "Mergulho do Kelpie"],
      obtainableBy: "Lagos escuros do Mar das Profundezas", spriteIndex: 7,
    },
  {
      id: "ahuizotl", name: "Ahuízotl", title: "Caçador das Águas Mexicas",
      description: "Ser aquático de aspecto canino ou mustelídeo, com uma mão na extremidade da cauda.",
      lore: "Fontes coloniais registraram que atraía pessoas para a água e usava a mão caudal para capturá-las.",
      folklore: { tradition: "Tradição mexica registrada no período colonial", origin: "Vale do México", sourceNote: "É descrito em fontes como o Códice Florentino, com variações de interpretação zoológica e mítica.", adaptation: "Mantém corpo aquático e mão caudal; não o converte em lontra comum." },
      regionId: "deep-sea", element: "water", traits: ["aquático", "mão caudal", "caçador"], rarity: "epic", role: "controller",
      hp: 138, defense: 58, speed: 74, moves: ["Garra da Cauda", "Chamado da Margem", "Poço do Ahuízotl"],
      obtainableBy: "Ruínas lacustres do Mar das Profundezas", spriteIndex: 9,
    },
];
