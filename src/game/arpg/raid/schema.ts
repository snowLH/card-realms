import { z } from "zod";
import { AvatarConfigSchema, DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { ARPG_ABILITY_CARD_IDS } from "../content/ability-cards";
import { ARPG_WEAPON_IDS, getDefaultSecondaryArpgWeaponId } from "../content/equipment";

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
const WeaponIdSchema = z.string().refine((id) => ARPG_WEAPON_IDS.has(id), "Arma ARPG inválida.");

export const ArpgRaidLoadoutSchema = z.strictObject({
  weaponId: WeaponIdSchema,
  secondaryWeaponId: WeaponIdSchema.optional(),
  armorId: z.string().min(1),
  relicId: z.string().min(1),
  abilityIds: AbilityIdsSchema,
}).superRefine((loadout, context) => {
  if (loadout.secondaryWeaponId === loadout.weaponId) {
    context.addIssue({
      code: "custom",
      message: "A Raid exige duas armas diferentes.",
      path: ["secondaryWeaponId"],
    });
  }
}).transform((loadout) => ({
  ...loadout,
  secondaryWeaponId: loadout.secondaryWeaponId ?? getDefaultSecondaryArpgWeaponId(loadout.weaponId),
}));
const InputSchema = z.strictObject({ moveX: Axis, moveY: Axis, aimX: Axis, aimY: Axis });
const ContributionSchema = z.strictObject({
  actions: z.number().int().nonnegative(),
  damage: z.number().int().nonnegative(),
  healing: z.number().int().nonnegative(),
  damageTaken: z.number().int().nonnegative(),
});
const PlayerSchema = z.strictObject({
  id: z.string().uuid().transform((id) => id.toLowerCase()),
  name: z.string().min(1),
  seat: z.number().int().min(1).max(5),
  // Preserve active v2 raids created before avatar identity was added.
  avatarConfig: AvatarConfigSchema.default(DEFAULT_AVATAR_CONFIG),
  x: z.number().finite(),
  y: z.number().finite(),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  alive: z.boolean(),
  loadout: ArpgRaidLoadoutSchema,
  input: InputSchema,
  nextAttackAtMs: z.number().finite().nonnegative(),
  nextDashAtMs: z.number().finite().nonnegative(),
  dashingUntilMs: z.number().finite().nonnegative(),
  dashX: Axis,
  dashY: Axis,
  abilityReadyAtMs: z.record(z.string(), z.number().finite().nonnegative()),
  basicAttackCounter: z.number().int().nonnegative(),
  contribution: ContributionSchema,
});
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
  version: z.literal(2),
  roomId: z.string().uuid(),
  eventId: z.string().uuid(),
  status: z.enum(["active", "victory", "defeat"]),
  startedAtMs: z.number().finite().nonnegative(),
  serverTimeMs: z.number().finite().nonnegative(),
  maxDurationMs: z.number().finite().positive(),
  players: z.array(PlayerSchema).min(2).max(5),
  boss: BossSchema,
  processedActionIds: z.array(z.string()).max(300),
  eventSequence: z.number().int().nonnegative(),
  log: z.array(RaidEventSchema).max(240),
});

export const ArpgRaidEventSchema = RaidEventSchema;

export const ArpgRaidActionRequestSchema = z.discriminatedUnion("action", [
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
]);

export type ArpgRaidActionRequest = z.infer<typeof ArpgRaidActionRequestSchema>;
