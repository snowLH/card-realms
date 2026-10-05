import type { StatusEffect } from "../domain/creatures";
import type { Element } from "../domain/elements";
import type { AvatarConfig } from "../save/local-progress";

export const BATTLE_VERSION = 3 as const;
export const ABILITY_SLOT_COUNT = 2 as const;
export const ENERGY_DECK_SIZE = 30 as const;
export const OPENING_HAND_SIZE = 5 as const;
export const DRAW_PER_TURN = 2 as const;
export const ATTACHMENTS_PER_TURN = 1 as const;

export type AbilityIds = [string, string];

export type BattleReward = {
  coins: number;
  xp: number;
  replayed?: boolean;
};

export type BattleEncounter =
  | { kind: "wild"; regionId: string; creatureId: string }
  | { kind: "npc"; regionId: string; npcId: string }
  | { kind: "sanctuary"; regionId: string; areaId: string }
  | { kind: "boss"; regionId: string; areaId: string };

export type EnergyCardZone = "deck" | "hand" | "attached" | "discard";

export type EnergyCard = {
  id: string;
  element: Element;
  origin: "battle_deck" | "inventory";
  ownerId: string;
  zone: EnergyCardZone;
  attachedTo: string | null;
  status: "ready" | "spent";
};

export type ActiveStatus = {
  effect: StatusEffect;
  turns: number;
  amount?: number;
  sourceAbilityId: string;
};

/** One player-authored avatar or one server-authored opponent in battle. */
export type BattleSide = {
  id: string;
  name: string;
  kind: "player" | "npc" | "boss";
  avatarConfig: AvatarConfig;
  abilityIds: AbilityIds;
  abilityCooldowns: [number, number];
  element: Element;
  hp: number;
  maxHp: number;
  shield: number;
  statuses: ActiveStatus[];
  attachedEnergy: EnergyCard[];
  energyDeck: EnergyCard[];
  energyHand: EnergyCard[];
  energyDiscard: EnergyCard[];
  attachmentsRemaining: number;
  turnsStarted: number;
};

export type BattleTurn = {
  sideId: string;
  number: number;
  round: number;
};

export type BattleTerrain = {
  element: Element;
  sourceSideId: string;
  activatedTurn: number;
  expiresAfterTurn: number;
};

export type BattleLogKind =
  | "battle_start"
  | "turn_started"
  | "energy_drawn"
  | "energy_attached"
  | "ability_used"
  | "attack_hit"
  | "attack_miss"
  | "critical"
  | "status_applied"
  | "status_tick"
  | "healed"
  | "shielded"
  | "passed"
  | "conceded"
  | "defeated"
  | "terrain_activated"
  | "terrain_expired"
  | "battle_end";

export type BattleLogEntry = {
  id: string;
  turn: number;
  actorId: string;
  kind: BattleLogKind;
  message: string;
  die?: number;
  damage?: number;
  abilityId?: string;
  abilitySlot?: 0 | 1;
  effect?: StatusEffect | "heal" | "shield";
  terrainElement?: Element;
  terrainTurns?: number;
  energyCardId?: string;
  energyElement?: Element;
};

export type BattleState = {
  version: typeof BATTLE_VERSION;
  id: string;
  mode: "wild" | "npc" | "pvp" | "sanctuary" | "boss";
  status: "active" | "finished";
  regionId?: string;
  turn: BattleTurn;
  sides: [BattleSide, BattleSide];
  winnerId?: string;
  terrain?: BattleTerrain;
  processedActionIds: string[];
  log: BattleLogEntry[];
};

export type BattleActionResult = {
  state: BattleState;
  events: BattleLogEntry[];
};

export type RandomSource = () => number;
