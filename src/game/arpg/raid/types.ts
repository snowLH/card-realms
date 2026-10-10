import type { Element } from "@/game/types";
import type { ArpgLoadout } from "../domain/types";

export const ARPG_RAID_MIN_PLAYERS = 2 as const;
/** Four Legends keep a shared room readable on desktop and touch screens. */
export const ARPG_RAID_MAX_PLAYERS = 4 as const;
export const ARPG_RAID_STATE_VERSION = 2 as const;
export const ARPG_RAID_PLAYER_MARGIN = 45 as const;
/** Input keep-alives arrive at most every ~900 ms; after this window stale movement is stopped server-side. */
export const ARPG_RAID_INPUT_STALE_MS = 2_500 as const;

export type ArpgRaidStatus = "active" | "victory" | "defeat";
export type ArpgRaidPhase = 1 | 2 | 3;
export type ArpgRaidDungeonRegionId = "mata-encantada" | "arquipelago-das-mares" | "montanhas-runicas";

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
  arthurOaths?: import("../bosses/king-arthur/playable-kit").ArthurOaths;
  seenBossIntroIds?: string[];
  nextBossDamageAtMs?: number;
  id: string;
  name: string;
  seat: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Server-clock deadline for a teammate to revive this player; zero means eliminated or active. */
  downedUntilMs: number;
  loadout: ArpgLoadout;
  input: ArpgRaidInputVector;
  /** Server time of the latest movement/aim packet, used to stop runaway movement after disconnects. */
  lastInputAtMs: number;
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

export type ArpgRaidDungeonEnemyState = {
  id: string;
  definitionId: string;
  name: string;
  waveIndex: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  contactDamage: number;
  moveSpeed: number;
  slowedUntilMs: number;
  nextAttackAtMs: number;
};

export type ArpgRaidDungeonRoomState = {
  id: string;
  type: "start" | "combat" | "treasure" | "event" | "elite" | "rest" | "shop" | "boss";
  templateId: string;
  label: string;
  /** Playable room area before the east exit corridor. */
  roomWidth: number;
  /** Walkable east corridor which connects this room to the next transition. */
  corridorWidth: number;
  worldWidth: number;
  worldHeight: number;
  waves: string[][];
  waveIndex: number;
  state: "combat" | "awaiting_exit" | "cleared";
  waveCompleteAtMs: number | null;
  nextRoomAtMs: number | null;
  enemies: ArpgRaidDungeonEnemyState[];
};

/** Shared sequence generated once for the whole party and persisted in raid_rooms.state. */
export type ArpgRaidDungeonState = {
  regionId: ArpgRaidDungeonRegionId;
  seed: string;
  roomIndex: number;
  rooms: ArpgRaidDungeonRoomState[];
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
  | "player_revived"
  | "player_eliminated"
  | "dungeon_room_entered"
  | "dungeon_wave_cleared"
  | "dungeon_room_cleared"
  | "dungeon_enemy_attack"
  | "dungeon_enemy_defeated"
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
  bossEncounter?: import("../bosses/boss-encounter-controller").BossEncounterSnapshot;
  version: typeof ARPG_RAID_STATE_VERSION;
  roomId: string;
  eventId: string;
  status: ArpgRaidStatus;
  startedAtMs: number;
  serverTimeMs: number;
  maxDurationMs: number;
  players: ArpgRaidPlayerState[];
  /** Shared by the whole party for one encounter. */
  reviveCharges: number;
  /** Absent on older boss-only raid rooms; new ARPG runs carry a shared room sequence. */
  dungeon?: ArpgRaidDungeonState;
  boss: ArpgRaidBossState;
  processedActionIds: string[];
  eventSequence: number;
  log: ArpgRaidEvent[];
};

export type ArpgRaidPlayerSetup = {
  seenBossIntroIds?: string[];
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
  | { kind: "skip_intro"; actionId: string }
  | { kind: "input"; actionId: string; moveX: number; moveY: number; aimX: number; aimY: number }
  | { kind: "attack"; actionId: string }
  | { kind: "dash"; actionId: string }
  | { kind: "ability"; actionId: string; slot: 0 | 1 }
  | { kind: "revive"; actionId: string; targetPlayerId: string };

export type ArpgRaidActionResult = {
  state: ArpgRaidState;
  events: ArpgRaidEvent[];
};
