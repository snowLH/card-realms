import "server-only";
import { BossProgressSchema, EMPTY_BOSS_PROGRESS, type BossProgress } from "@/game/arpg/bosses/boss-unlocks";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type Scope = { playerId: string; runId?: string; roomId?: string };
type BossProgressReceipt = { confirmed: true; progress: BossProgress; error?: undefined }
  | { confirmed: false; error: string; progress?: undefined };
export async function readBossProgress(admin: Admin, playerId: string): Promise<BossProgress> {
  const { data, error } = await admin.rpc("get_corrupted_legend_progress", { target_player_id: playerId });
  if (error) return { ...EMPTY_BOSS_PROGRESS };
  const parsed = BossProgressSchema.safeParse(data);
  return parsed.success ? parsed.data : { ...EMPTY_BOSS_PROGRESS };
}
/** The RPC reads the STORED authority proof. Client HP, timers and boss IDs are never submitted. */
export async function recordStoredBossProgress(admin: Admin, scope: Scope, restore: boolean): Promise<BossProgressReceipt> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const retry = { confirmed: false as const, error: "Não foi possível confirmar o desbloqueio. Tentaremos novamente." };
  try {
    // Return the RESTORED authority snapshot even if the receipt is slow. The
    // stored-proof RPC is idempotent, so a late commit is safe to retry.
    const { data, error } = await Promise.race([
      admin.rpc("record_corrupted_legend_progress", {
        target_player_id: scope.playerId,
        target_run_id: scope.runId ?? null,
        target_room_id: scope.roomId ?? null,
        target_restore: restore,
      }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Boss receipt timeout")), 4000); }),
    ]);
    if (error) return retry;
    const value = data as { confirmed?: boolean; progress?: unknown } | null;
    const parsed = BossProgressSchema.safeParse(value?.progress);
    if (value?.confirmed !== true || !parsed.success) return { confirmed: false, error: "O save ainda não confirmou a restauração." };
    return { confirmed: true, progress: parsed.data };
  } catch {
    return retry;
  } finally { if (timeout) clearTimeout(timeout); }
}
