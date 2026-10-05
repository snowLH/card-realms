import type { Element, EnergyCost } from "./elements";

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type CombatRole =
  | "striker"
  | "guardian"
  | "support"
  | "controller"
  | "skirmisher";

export type StatusEffect =
  | "burn"
  | "soaked"
  | "rooted"
  | "shocked"
  | "haunted"
  | "warded";

export type AttackEffect = {
  type: StatusEffect | "heal" | "shield";
  chance?: number;
  amount?: number;
  duration?: number;
};
export type AttackDefinition = {
  id: string;
  name: string;
  description: string;
  cost: EnergyCost;
  damage: number;
  minRoll: 2 | 3 | 4;
  animation: "flame" | "wave" | "nature" | "storm" | "spirit" | "strike";
  effect?: AttackEffect;
};

export type FolkloreReference = {
  tradition: string;
  origin: string;
  sourceNote: string;
  adaptation: string;
};

export type SpriteDefinition = {
  sheet: string;
  column: number;
  row: number;
  columns: number;
  rows: number;
};

export type EvolutionStageDefinition = {
  stage: 0 | 1 | 2;
  name: string;
  title: string;
  sprite: SpriteDefinition;
  adaptation: string;
};

export type EvolutionLine = [EvolutionStageDefinition, EvolutionStageDefinition, EvolutionStageDefinition];

export type CreatureDefinition = {
  id: string;
  name: string;
  title: string;
  description: string;
  lore: string;
  folklore: FolkloreReference;
  regionId: string;
  element: Element;
  traits: string[];
  rarity: Rarity;
  role: CombatRole;
  hp: number;
  defense: number;
  speed: number;
  attacks: [AttackDefinition, AttackDefinition, AttackDefinition];
  obtainableBy: string;
  eventExclusive?: boolean;
  sprite: SpriteDefinition;
  evolutionLine?: EvolutionLine;
};

export function resolveCreatureEvolutionStage(definition: CreatureDefinition, stage: number): EvolutionStageDefinition {
  const normalized: 0 | 1 | 2 = stage >= 2 ? 2 : stage >= 1 ? 1 : 0;
  return definition.evolutionLine?.[normalized] ?? { stage: normalized, name: definition.name, title: definition.title, sprite: definition.sprite, adaptation: "Forma de apresentação padrão." };
}
