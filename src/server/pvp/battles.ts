import "server-only";

import { PvpRealtimeStateSchema } from "@/game/pvp/realtime";
import { createAdminClient } from "@/lib/supabase/admin";

export class PvpBattleAccessError extends Error {
  constructor() {
    super("Batalha PVP não encontrada.");
    this.name = "PvpBattleAccessError";
  }
}

export class PvpBattleHistoricalError extends Error {
  constructor() {
    super("Esta partida usa o combate clássico por turnos e foi preservada apenas no histórico.");
    this.name = "PvpBattleHistoricalError";
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
    .select("id,created_by,state,version,status,winner_id,updated_at")
    .eq("id", battleId)
    .single();
  if (battleError || !battle) throw new PvpBattleAccessError();

  const rawState = battle.state && typeof battle.state === "object" && !Array.isArray(battle.state)
    ? battle.state as Record<string, unknown>
    : null;
  if (rawState?.mode === "pvp" || rawState?.kind !== "pvp_realtime") throw new PvpBattleHistoricalError();
  const parsed = PvpRealtimeStateSchema.safeParse(battle.state);
  if (!parsed.success || parsed.data.id !== battleId
    || (parsed.data.status === "active" && battle.status !== "active")
    || (parsed.data.status === "finished" && battle.status !== "finished")) {
    throw new Error("Estado persistido de batalha incompatível.");
  }

  return {
    admin,
    battle: { ...battle, state: parsed.data },
  };
}
