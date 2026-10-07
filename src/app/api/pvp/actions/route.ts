import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PvpRealtimeActionSchema,
  PvpRealtimeEventSchema,
  PvpRealtimeRuleError,
  PvpRealtimeStateSchema,
  applyPvpRealtimeAction,
  toPvpRealtimeEngineAction,
  visiblePvpRealtimeEvents,
  visiblePvpRealtimeState,
} from "@/game/pvp/realtime";
import { isSamePvpAction } from "@/game/pvp/contracts";
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
    const action = PvpRealtimeActionSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const actorId = claimsData?.claims?.sub;
    if (claimsError || typeof actorId !== "string") {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { admin, battle } = await loadAuthoritativePvpBattle(action.battleId, actorId);
    const { data: previous, error: previousError } = await admin
      .from("battle_actions")
      .select("action_type,payload,result")
      .eq("battle_id", action.battleId)
      .eq("user_id", actorId)
      .eq("client_action_id", action.actionId)
      .maybeSingle();
    if (previousError) {
      return NextResponse.json({ error: "Não foi possível confirmar a ação anterior." }, { status: 503 });
    }
    if (previous?.result) {
      if (previous.action_type !== action.action || !isSamePvpAction(previous.payload, action)) {
        return NextResponse.json(
          { error: "Este identificador de ação já foi usado com outro comando." },
          { status: 409 },
        );
      }
      const stored = previous.result as { state?: unknown; events?: unknown; version?: unknown };
      const storedState = PvpRealtimeStateSchema.parse(stored.state);
      const visible = visiblePvpRealtimeState(storedState, actorId);
      const storedEvents = z.array(PvpRealtimeEventSchema).parse(stored.events);
      return NextResponse.json({
        state: visible,
        events: visiblePvpRealtimeEvents(storedEvents),
        version: stored.version,
        authority: "server",
      });
    }
    if (battle.version !== action.expectedVersion) {
      return NextResponse.json(
        { error: "O duelo avançou em outra sessão. Atualize o estado.", currentVersion: battle.version, conflict: true },
        { status: 409 },
      );
    }

    const resolved = applyPvpRealtimeAction(
      battle.state,
      actorId,
      toPvpRealtimeEngineAction(action),
      Date.now(),
    );
    const finalState = PvpRealtimeStateSchema.parse(resolved.state);
    const resultEvents = z.array(PvpRealtimeEventSchema).parse(resolved.events);

    const { data: committed, error: commitError } = await admin.rpc("commit_pvp_action", {
      target_battle_id: action.battleId,
      acting_user_id: actorId,
      expected_version: action.expectedVersion,
      target_client_action_id: action.actionId,
      target_action_type: action.action,
      action_payload: action,
      result_state: finalState,
      result_events: resultEvents,
    });
    if (commitError) {
      const conflict = commitError.code === "40001";
      const duplicateId = commitError.code === "23505";
      const latestVersion = conflict
        ? await admin.from("battles").select("version").eq("id", action.battleId).maybeSingle()
        : null;
      return NextResponse.json(
        {
          error: conflict
            ? "O duelo avançou em outra sessão. Atualize o estado."
            : duplicateId
              ? "Este identificador de ação já foi usado. Atualize o estado."
              : "A ação não pôde ser confirmada.",
          ...(conflict ? { conflict: true, currentVersion: latestVersion?.data?.version } : {}),
        },
        { status: conflict || duplicateId ? 409 : 503 },
      );
    }

    const stored = committed as { state?: unknown; events?: unknown; version?: unknown } | null;
    const committedState = PvpRealtimeStateSchema.parse(stored?.state ?? finalState);
    const committedEvents = z.array(PvpRealtimeEventSchema).parse(stored?.events ?? resultEvents);
    return NextResponse.json({
      state: visiblePvpRealtimeState(committedState, actorId),
      events: visiblePvpRealtimeEvents(committedEvents),
      version: stored?.version,
      authority: "server",
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
      : error instanceof PvpRealtimeRuleError
        ? error.message
        : "Não foi possível processar a ação PVP.";
    return NextResponse.json({ error: message }, {
      status: error instanceof PvpRealtimeRuleError ? 409 : error instanceof z.ZodError ? 400 : 500,
    });
  }
}
