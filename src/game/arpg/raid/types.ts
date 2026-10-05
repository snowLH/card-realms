import type { Element } from "@/game/types";
import type { ArpgLoadout } from "../domain/types";

export const ARPG_RAID_MIN_PLAYERS = 2 as const;
export const ARPG_RAID_MAX_PLAYERS = 5 as const;
export const ARPG_RAID_STATE_VERSION = 2 as const;

export type ArpgRaidStatus = "active" | "victory" | "defeat";
export type ArpgRaidPhase = 1 | 2 | 3;

export type ArpgRaidInputVector = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
};

export type ArpgRaidContribution = {
  actions: number;
  damage: number;
  healing: number;
  damageTaken: number;
};

export type ArpgRaidPlayerState = {
  id: string;
  name: string;
  seat: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  loadout: ArpgLoadout;
  input: ArpgRaidInputVector;
  nextAttackAtMs: number;
  nextDashAtMs: number;
  dashingUntilMs: number;
  dashX: number;
  dashY: number;
  abilityReadyAtMs: Record<string, number>;
  basicAttackCounter: number;
  contribution: ArpgRaidContribution;
};

export type ArpgRaidBossState = {
  catalogId: string;
  name: string;
  element: Element;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: ArpgRaidPhase;
  speed: number;
  nextAttackAtMs: number;
  slowedUntilMs: number;
};

export type ArpgRaidEventKind =
  | "raid_started"
  | "player_moved"
  | "player_attack"
  | "player_dash"
  | "ability_cast"
  | "player_healed"
  | "player_damaged"
  | "player_defeated"
  | "boss_attack"
  | "boss_phase"
  | "raid_victory"
  | "raid_defeat";

export type ArpgRaidEvent = {
  id: string;
  sequence: number;
  atMs: number;
  actorId: string;
  kind: ArpgRaidEventKind;
  message: string;
  damage?: number;
  healing?: number;
  targetIds?: string[];
  phase?: ArpgRaidPhase;
};

export type ArpgRaidState = {
  version: typeof ARPG_RAID_STATE_VERSION;
  roomId: string;
  eventId: string;
  status: ArpgRaidStatus;
  startedAtMs: number;
  serverTimeMs: number;
  maxDurationMs: number;
  players: ArpgRaidPlayerState[];
  boss: ArpgRaidBossState;
  processedActionIds: string[];
  eventSequence: number;
  log: ArpgRaidEvent[];
};

export type ArpgRaidPlayerSetup = {
  id: string;
  name: string;
  seat: number;
  loadout: ArpgLoadout;
};

export type ArpgRaidBossSetup = {
  catalogId: string;
  maxHp: number;
  speed: number;
  maxDurationMs?: number;
};

export type ArpgRaidAction =
  | { kind: "input"; actionId: string; moveX: number; moveY: number; aimX: number; aimY: number }
  | { kind: "attack"; actionId: string }
  | { kind: "dash"; actionId: string }
  | { kind: "ability"; actionId: string; slot: 0 | 1 };

export type ArpgRaidActionResult = {
  state: ArpgRaidState;
  events: ArpgRaidEvent[];
};
