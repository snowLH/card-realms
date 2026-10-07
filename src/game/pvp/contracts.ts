import { z } from "zod";
import { PvpRealtimeActionSchema } from "./realtime";

const CanonicalUuidSchema = z.string().uuid().transform((value) => value.toLowerCase());

export const CreateChallengeSchema = z.strictObject({
  addresseeId: CanonicalUuidSchema,
});

export const RespondChallengeSchema = z.discriminatedUnion("response", [
  z.strictObject({ challengeId: CanonicalUuidSchema, response: z.literal("accept") }),
  z.strictObject({ challengeId: CanonicalUuidSchema, response: z.literal("decline") }),
  z.strictObject({ challengeId: CanonicalUuidSchema, response: z.literal("cancel") }),
]);

export const PvpActionSchema = PvpRealtimeActionSchema;

export type PvpAction = z.infer<typeof PvpActionSchema>;

export function isSamePvpAction(left: unknown, right: PvpAction): boolean {
  const parsed = PvpActionSchema.safeParse(left);
  return parsed.success && JSON.stringify(parsed.data) === JSON.stringify(right);
}
