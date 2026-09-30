import type { AttackEffect, StatusEffect } from "../domain/creatures";
import type { Element } from "../domain/elements";

export const TEAM_SIZE = 6 as const;
export const ENERGY_DECK_SIZE = 30 as const;
export const OPENING_HAND_SIZE = 5 as const;
export const DRAW_PER_TURN = 2 as const;
export const ATTACHMENTS_PER_TURN = 2 as const;

export type Team<T> = T[];

export type BattleReward = {
  coins: number;
  xp: number;
  creatureId: string | null;
  replayed?: boolean;
};

export type BattleEncounter =
  | { kind: "wild"; regionId: string; creatureId: string }
  | { kind: "npc"; regionId: string; npcId: string }
  | { kind: "sanctuary"; regionId: string; areaId: string }
  | { kind: "boss"; regionId: string; areaId: string };

export type EnergyCard = {
  id: string;
  element: Element;
};

export type ActiveStatus = {
  effect: StatusEffect;
  turns: number;
  amount?: number;
  sourceAttackId: string;
};

export type BattleCreature = {
  instanceId: string;
  catalogId: string;
  hp: number;
  maxHp: number;
  shield: number;
  attachedEnergy: EnergyCard[];
  statuses: ActiveStatus[];
  defeated: boolean;
};

export type BattleSide = {
  id: string;
  name: string;
  kind: "player" | "npc" | "boss";
  team: Team<BattleCreature>;
  activeIndex: number;
  energyDeck: EnergyCard[];
  energyHand: EnergyCard[];
  energyDiscard: EnergyCard[];
  attachmentsRemaining: number;
  turnsStarted: number;
};

export type TurnPhase = "main" | "forced_switch";

export type BattleTurn = {
  sideId: string;
  phase: TurnPhase;
  number: number;
  round: number;
};

export type BattleLogKind =
  | "battle_start"
  | "turn_started"
  | "energy_drawn"
  | "energy_attached"
  | "creature_switched"
  | "forced_switch"
  | "attack_hit"
  | "attack_miss"
  | "critical"
  | "status_applied"
  | "status_tick"
  | "healed"
  | "shielded"
  | "passed"
  | "defeated"
  | "battle_end";

export type BattleLogEntry = {
  id: string;
  turn: number;
  actorId: string;
  kind: BattleLogKind;
  message: string;
  die?: number;
  damage?: number;
  attackId?: string;
  effect?: AttackEffect["type"];
};

export type BattleState = {
  version: 2;
  id: string;
  mode: "wild" | "npc" | "pvp" | "sanctuary" | "boss";
  status: "active" | "finished";
  turn: BattleTurn;
  sides: [BattleSide, BattleSide];
  winnerId?: string;
  processedActionIds: string[];
  log: BattleLogEntry[];
};

export type BattleActionResult = {
  state: BattleState;
  events: BattleLogEntry[];
};

export type RandomSource = () => number;

