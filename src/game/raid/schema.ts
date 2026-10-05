import { z } from "zod";
import { ELEMENTS } from "../domain/elements";
import { BattleSideSchema, BattleTerrainSchema } from "../battle/schema";
import { RAID_BOSS_ID, RAID_MAX_PLAYERS, RAID_MIN_PLAYERS, RAID_STATE_VERSION } from "./types";

const ContributionSchema = z.strictObject({
  actions: z.number().int().nonnegative(),
  damage: z.number().int().nonnegative(),
  healing: z.number().int().nonnegative(),
  shield: z.number().int().nonnegative(),
  buffs: z.number().int().nonnegative(),
  debuffs: z.number().int().nonnegative(),
  terrain: z.number().int().nonnegative(),
});

const RaidPlayerSchema = z.strictObject({
  id: z.string().uuid().transform((id) => id.toLowerCase()),
  name: z.string().min(1),
  seat: z.number().int().min(1).max(RAID_MAX_PLAYERS),
  side: BattleSideSchema,
  eliminated: z.boolean(),
  contribution: ContributionSchema,
}).superRefine((player, context) => {
  if (player.side.id !== player.id || player.side.kind !== "player") {
    context.addIssue({ code: "custom", message: "O avatar da Raid precisa corresponder ao participante." });
  }
  if (player.eliminated !== (player.side.hp <= 0)) {
    context.addIssue({ code: "custom", message: "O estado de derrota do avatar não corresponde à vida." });
  }
});

const RaidBossSchema = z.strictObject({
  id: z.literal(RAID_BOSS_ID),
  catalogId: z.string().min(1),
  name: z.string().min(1),
  element: z.enum(ELEMENTS),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  shield: z.number().int().nonnegative(),
  statuses: z.array(z.strictObject({
    effect: z.enum(["burn", "soaked", "rooted", "shocked", "haunted", "warded"]),
    turns: z.number().int().positive(),
    amount: z.number().optional(),
    sourceAbilityId: z.string().min(1),
  })).max(12),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  speed: z.number().int().nonnegative(),
  enraged: z.boolean(),
});

export const RaidLogEntrySchema = z.strictObject({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  round: z.number().int().positive(),
  actorId: z.string().min(1),
  kind: z.enum([
    "raid_started", "turn_started", "energy_drawn", "energy_attached", "ability_used",
    "attack_hit", "attack_miss", "critical", "healed", "shielded", "status_applied",
    "status_tick", "defeated", "boss_attack", "boss_area_attack", "player_eliminated",
    "phase_changed", "terrain_activated", "terrain_expired", "passed", "raid_victory", "raid_defeat",
  ]),
  message: z.string(),
  die: z.number().int().min(1).max(6).optional(),
  damage: z.number().int().nonnegative().optional(),
  abilityId: z.string().optional(),
  abilitySlot: z.union([z.literal(0), z.literal(1)]).optional(),
  effect: z.enum(["burn", "soaked", "rooted", "shocked", "haunted", "warded", "heal", "shield"]).optional(),
  targetIds: z.array(z.string()).optional(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  terrainElement: z.enum(ELEMENTS).optional(),
  terrainTurns: z.number().int().positive().optional(),
  energyCardId: z.string().optional(),
  energyElement: z.enum(ELEMENTS).optional(),
});

export const RaidStateSchema = z.strictObject({
  version: z.literal(RAID_STATE_VERSION),
  eventSequence: z.number().int().nonnegative(),
  roomId: z.string().uuid(),
  eventId: z.string().uuid(),
  bossCreatureId: z.string().min(1),
  status: z.enum(["active", "victory", "defeat"]),
  maxRounds: z.number().int().positive(),
  players: z.array(RaidPlayerSchema).min(RAID_MIN_PLAYERS).max(RAID_MAX_PLAYERS),
  boss: RaidBossSchema,
  turnOrder: z.array(z.string().min(1)).min(3).max(RAID_MAX_PLAYERS + 1),
  turn: z.strictObject({
    actorId: z.string().min(1),
    actorKind: z.enum(["player", "boss"]),
    round: z.number().int().positive(),
    index: z.number().int().nonnegative(),
  }),
  terrain: BattleTerrainSchema.optional(),
  processedActionIds: z.array(z.string()).max(120),
  log: z.array(RaidLogEntrySchema).max(240),
}).superRefine((state, context) => {
  const ids = state.players.map((player) => player.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Os participantes da Raid devem ser únicos.", path: ["players"] });
  }
  if (state.boss.hp > state.boss.maxHp) {
    context.addIssue({ code: "custom", message: "A vida do boss excede o máximo.", path: ["boss", "hp"] });
  }
  if (state.boss.catalogId !== state.bossCreatureId) {
    context.addIssue({ code: "custom", message: "O boss não corresponde ao evento persistido.", path: ["boss", "catalogId"] });
  }
  if (state.players.some((player) => player.side.hp > player.side.maxHp)) {
    context.addIssue({ code: "custom", message: "A vida de um avatar excede o máximo.", path: ["players"] });
  }
  const seats = state.players.map((player) => player.seat);
  if (new Set(seats).size !== seats.length) {
    context.addIssue({ code: "custom", message: "Os assentos da Raid devem ser únicos.", path: ["players"] });
  }
  const expectedTurnOrder = [...state.players.slice().sort((left, right) => left.seat - right.seat).map((player) => player.id), RAID_BOSS_ID];
  if (state.turnOrder.length !== expectedTurnOrder.length || expectedTurnOrder.some((id, index) => state.turnOrder[index] !== id)) {
    context.addIssue({ code: "custom", message: "A ordem de turnos não corresponde aos participantes.", path: ["turnOrder"] });
  }
  if (state.turn.index >= state.turnOrder.length || state.turn.actorId !== state.turnOrder[state.turn.index]) {
    context.addIssue({ code: "custom", message: "O ator atual não corresponde ao índice do turno.", path: ["turn"] });
  }
  if ((state.turn.actorId === RAID_BOSS_ID) !== (state.turn.actorKind === "boss")) {
    context.addIssue({ code: "custom", message: "O tipo do ator atual não corresponde ao turno.", path: ["turn"] });
  }
  if (state.log.length > 0 && state.eventSequence < state.log[state.log.length - 1].sequence) {
    context.addIssue({ code: "custom", message: "A sequência de eventos retrocedeu.", path: ["eventSequence"] });
  }
});
