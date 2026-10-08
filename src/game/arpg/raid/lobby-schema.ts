import { z } from "zod";

/** Only real-time ARPG rooms can be entered. The enum describes historical
 * server responses so existing invitation codes fail closed, not silently.
 */
export type RaidGameplayMode = "arpg" | "avatar" | "legacy";

export const RaidLobbyActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), eventId: z.string().uuid() }),
  z.strictObject({ action: z.literal("join"), inviteCode: z.string().trim().min(4).max(16) }),
  z.strictObject({ action: z.literal("ready"), roomId: z.string().uuid(), ready: z.boolean() }),
  z.strictObject({ action: z.literal("leave"), roomId: z.string().uuid() }),
]);
