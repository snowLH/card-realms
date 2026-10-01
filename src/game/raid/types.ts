import type { BattleSide, BattleTerrain } from "../battle";
import type { Element, EnergyPool } from "../domain/elements";

export const RAID_MIN_PLAYERS = 2 as const;
export const RAID_MAX_PLAYERS = 5 as const;
export const RAID_BOSS_ID = "raid-boss" as const;

export type RaidStatus = "active" | "victory" | "defeat";
export type RaidPhase = 1 | 2 | 3;

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
  needsSwitch: boolean;
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
  | "power_drawn"
  | "power_equipped"
  | "creature_switched"
  | "evolution_started"
  | "evolution_completed"
  | "die_rolled"
  | "attack_hit"
  | "attack_miss"
  | "critical"
  | "boss_attack"
  | "boss_area_attack"
  | "creature_ko"
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
  attackId?: string;
  targetIds?: string[];
  phase?: RaidPhase;
  terrainElement?: Element;
  creatureIndex?: number;
  energyCardId?: string;
  energyElement?: Element;
  powerCardId?: string;
};

export type RaidState = {
  version: 1;
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
  teamIds: readonly string[];
  evolutionStages?: readonly number[];
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
