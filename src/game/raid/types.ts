import type { ActiveStatus, BattleSide, BattleTerrain } from "../battle";
import type { Element, EnergyPool } from "../domain/elements";
import type { AvatarConfig } from "../save/local-progress";

export const RAID_MIN_PLAYERS = 2 as const;
export const RAID_MAX_PLAYERS = 5 as const;
export const RAID_BOSS_ID = "raid-boss" as const;
export const RAID_STATE_VERSION = 2 as const;
export const RAID_GAMEPLAY_VERSION = 2 as const;

export type RaidGameplayMode = "avatar" | "arpg" | "legacy";

export type RaidStatus = "active" | "victory" | "defeat";
export type RaidPhase = 1 | 2 | 3;
export type RaidAbilityIds = [string, string];

export type RaidContribution = {
  actions: number;
  damage: number;
  healing: number;
  shield: number;
  buffs: number;
  debuffs: number;
  terrain: number;
};

export type RaidPlayerState = {
  id: string;
  name: string;
  seat: number;
  side: BattleSide;
  eliminated: boolean;
  contribution: RaidContribution;
};

export type RaidBossState = {
  id: typeof RAID_BOSS_ID;
  catalogId: string;
  name: string;
  element: Element;
  hp: number;
  maxHp: number;
  shield: number;
  statuses: ActiveStatus[];
  phase: RaidPhase;
  speed: number;
  enraged: boolean;
};

export type RaidTurn = {
  actorId: string;
  actorKind: "player" | "boss";
  round: number;
  index: number;
};

export type RaidLogKind =
  | "raid_started"
  | "turn_started"
  | "energy_drawn"
  | "energy_attached"
  | "ability_used"
  | "attack_hit"
  | "attack_miss"
  | "critical"
  | "healed"
  | "shielded"
  | "status_applied"
  | "status_tick"
  | "defeated"
  | "boss_attack"
  | "boss_area_attack"
  | "player_eliminated"
  | "phase_changed"
  | "terrain_activated"
  | "terrain_expired"
  | "passed"
  | "raid_victory"
  | "raid_defeat";

export type RaidLogEntry = {
  id: string;
  sequence: number;
  round: number;
  actorId: string;
  kind: RaidLogKind;
  message: string;
  die?: number;
  damage?: number;
  abilityId?: string;
  abilitySlot?: 0 | 1;
  effect?: ActiveStatus["effect"] | "heal" | "shield";
  targetIds?: string[];
  phase?: RaidPhase;
  terrainElement?: Element;
  terrainTurns?: number;
  energyCardId?: string;
  energyElement?: Element;
};

export type RaidState = {
  version: typeof RAID_STATE_VERSION;
  eventSequence: number;
  roomId: string;
  eventId: string;
  bossCreatureId: string;
  status: RaidStatus;
  maxRounds: number;
  players: RaidPlayerState[];
  boss: RaidBossState;
  turnOrder: string[];
  turn: RaidTurn;
  terrain?: BattleTerrain;
  processedActionIds: string[];
  log: RaidLogEntry[];
};

export type RaidActionResult = {
  state: RaidState;
  events: RaidLogEntry[];
};

export type RaidPlayerSetup = {
  id: string;
  name: string;
  seat: number;
  avatarConfig: AvatarConfig;
  abilityIds: readonly string[];
  energy?: EnergyPool;
};

export type RaidBossSetup = {
  catalogId: string;
  maxHp: number;
  speed: number;
  maxRounds: number;
};

export type RaidEventDefinition = {
  slug: string;
  title: string;
  bossCreatureId: string;
  startsAt: string;
  endsAt: string;
  presentationTimezone: "America/Sao_Paulo";
  minPlayers: 2;
  maxPlayers: 5;
  recommendedLevel: number;
  boss: RaidBossSetup;
};
