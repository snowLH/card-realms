import { z } from "zod";
import { ELEMENTS } from "../domain/elements";
import { AvatarConfigSchema, DEFAULT_AVATAR_CONFIG } from "../save/local-progress";

const JsonObjectSchema = z.record(z.string(), z.unknown());
const ElementSchema = z.enum(ELEMENTS);

const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().nullable(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  equippedTitle: z.string().nullable(),
  avatarConfig: AvatarConfigSchema.default(DEFAULT_AVATAR_CONFIG),
});

const WorldStateSchema = z.object({
  currentRegionId: z.string().min(1),
  unlockedRegionIds: z.array(z.string().min(1)),
  openedTreasures: z.array(z.string().min(1)),
  currentAreaId: z.string().min(1).nullable().default(null),
  visitedAreaIds: z.array(z.string().min(1)).default([]),
  mapPositions: z.record(
    z.string().min(1),
    z.object({
      x: z.number().int().min(0).max(39),
      y: z.number().int().min(0).max(24),
    }),
  ).default({}),
});

const OwnedCreatureSchema = z.object({
  instanceId: z.string().uuid(),
  catalogId: z.string().min(1),
  nickname: z.string().nullable(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  bond: z.number().int().min(0).max(100),
  variant: z.string().min(1),
  acquiredFrom: z.string().min(1),
  acquiredAt: z.string(),
});

const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  isActive: z.boolean(),
  members: z.array(z.object({
    slot: z.number().int().min(1).max(6),
    playerCreatureId: z.string().uuid(),
    catalogId: z.string().min(1),
  })).max(6),
});

const ExplorationSchema = z.object({
  regionId: z.string().min(1),
  creaturesDiscovered: z.number().int().nonnegative(),
  treasuresFound: z.number().int().nonnegative(),
  sanctuaryCompleted: z.boolean(),
  guardianDefeated: z.boolean(),
  lastVisitedAt: z.string(),
});

const MissionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  progress: z.number().int().nonnegative(),
  completedAt: z.string().nullable(),
  claimedAt: z.string().nullable(),
  rewards: JsonObjectSchema,
});

const AchievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  unlockedAt: z.string(),
  claimedAt: z.string().nullable(),
});

const HouseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  theme: z.string().min(1),
  isPublic: z.boolean(),
  layout: JsonObjectSchema,
  items: z.array(z.object({
    id: z.string().uuid(),
    itemKey: z.string().min(1),
    position: JsonObjectSchema,
    rotation: z.number().int(),
  })),
});

const BattleHistorySchema = z.object({
  battleId: z.string().uuid(),
  opponentId: z.string().uuid().nullable(),
  mode: z.enum(["story", "guardian", "pvp", "coop_boss"]),
  outcome: z.enum(["victory", "defeat", "draw", "abandoned"]),
  coinsAwarded: z.number().int().nonnegative(),
  xpAwarded: z.number().int().nonnegative(),
  summary: JsonObjectSchema,
  finishedAt: z.string(),
});

export const RemotePlayerSnapshotSchema = z.object({
  version: z.literal(1),
  profile: ProfileSchema,
  world: WorldStateSchema,
  collection: z.array(OwnedCreatureSchema),
  teams: z.array(TeamSchema),
  energy: z.record(ElementSchema, z.number().int().nonnegative()),
  inventory: z.array(z.object({
    itemKey: z.string().min(1),
    quantity: z.number().int().nonnegative(),
    metadata: JsonObjectSchema,
  })),
  exploration: z.array(ExplorationSchema),
  missions: z.array(MissionSchema),
  achievements: z.array(AchievementSchema),
  house: HouseSchema.nullable(),
  battleHistory: z.array(BattleHistorySchema),
});

export type RemotePlayerSnapshot = z.infer<typeof RemotePlayerSnapshotSchema>;

export type ProgressSource = "local" | "supabase" | "supabase-unavailable";

export type PlayerBootstrap = {
  source: ProgressSource;
  identity: { id: string; email: string | null } | null;
  snapshot: RemotePlayerSnapshot | null;
  error?: string;
};

export const LOCAL_PLAYER_BOOTSTRAP: PlayerBootstrap = {
  source: "local",
  identity: null,
  snapshot: null,
};
