import { z } from "zod";
import { ELEMENTS } from "../domain/elements";

const EnergyCardSchema = z.object({
  id: z.string().min(1),
  element: z.enum(ELEMENTS),
});

const ActiveStatusSchema = z.object({
  effect: z.enum(["burn", "soaked", "rooted", "shocked", "haunted", "warded"]),
  turns: z.number().int().positive(),
  amount: z.number().optional(),
  sourceAttackId: z.string().min(1),
});

const BattleCreatureSchema = z.object({
  instanceId: z.string().min(1),
  catalogId: z.string().min(1),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  shield: z.number().int().nonnegative(),
  attachedEnergy: z.array(EnergyCardSchema),
  statuses: z.array(ActiveStatusSchema),
  defeated: z.boolean(),
});

const BattleSideSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["player", "npc", "boss"]),
  team: z.tuple([
    BattleCreatureSchema,
    BattleCreatureSchema,
    BattleCreatureSchema,
    BattleCreatureSchema,
    BattleCreatureSchema,
    BattleCreatureSchema,
  ]),
  activeIndex: z.number().int().min(0).max(5),
  energyDeck: z.array(EnergyCardSchema),
  energyHand: z.array(EnergyCardSchema),
  energyDiscard: z.array(EnergyCardSchema),
  attachmentsRemaining: z.number().int().min(0).max(2),
  turnsStarted: z.number().int().nonnegative(),
});

export const BattleLogEntrySchema = z.object({
  id: z.string().min(1),
  turn: z.number().int().positive(),
  actorId: z.string().min(1),
  kind: z.enum([
    "battle_start", "turn_started", "energy_drawn", "energy_attached",
    "creature_switched", "forced_switch", "attack_hit", "attack_miss",
    "critical", "status_applied", "status_tick", "healed", "shielded",
    "passed", "defeated", "battle_end",
  ]),
  message: z.string(),
  die: z.number().int().min(1).max(6).optional(),
  damage: z.number().int().nonnegative().optional(),
  attackId: z.string().optional(),
  effect: z.enum(["burn", "soaked", "rooted", "shocked", "haunted", "warded", "heal", "shield"]).optional(),
});

export const BattleStateSchema = z.object({
  version: z.literal(2),
  id: z.string().min(1),
  mode: z.enum(["wild", "npc", "pvp", "sanctuary", "boss"]),
  status: z.enum(["active", "finished"]),
  turn: z.object({
    sideId: z.string().min(1),
    phase: z.enum(["main", "forced_switch"]),
    number: z.number().int().positive(),
    round: z.number().int().positive(),
  }),
  sides: z.tuple([BattleSideSchema, BattleSideSchema]),
  winnerId: z.string().optional(),
  processedActionIds: z.array(z.string()).max(80),
  log: z.array(BattleLogEntrySchema).max(120),
});
