import type { AttackDefinition, CreatureDefinition, Element } from "../types";

export type CreatureSeed = Omit<CreatureDefinition, "attacks" | "sprite"> & {
  moves: [string, string, string];
  spriteIndex: number;
  spriteSheet?: string;
};

export const DEFAULT_SPRITE_SHEET = "/art/folklore-creatures-five-elements.png";
const SPRITE_COLUMNS = 5;
const SPRITE_ROWS = 5;

function attack(
  id: string,
  name: string,
  element: Element,
  energy: 1 | 2 | 3,
  damage: number,
  minRoll: 2 | 3 | 4,
  animation: AttackDefinition["animation"],
  description: string,
  effect?: AttackDefinition["effect"],
): AttackDefinition {
  return { id, name, cost: { [element]: energy }, damage, minRoll, animation, description, effect };
}

const attackFactory: Record<Element, (seed: CreatureSeed) => CreatureDefinition["attacks"]> = {
  fire: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "fire", 1, 22, 2, "flame", "Ataque direto com chance de deixar o alvo em chamas.", { type: "burn", chance: 20, amount: 7, duration: 2 }),
    attack(`${seed.id}-2`, seed.moves[1], "fire", 2, 50, 3, "flame", "Uma descarga de calor concentrado.", { type: "burn", chance: 35, amount: 8, duration: 2 }),
    attack(`${seed.id}-3`, seed.moves[2], "fire", 3, 86, 4, "flame", "A manifestação mais intensa da criatura.", { type: "burn", chance: 55, amount: 10, duration: 3 }),
  ],
  water: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "water", 1, 20, 2, "wave", "Um golpe fluido e confiável."),
    attack(`${seed.id}-2`, seed.moves[1], "water", 2, 45, 3, "wave", "Encharca o alvo e o deixa vulnerável à Tempestade.", { type: "soaked", chance: 45, duration: 2 }),
    attack(`${seed.id}-3`, seed.moves[2], "water", 3, 74, 4, "wave", "A corrente restaura parte da vitalidade de quem a conduz.", { type: "heal", amount: 20 }),
  ],
  nature: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "nature", 1, 18, 2, "nature", "Ataque firme ligado ao território."),
    attack(`${seed.id}-2`, seed.moves[1], "nature", 2, 43, 2, "nature", "Prende os passos do alvo e bloqueia trocas voluntárias.", { type: "rooted", chance: 35, duration: 1 }),
    attack(`${seed.id}-3`, seed.moves[2], "nature", 3, 78, 4, "nature", "O terreno responde e forma uma proteção viva.", { type: "shield", amount: 22 }),
  ],
  storm: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "storm", 1, 21, 2, "storm", "Um movimento veloz conduzido pelo vento."),
    attack(`${seed.id}-2`, seed.moves[1], "storm", 2, 48, 3, "storm", "A descarga dificulta a próxima ação do alvo.", { type: "shocked", chance: 35, duration: 1 }),
    attack(`${seed.id}-3`, seed.moves[2], "storm", 3, 82, 4, "storm", "Céu e vento convergem em um único impacto."),
  ],
  spirit: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "spirit", 1, 19, 2, "spirit", "Um eco sobrenatural que enfraquece a ofensiva inimiga.", { type: "haunted", chance: 25, duration: 1 }),
    attack(`${seed.id}-2`, seed.moves[1], "spirit", 2, 44, 3, "spirit", "Um rito defensivo acompanha o golpe.", { type: "warded", chance: 100, duration: 2 }),
    attack(`${seed.id}-3`, seed.moves[2], "spirit", 3, 76, 4, "spirit", "A presença ancestral ocupa toda a arena.", { type: "heal", amount: 16 }),
  ],
};

export function materializeCreatureSeeds(seeds: readonly CreatureSeed[]): CreatureDefinition[] {
  return seeds.map(({ moves, spriteIndex, spriteSheet = DEFAULT_SPRITE_SHEET, ...seed }) => {
    const completeSeed = { ...seed, moves, spriteIndex, spriteSheet } as CreatureSeed;
    return {
      ...seed,
      attacks: attackFactory[seed.element](completeSeed),
      sprite: {
        sheet: spriteSheet,
        column: spriteIndex % SPRITE_COLUMNS,
        row: Math.floor(spriteIndex / SPRITE_COLUMNS),
        columns: SPRITE_COLUMNS,
        rows: SPRITE_ROWS,
      },
    };
  });
}
