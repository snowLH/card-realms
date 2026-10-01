import { z } from "zod";
import { ELEMENTS } from "../domain/elements";
import { BattleSideSchema, BattleTerrainSchema } from "../battle/schema";
import { RAID_BOSS_ID, RAID_MAX_PLAYERS, RAID_MIN_PLAYERS } from "./types";

const RaidContributionSchema = z.object({
  actions: z.number().int().nonnegative(),
  damage: z.number().int().nonnegative(),
  healing: z.number().int().nonnegative(),
  shield: z.number().int().nonnegative(),
  buffs: z.number().int().nonnegative(),
  debuffs: z.number().int().nonnegative(),
  terrain: z.number().int().nonnegative(),
});

const RaidPlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  seat: z.number().int().min(1).max(RAID_MAX_PLAYERS),
  side: BattleSideSchema,
  eliminated: z.boolean(),
  needsSwitch: z.boolean(),
  contribution: RaidContributionSchema,
});

const RaidBossSchema = z.object({
  id: z.literal(RAID_BOSS_ID),
  catalogId: z.string().min(1),
  name: z.string().min(1),
  element: z.enum(ELEMENTS),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  shield: z.number().int().nonnegative(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  speed: z.number().int().nonnegative(),
  enraged: z.boolean(),
});

export const RaidLogEntrySchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  round: z.number().int().positive(),
  actorId: z.string().min(1),
  kind: z.enum([
    "raid_started", "turn_started", "energy_drawn", "energy_attached",
    "power_drawn", "power_equipped", "creature_switched",
    "evolution_started", "evolution_completed", "die_rolled",
    "attack_hit", "attack_miss", "critical", "boss_attack",
    "boss_area_attack", "creature_ko", "player_eliminated",
    "phase_changed", "terrain_activated", "terrain_expired", "passed",
    "raid_victory", "raid_defeat",
  ]),
  message: z.string(),
  die: z.number().int().min(1).max(6).optional(),
  damage: z.number().int().nonnegative().optional(),
  attackId: z.string().optional(),
  targetIds: z.array(z.string()).optional(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  terrainElement: z.enum(ELEMENTS).optional(),
  creatureIndex: z.number().int().min(0).max(5).optional(),
  energyCardId: z.string().optional(),
  energyElement: z.enum(ELEMENTS).optional(),
  powerCardId: z.string().optional(),
});

export const RaidStateSchema = z.object({
  version: z.literal(1),
  roomId: z.string().uuid(),
  eventId: z.string().uuid(),
  bossCreatureId: z.string().min(1),
  status: z.enum(["active", "victory", "defeat"]),
  maxRounds: z.number().int().positive(),
  players: z.array(RaidPlayerSchema).min(RAID_MIN_PLAYERS).max(RAID_MAX_PLAYERS),
  boss: RaidBossSchema,
  turnOrder: z.array(z.string().min(1)).min(3).max(RAID_MAX_PLAYERS + 1),
  turn: z.object({
    actorId: z.string().min(1),
    actorKind: z.enum(["player", "boss"]),
    round: z.number().int().positive(),
    index: z.number().int().nonnegative(),
  }),
  terrain: BattleTerrainSchema.optional(),
  processedActionIds: z.array(z.string()).max(120),
  log: z.array(RaidLogEntrySchema).max(240),
});
