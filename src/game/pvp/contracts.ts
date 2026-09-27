import { z } from "zod";

export const CreateChallengeSchema = z.object({
  addresseeId: z.string().uuid(),
});

export const RespondChallengeSchema = z.discriminatedUnion("response", [
  z.object({ challengeId: z.string().uuid(), response: z.literal("accept") }),
  z.object({ challengeId: z.string().uuid(), response: z.literal("decline") }),
  z.object({ challengeId: z.string().uuid(), response: z.literal("cancel") }),
]);

const VersionedAction = {
  battleId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid(),
};

export const PvpActionSchema = z.discriminatedUnion("action", [
  z.object({
    ...VersionedAction,
    action: z.literal("attach"),
    creatureIndex: z.number().int().min(0).max(5),
    cardId: z.string().min(8).max(120),
  }),
  z.object({
    ...VersionedAction,
    action: z.literal("switch"),
    creatureIndex: z.number().int().min(0).max(5),
  }),
  z.object({
    ...VersionedAction,
    action: z.literal("attack"),
    attackId: z.string().min(3).max(100),
  }),
  z.object({
    ...VersionedAction,
    action: z.literal("pass"),
  }),
]);

export type PvpAction = z.infer<typeof PvpActionSchema>;
