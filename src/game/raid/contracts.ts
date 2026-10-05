import { z } from "zod";

const VersionedRaidAction = {
  roomId: z.string().uuid().transform((id) => id.toLowerCase()),
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid().transform((id) => id.toLowerCase()),
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
    cardId: z.string().min(8).max(120),
  }),
  z.strictObject({
    ...VersionedRaidAction,
    action: z.literal("ability"),
    slot: z.union([z.literal(0), z.literal(1)]),
  }),
  z.strictObject({ ...VersionedRaidAction, action: z.literal("pass") }),
]);

export type RaidAction = z.infer<typeof RaidActionSchema>;
