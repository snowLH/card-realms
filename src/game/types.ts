export const ELEMENTS = [
  "fire",
  "water",
  "nature",
  "electric",
  "ice",
  "shadow",
  "neutral",
] as const;

export type Element = (typeof ELEMENTS)[number];

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

export type EnergyPool = Record<Element, number>;

export type EnergyCost = Partial<Record<Element, number>>;

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
  animation:
    | "flame"
    | "wave"
    | "nature"
    | "electric"
    | "ice"
    | "shadow"
    | "strike";
  effect?: AttackEffect;
};

export type CreatureDefinition = {
  id: string;
  name: string;
  title: string;
  description: string;
  lore: string;
  inspiration: string;
  regionId: string;
  element: Element;
  traits: string[];
  rarity: Rarity;
  role: CombatRole;
  hp: number;
  defense: number;
  speed: number;
  attacks: [AttackDefinition, AttackDefinition, AttackDefinition];
  evolutionFamily?: string;
  evolutionStage?: 1 | 2 | 3;
  evolvesTo?: string;
  obtainableBy: string;
  eventExclusive?: boolean;
  artSlot: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

export type BattleCreature = {
  instanceId: string;
  catalogId: string;
  hp: number;
  maxHp: number;
  attachedEnergy: EnergyPool;
  statuses: Array<{ effect: StatusEffect; turns: number }>;
  defeated: boolean;
};

export type BattleSide = {
  id: string;
  name: string;
  kind: "player" | "npc" | "boss";
  team: [
    BattleCreature,
    BattleCreature,
    BattleCreature,
    BattleCreature,
    BattleCreature,
    BattleCreature,
  ];
  activeIndex: number;
  energyAvailable: EnergyPool;
  energyReserve: EnergyPool;
  acquiredThisTurn: number;
  attachmentsThisTurn: number;
  discard: EnergyPool;
};

export type BattleLogEntry = {
  id: string;
  turn: number;
  actorId: string;
  kind:
    | "battle_start"
    | "energy_acquired"
    | "energy_attached"
    | "creature_switched"
    | "attack_hit"
    | "attack_miss"
    | "critical"
    | "defeated"
    | "battle_end";
  message: string;
  die?: number;
  damage?: number;
  attackId?: string;
};

export type BattleState = {
  id: string;
  mode: "wild" | "npc" | "pvp" | "sanctuary" | "boss";
  status: "active" | "finished";
  round: number;
  turnNumber: number;
  currentSideId: string;
  sides: [BattleSide, BattleSide];
  winnerId?: string;
  processedActionIds: string[];
  log: BattleLogEntry[];
};

export type BattleActionResult = {
  state: BattleState;
  events: BattleLogEntry[];
};

export type RegionDefinition = {
  id: string;
  name: string;
  subtitle: string;
  inspiration: string;
  recommendedLevel: string;
  discovered: number;
  totalCreatures: number;
  status: "open" | "locked" | "event";
  mapPosition: { x: number; y: number };
  activities: Array<"explore" | "wild" | "npc" | "treasure" | "sanctuary" | "boss">;
  accent: string;
};
