import "server-only";

import { BattleStateSchema } from "@/game/battle";
import { createAdminClient } from "@/lib/supabase/admin";

export class PvpBattleAccessError extends Error {
  constructor() {
    super("Batalha PVP não encontrada.");
    this.name = "PvpBattleAccessError";
  }
}

export async function loadAuthoritativePvpBattle(battleId: string, actorId: string) {
  const admin = createAdminClient();
  const { data: participant, error: participantError } = await admin
    .from("battle_participants")
    .select("battle_id")
    .eq("battle_id", battleId)
    .eq("user_id", actorId)
    .maybeSingle();

  if (participantError || !participant) throw new PvpBattleAccessError();

  const { data: battle, error: battleError } = await admin
    .from("battles")
    .select("id,state,version,status,turn_user_id,winner_id,updated_at")
    .eq("id", battleId)
    .single();
  if (battleError || !battle) throw new PvpBattleAccessError();

  const parsed = BattleStateSchema.safeParse(battle.state);
  if (!parsed.success || parsed.data.id !== battleId || parsed.data.mode !== "pvp") {
    throw new Error("Estado persistido de batalha incompatível.");
  }

  return { admin, battle: { ...battle, state: parsed.data } };
}
