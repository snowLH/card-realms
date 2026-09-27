import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BattleStateSchema,
  GameRuleError,
  attachEnergy,
  passTurn,
  resolveAttack,
  switchActiveCreature,
} from "@/game/battle";
import { PvpActionSchema, visiblePvpState } from "@/game/pvp";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "O servidor PVP não está configurado." }, { status: 503 });
    }
    const action = PvpActionSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const actorId = claimsData?.claims?.sub;
    if (claimsError || typeof actorId !== "string") {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: previous } = await admin
      .from("battle_actions")
      .select("result")
      .eq("battle_id", action.battleId)
      .eq("user_id", actorId)
      .eq("client_action_id", action.actionId)
      .maybeSingle();
    if (previous?.result) {
      const stored = previous.result as { state?: unknown; events?: unknown; version?: unknown };
      const storedState = BattleStateSchema.parse(stored.state);
      const visible = visiblePvpState(storedState, actorId);
      return NextResponse.json({ ...stored, state: visible.state, hidden: visible.hidden });
    }

    const { data: battleRow, error: battleError } = await supabase
      .from("battles")
      .select("id,state,version,status,turn_user_id")
      .eq("id", action.battleId)
      .single();
    if (battleError || !battleRow) {
      return NextResponse.json({ error: "Batalha PVP não encontrada." }, { status: 404 });
    }
    if (battleRow.version !== action.expectedVersion) {
      return NextResponse.json(
        { error: "A batalha avançou em outra sessão. Atualize o estado.", currentVersion: battleRow.version },
        { status: 409 },
      );
    }

    const state = BattleStateSchema.parse(battleRow.state);
    if (state.mode !== "pvp" || state.id !== action.battleId || state.turn.sideId !== actorId) {
      throw new GameRuleError("Aguarde o seu turno.");
    }

    const roll = () => randomInt(1, 7);
    const effectRoll = () => randomInt(1, 101);
    const result = action.action === "attach"
      ? attachEnergy(state, actorId, action.creatureIndex, action.cardId, action.actionId)
      : action.action === "switch"
        ? switchActiveCreature(state, actorId, action.creatureIndex, action.actionId)
        : action.action === "attack"
          ? resolveAttack(state, actorId, action.attackId, roll(), effectRoll(), action.actionId)
          : passTurn(state, actorId, action.actionId);

    const actionType = action.action === "attach" ? "attach_energy" : action.action;
    const { data, error } = await admin.rpc("commit_pvp_action", {
      target_battle_id: action.battleId,
      acting_user_id: actorId,
      expected_version: action.expectedVersion,
      target_client_action_id: action.actionId,
      target_action_type: actionType,
      action_payload: action,
      result_state: result.state,
      result_events: result.events,
    });
    if (error) {
      const conflict = error.code === "40001" || error.code === "23505";
      return NextResponse.json(
        { error: conflict ? "A batalha avançou em outra sessão. Atualize o estado." : "A ação não pôde ser confirmada." },
        { status: conflict ? 409 : 503 },
      );
    }
    const committed = data as { state?: unknown; events?: unknown; version?: unknown } | null;
    const committedState = BattleStateSchema.parse(committed?.state);
    const visible = visiblePvpState(committedState, actorId);
    return NextResponse.json({ ...committed, state: visible.state, hidden: visible.hidden });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "A ação PVP é inválida."
      : error instanceof GameRuleError
        ? error.message
        : "Não foi possível processar a ação PVP.";
    return NextResponse.json({ error: message }, { status: error instanceof GameRuleError ? 409 : 400 });
  }
}
