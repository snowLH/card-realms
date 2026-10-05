import { z } from "zod";

const CanonicalUuidSchema = z.string().uuid().transform((value) => value.toLowerCase());

export const CreateChallengeSchema = z.strictObject({
  addresseeId: CanonicalUuidSchema,
});

export const RespondChallengeSchema = z.discriminatedUnion("response", [
  z.strictObject({ challengeId: CanonicalUuidSchema, response: z.literal("accept") }),
  z.strictObject({ challengeId: CanonicalUuidSchema, response: z.literal("decline") }),
  z.strictObject({ challengeId: CanonicalUuidSchema, response: z.literal("cancel") }),
]);

const VersionedAction = {
  battleId: CanonicalUuidSchema,
  expectedVersion: z.number().int().positive(),
  actionId: CanonicalUuidSchema,
};

export const PvpActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...VersionedAction,
    action: z.literal("attach"),
    cardId: z.string().min(8).max(120),
  }),
  z.strictObject({
    ...VersionedAction,
    action: z.literal("ability"),
    slot: z.union([z.literal(0), z.literal(1)]),
  }),
  z.strictObject({ ...VersionedAction, action: z.literal("pass") }),
  z.strictObject({ ...VersionedAction, action: z.literal("concede") }),
]);

export type PvpAction = z.infer<typeof PvpActionSchema>;

export function isSamePvpAction(left: unknown, right: PvpAction): boolean {
  const parsed = PvpActionSchema.safeParse(left);
  return parsed.success && JSON.stringify(parsed.data) === JSON.stringify(right);
}
