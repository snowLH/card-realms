import { z } from "zod";
import { ArthurOathsSchema } from "../bosses/king-arthur/playable-kit";
import { ARPG_ABILITY_CARD_IDS } from "../content/ability-cards";

const VersionedRaidAction = {
  roomId: z.string().uuid().transform((id) => id.toLowerCase()),
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid().transform((id) => id.toLowerCase()),
};

const Axis = z.number().finite().min(-1).max(1);
const AbilityIdSchema = z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id), "Poder desconhecido.");
const AbilityIdsSchema = z.tuple([AbilityIdSchema, AbilityIdSchema]).superRefine((ids, context) => {
  if (ids[0] === ids[1]) {
    context.addIssue({ code: "custom", message: "A Raid exige dois poderes diferentes." });
  }
});

export const ArpgRaidLoadoutSchema = z.strictObject({
  weaponId: z.string().min(1),
  armorId: z.string().min(1),
  relicId: z.string().min(1),
  abilityIds: AbilityIdsSchema,
});
const InputSchema = z.strictObject({ moveX: Axis, moveY: Axis, aimX: Axis, aimY: Axis });
const ContributionSchema = z.strictObject({
  actions: z.number().int().nonnegative(),
  damage: z.number().int().nonnegative(),
  healing: z.number().int().nonnegative(),
  damageTaken: z.number().int().nonnegative(),
});
const PlayerSchema = z.strictObject({
  arthurOaths: ArthurOathsSchema.optional(),
  seenBossIntroIds: z.array(z.string()).max(500).optional(),
  nextBossDamageAtMs: z.number().nonnegative().optional(),
  id: z.string().uuid().transform((id) => id.toLowerCase()),
  name: z.string().min(1),
  seat: z.number().int().min(1).max(4),
  x: z.number().finite(),
  y: z.number().finite(),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  alive: z.boolean(),
  downedUntilMs: z.number().finite().nonnegative().default(0),
  loadout: ArpgRaidLoadoutSchema,
  input: InputSchema,
  lastInputAtMs: z.number().finite().nonnegative().default(0),
  nextAttackAtMs: z.number().finite().nonnegative(),
  nextDashAtMs: z.number().finite().nonnegative(),
  dashingUntilMs: z.number().finite().nonnegative(),
  dashX: Axis,
  dashY: Axis,
  abilityReadyAtMs: z.record(z.string(), z.number().finite().nonnegative()),
  basicAttackCounter: z.number().int().nonnegative(),
  contribution: ContributionSchema,
}).transform((player) => ({
  ...player,
  hp: Math.min(120, player.hp),
  maxHp: 120,
}));
const BossSchema = z.strictObject({
  catalogId: z.string().min(1),
  name: z.string().min(1),
  element: z.enum(["fire", "water", "nature", "storm", "spirit"]),
  x: z.number().finite(),
  y: z.number().finite(),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  speed: z.number().finite().positive(),
  nextAttackAtMs: z.number().finite().nonnegative(),
  slowedUntilMs: z.number().finite().nonnegative(),
});
const DungeonEnemySchema = z.strictObject({
  id: z.string().min(1).max(120),
  definitionId: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  waveIndex: z.number().int().min(0).max(4),
  x: z.number().finite().min(0).max(4_096),
  y: z.number().finite().min(0).max(4_096),
  hp: z.number().int().nonnegative().max(100_000),
  maxHp: z.number().int().positive().max(100_000),
  alive: z.boolean(),
  contactDamage: z.number().int().min(1).max(500),
  moveSpeed: z.number().finite().min(0).max(1_000),
  slowedUntilMs: z.number().finite().nonnegative(),
  nextAttackAtMs: z.number().finite().nonnegative(),
}).superRefine((enemy, context) => {
  if (enemy.hp > enemy.maxHp || enemy.alive !== (enemy.hp > 0)) {
    context.addIssue({ code: "custom", message: "Estado de inimigo da dungeon inconsistente." });
  }
});
const DungeonRoomSchema = z.strictObject({
  id: z.string().min(1).max(40),
  type: z.enum(["start", "combat", "treasure", "event", "elite", "rest", "shop", "boss"]),
  templateId: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  worldWidth: z.number().finite().min(64).max(4_096),
  worldHeight: z.number().finite().min(64).max(4_096),
  roomWidth: z.number().finite().min(64).max(4_096).optional(),
  corridorWidth: z.number().finite().min(0).max(512).optional(),
  waves: z.array(z.array(z.string().min(1).max(80)).max(24)).max(5),
  waveIndex: z.number().int().min(0).max(4),
  state: z.enum(["combat", "wave_complete", "awaiting_exit", "cleared"]),
  waveCompleteAtMs: z.number().finite().nonnegative().nullable(),
  nextRoomAtMs: z.number().finite().nonnegative().nullable(),
  enemies: z.array(DungeonEnemySchema).max(24),
}).transform((room) => {
  // Older persisted runs had only a room-sized world and advanced after a timer.
  // Give those runs a real corridor and convert their pending timer state into an open exit.
  const isLegacyRoom = room.roomWidth === undefined;
  const corridorWidth = room.corridorWidth ?? (room.type === "boss" ? 0 : 256);
  return {
    ...room,
    roomWidth: room.roomWidth ?? room.worldWidth,
    corridorWidth,
    worldWidth: isLegacyRoom && room.type !== "boss" ? room.worldWidth + corridorWidth : room.worldWidth,
    state: room.state === "wave_complete" ? "awaiting_exit" as const : room.state,
    nextRoomAtMs: room.state === "wave_complete" ? null : room.nextRoomAtMs,
  };
});
const DungeonSchema = z.strictObject({
  regionId: z.enum(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"]),
  seed: z.string().min(8).max(160),
  roomIndex: z.number().int().min(0).max(11),
  rooms: z.array(DungeonRoomSchema).min(1).max(12),
}).superRefine((dungeon, context) => {
  if (dungeon.roomIndex >= dungeon.rooms.length) {
    context.addIssue({ code: "custom", path: ["roomIndex"], message: "Sala atual da dungeon inválida." });
  }
});
const RaidEventSchema = z.strictObject({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  atMs: z.number().finite().nonnegative(),
  actorId: z.string().min(1),
  kind: z.enum([
    "raid_started",
    "player_moved",
    "player_attack",
    "player_dash",
    "ability_cast",
    "player_healed",
    "player_damaged",
    "player_defeated",
    "player_revived",
    "player_eliminated",
    "dungeon_room_entered",
    "dungeon_wave_cleared",
    "dungeon_room_cleared",
    "dungeon_enemy_attack",
    "dungeon_enemy_defeated",
    "boss_attack",
    "boss_phase",
    "raid_victory",
    "raid_defeat",
  ]),
  message: z.string(),
  damage: z.number().int().nonnegative().optional(),
  healing: z.number().int().nonnegative().optional(),
  targetIds: z.array(z.string()).optional(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export const ArpgRaidStateSchema = z.strictObject({
  bossEncounter: BossEncounterSchema.optional(),
  version: z.literal(2),
  roomId: z.string().uuid(),
  eventId: z.string().uuid(),
  status: z.enum(["active", "victory", "defeat"]),
  startedAtMs: z.number().finite().nonnegative(),
  serverTimeMs: z.number().finite().nonnegative(),
  maxDurationMs: z.number().finite().positive(),
  players: z.array(PlayerSchema).min(2).max(4),
  reviveCharges: z.number().int().min(0).max(2).default(2),
  dungeon: DungeonSchema.optional(),
  boss: BossSchema,
  processedActionIds: z.array(z.string()).max(300),
  eventSequence: z.number().int().nonnegative(),
  log: z.array(RaidEventSchema).max(240),
});

export const ArpgRaidEventSchema = RaidEventSchema;

export const ArpgRaidActionRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...VersionedRaidAction, action: z.literal("skip_intro") }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("input"),
    clientSeq: z.number().int().nonnegative(),
    moveX: Axis,
    moveY: Axis,
    aimX: Axis,
    aimY: Axis,
  }),
  z.strictObject({ ...VersionedRaidAction, action: z.literal("attack") }),
  z.strictObject({ ...VersionedRaidAction, action: z.literal("dash") }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("ability"),
    slot: z.number().int().min(0).max(1),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("revive"),
    targetPlayerId: z.string().uuid().transform((id) => id.toLowerCase()),
  }),
]);

export type ArpgRaidActionRequest = z.infer<typeof ArpgRaidActionRequestSchema>;
import { BossEncounterSchema } from "../bosses/boss-encounter-controller";
