import { z } from "zod";

const VersionedRaidAction = {
  roomId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid(),
};

export const RaidLobbyActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), eventId: z.string().uuid() }),
  z.strictObject({ action: z.literal("join"), inviteCode: z.string().trim().min(4).max(16) }),
  z.strictObject({ action: z.literal("ready"), roomId: z.string().uuid(), ready: z.boolean() }),
  z.strictObject({ action: z.literal("leave"), roomId: z.string().uuid() }),
]);

export const RaidActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("attach"),
    creatureIndex: z.number().int().min(0).max(5),
    cardId: z.string().min(8).max(160),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("draw_power"),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("equip_power"),
    creatureIndex: z.number().int().min(0).max(5),
    cardId: z.string().min(8).max(160),
    slot: z.number().int().min(0).max(3).optional(),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("switch"),
    creatureIndex: z.number().int().min(0).max(5),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("attack"),
    attackId: z.string().min(3).max(100),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("evolve"),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("pass"),
  }),
]);

export type RaidAction = z.infer<typeof RaidActionSchema>;
