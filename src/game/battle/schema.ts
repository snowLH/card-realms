import { z } from "zod";
import { ARPG_ABILITY_CARD_IDS } from "../arpg/content/ability-cards";
import { ELEMENTS } from "../domain/elements";
import { AvatarConfigSchema } from "../save/local-progress";
import { ABILITY_SLOT_COUNT, BATTLE_VERSION } from "./types";

const EnergyCardSchema = z.object({
  id: z.string().min(1),
  element: z.enum(ELEMENTS),
  origin: z.enum(["battle_deck", "inventory"]),
  ownerId: z.string().min(1),
  zone: z.enum(["deck", "hand", "attached", "discard"]),
  attachedTo: z.string().nullable(),
  status: z.enum(["ready", "spent"]),
}).strict();

const AbilityIdSchema = z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id), "Poder desconhecido.");

const ActiveStatusSchema = z.object({
  effect: z.enum(["burn", "soaked", "rooted", "shocked", "haunted", "warded"]),
  turns: z.number().int().positive(),
  amount: z.number().optional(),
  sourceAbilityId: AbilityIdSchema,
}).strict();

export const BattleSideSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["player", "npc", "boss"]),
  avatarConfig: AvatarConfigSchema,
  abilityIds: z.tuple([AbilityIdSchema, AbilityIdSchema]).superRefine((ids, context) => {
    if (new Set(ids).size !== ABILITY_SLOT_COUNT) {
      context.addIssue({ code: "custom", message: "O personagem precisa de dois poderes diferentes." });
    }
  }),
  abilityCooldowns: z.tuple([z.number().int().nonnegative().max(8), z.number().int().nonnegative().max(8)]),
  element: z.enum(ELEMENTS),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  shield: z.number().int().nonnegative(),
  statuses: z.array(ActiveStatusSchema).max(12),
  attachedEnergy: z.array(EnergyCardSchema).max(30),
  energyDeck: z.array(EnergyCardSchema).max(30),
  energyHand: z.array(EnergyCardSchema).max(30),
  energyDiscard: z.array(EnergyCardSchema).max(30),
  attachmentsRemaining: z.number().int().min(0).max(1),
  turnsStarted: z.number().int().nonnegative(),
}).strict();

export const BattleTerrainSchema = z.object({
  element: z.enum(ELEMENTS),
  sourceSideId: z.string().min(1),
  activatedTurn: z.number().int().positive(),
  expiresAfterTurn: z.number().int().positive(),
}).strict();

export const BattleLogEntrySchema = z.object({
  id: z.string().min(1),
  turn: z.number().int().positive(),
  actorId: z.string().min(1),
  kind: z.enum([
    "battle_start", "turn_started", "energy_drawn", "energy_attached", "ability_used",
    "attack_hit", "attack_miss", "critical", "status_applied", "status_tick", "healed",
    "shielded", "passed", "conceded", "defeated", "terrain_activated", "terrain_expired", "battle_end",
  ]),
  message: z.string(),
  die: z.number().int().min(1).max(6).optional(),
  damage: z.number().int().nonnegative().optional(),
  abilityId: AbilityIdSchema.optional(),
  abilitySlot: z.union([z.literal(0), z.literal(1)]).optional(),
  effect: z.enum(["burn", "soaked", "rooted", "shocked", "haunted", "warded", "heal", "shield"]).optional(),
  terrainElement: z.enum(ELEMENTS).optional(),
  terrainTurns: z.number().int().positive().optional(),
  energyCardId: z.string().optional(),
  energyElement: z.enum(ELEMENTS).optional(),
}).strict();

export const BattleStateSchema = z.object({
  version: z.literal(BATTLE_VERSION),
  id: z.string().min(1),
  mode: z.enum(["wild", "npc", "pvp", "sanctuary", "boss"]),
  status: z.enum(["active", "finished"]),
  regionId: z.string().min(1).max(80).optional(),
  turn: z.object({
    sideId: z.string().min(1),
    number: z.number().int().positive(),
    round: z.number().int().positive(),
  }).strict(),
  sides: z.tuple([BattleSideSchema, BattleSideSchema]),
  winnerId: z.string().optional(),
  terrain: BattleTerrainSchema.optional(),
  processedActionIds: z.array(z.string()).max(80),
  log: z.array(BattleLogEntrySchema).max(120),
}).strict().superRefine((state, context) => {
  if (state.sides[0].id === state.sides[1].id) {
    context.addIssue({ code: "custom", message: "Os combatentes precisam ser diferentes.", path: ["sides"] });
  }
  if (state.sides.some((side) => side.hp > side.maxHp)) {
    context.addIssue({ code: "custom", message: "A vida excede o máximo do personagem.", path: ["sides"] });
  }
});
