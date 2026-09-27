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
};
