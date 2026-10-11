import { z } from "zod";

export const PlayerPreferencesSchema = z.object({
  soundEnabled: z.boolean(),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.string().max(80).nullable(),
}).strict();
export type PlayerPreferences = z.infer<typeof PlayerPreferencesSchema>;
export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = { soundEnabled: true, revision: 0, updatedAt: null };
export const PreferencesMutationSchema = z.object({
  soundEnabled: z.boolean(), expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();
export const PreferencesReceiptSchema = z.object({ confirmed: z.boolean(), snapshot: PlayerPreferencesSchema }).strict();

/** Preferences cannot contain economy, unlocks, credentials or device accessibility settings. */
export function playerPreferencesKey(accountId: string) { return `folklard:preferences:v1:${accountId}`; }
