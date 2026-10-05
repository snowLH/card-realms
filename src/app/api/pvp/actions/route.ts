import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BattleStateSchema,
  BattleLogEntrySchema,
  GameRuleError,
  attachEnergy,
  concedeBattle,
  passTurn,
  resolveAbility,
} from "@/game/battle";
import {
  PvpActionSchema,
  isSamePvpAction,
  visiblePvpEvents,
  visiblePvpState,
  withOpaquePvpEventIds,
} from "@/game/pvp";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadAuthoritativePvpBattle, PvpBattleAccessError, PvpBattleHistoricalError } from "@/server/pvp/battles";

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

    const actionType = action.action === "attach" ? "attach_energy" : action.action;
    const { admin, battle: battleRow, boardId } = await loadAuthoritativePvpBattle(action.battleId, actorId);
    const { data: previous } = await admin
      .from("battle_actions")
      .select("action_type,payload,result")
      .eq("battle_id", action.battleId)
      .eq("user_id", actorId)
      .eq("client_action_id", action.actionId)
      .maybeSingle();
    if (previous?.result) {
      if (previous.action_type !== actionType || !isSamePvpAction(previous.payload, action)) {
        return NextResponse.json(
          { error: "Este identificador de ação já foi usado com outro comando." },
          { status: 409 },
        );
      }
      const stored = previous.result as { state?: unknown; events?: unknown; version?: unknown };
      const storedState = BattleStateSchema.parse(stored.state);
      const visible = visiblePvpState(storedState, actorId);
      const storedEvents = z.array(BattleLogEntrySchema).parse(stored.events);
      return NextResponse.json({
        state: visible.state,
        events: visiblePvpEvents(storedEvents),
        version: stored.version,
        boardId,
        authority: "server",
        hidden: visible.hidden,
      });
    }
    if (battleRow.version !== action.expectedVersion) {
      return NextResponse.json(
        { error: "A batalha avançou em outra sessão. Atualize o estado.", currentVersion: battleRow.version },
        { status: 409 },
      );
    }

    const state = battleRow.state;
    if (state.mode !== "pvp" || state.id !== action.battleId) {
      throw new GameRuleError("Batalha PVP inválida.");
    }
    if (action.action !== "concede" && state.turn.sideId !== actorId) {
      throw new GameRuleError("Aguarde o seu turno.");
    }

    const roll = () => randomInt(1, 7);
    const effectRoll = () => randomInt(1, 101);
    const resolved = action.action === "attach"
      ? attachEnergy(state, actorId, action.cardId, action.actionId)
      : action.action === "ability"
        ? resolveAbility(state, actorId, action.slot, roll(), effectRoll(), action.actionId)
        : action.action === "concede"
          ? concedeBattle(state, actorId, action.actionId)
          : passTurn(state, actorId, action.actionId);
    const result = withOpaquePvpEventIds(resolved, randomUUID);

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
    const committedEvents = z.array(BattleLogEntrySchema).parse(committed?.events);
    return NextResponse.json({
      state: visible.state,
      events: visiblePvpEvents(committedEvents),
      version: committed?.version,
      boardId,
      authority: "server",
      hidden: visible.hidden,
    });
  } catch (error) {
    if (error instanceof PvpBattleAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PvpBattleHistoricalError) {
      return NextResponse.json({ error: error.message }, { status: 410 });
    }
    const message = error instanceof z.ZodError
      ? "A ação PVP é inválida."
      : error instanceof GameRuleError
        ? error.message
        : "Não foi possível processar a ação PVP.";
    return NextResponse.json({ error: message }, { status: error instanceof GameRuleError ? 409 : 400 });
  }
}
