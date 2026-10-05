import "server-only";

import { BattleStateSchema } from "@/game/battle";
import { resolveBattleBoard } from "@/game/battle/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

export class PvpBattleAccessError extends Error {
  constructor() {
    super("Batalha PVP não encontrada.");
    this.name = "PvpBattleAccessError";
  }
}

export class PvpBattleHistoricalError extends Error {
  constructor() {
    super("Esta partida usava equipes antigas de seis criaturas e foi preservada apenas no histórico.");
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
    .select("id,created_by,state,version,status,turn_user_id,winner_id,updated_at")
    .eq("id", battleId)
    .single();
  if (battleError || !battle) throw new PvpBattleAccessError();

  const rawState = battle.state && typeof battle.state === "object" && !Array.isArray(battle.state)
    ? battle.state as Record<string, unknown>
    : null;
  if (rawState?.version === 2 && rawState.mode === "pvp") throw new PvpBattleHistoricalError();
  const parsed = BattleStateSchema.safeParse(battle.state);
  if (!parsed.success || parsed.data.id !== battleId || parsed.data.mode !== "pvp") {
    throw new Error("Estado persistido de batalha incompatível.");
  }

  const { data: hostHouse } = battle.created_by
    ? await admin
        .from("houses")
        .select("layout")
        .eq("user_id", battle.created_by)
        .maybeSingle()
    : { data: null };
  const layout = hostHouse?.layout && typeof hostHouse.layout === "object" && !Array.isArray(hostHouse.layout)
    ? hostHouse.layout as Record<string, unknown>
    : {};

  return {
    admin,
    battle: { ...battle, state: parsed.data },
    boardId: resolveBattleBoard(layout.preferredBattleBoard),
  };
}
