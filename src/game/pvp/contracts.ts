import { z } from "zod";

export const CreateChallengeSchema = z.strictObject({
  addresseeId: z.string().uuid(),
});

export const RespondChallengeSchema = z.discriminatedUnion("response", [
  z.strictObject({ challengeId: z.string().uuid(), response: z.literal("accept") }),
  z.strictObject({ challengeId: z.string().uuid(), response: z.literal("decline") }),
  z.strictObject({ challengeId: z.string().uuid(), response: z.literal("cancel") }),
]);

const VersionedAction = {
  battleId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  actionId: z.string().uuid(),
};

export const PvpActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...VersionedAction,
    action: z.literal("attach"),
    creatureIndex: z.number().int().min(0).max(5),
    cardId: z.string().min(8).max(120),
  }),
  z.strictObject({
    ...VersionedAction,
    action: z.literal("switch"),
    creatureIndex: z.number().int().min(0).max(5),
  }),
  z.strictObject({
    ...VersionedAction,
    action: z.literal("attack"),
    attackId: z.string().min(3).max(100),
  }),
  z.strictObject({
    ...VersionedAction,
    action: z.literal("pass"),
  }),
]);

export type PvpAction = z.infer<typeof PvpActionSchema>;

export function isSamePvpAction(left: unknown, right: PvpAction): boolean {
  const parsed = PvpActionSchema.safeParse(left);
  return parsed.success && JSON.stringify(parsed.data) === JSON.stringify(right);
}
