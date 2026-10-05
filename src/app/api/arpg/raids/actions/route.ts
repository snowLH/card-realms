import { NextResponse } from "next/server";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  ArpgRaidActionRequestSchema,
  ArpgRaidEventSchema,
  ArpgRaidRuleError,
  ArpgRaidStateSchema,
  applyArpgRaidAction,
  type ArpgRaidAction,
} from "@/game/arpg/raid";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { ArpgRaidRoomAccessError, loadArpgRaidRoom } from "@/server/raid/arpg-rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toEngineAction(action: z.infer<typeof ArpgRaidActionRequestSchema>): ArpgRaidAction {
  if (action.action === "input") {
    return {
      kind: "input",
      actionId: action.actionId,
      moveX: action.moveX,
      moveY: action.moveY,
      aimX: action.aimX,
      aimY: action.aimY,
    };
  }
  if (action.action === "attack") return { kind: "attack", actionId: action.actionId };
  if (action.action === "dash") return { kind: "dash", actionId: action.actionId };
  return { kind: "ability", actionId: action.actionId, slot: action.slot as 0 | 1 };
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  try {
    const action = ArpgRaidActionRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const actorId = data?.claims?.sub;
    if (error || typeof actorId !== "string") {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { admin, room } = await loadArpgRaidRoom(action.roomId, actorId);
    const { data: previous, error: previousError } = await admin
      .from("raid_actions")
      .select("action_type,payload,result")
      .eq("room_id", action.roomId)
      .eq("user_id", actorId)
      .eq("client_action_id", action.actionId)
      .maybeSingle();
    if (previousError) {
      return NextResponse.json({ error: "Não foi possível confirmar a ação anterior." }, { status: 503 });
    }
    if (previous) {
      if (previous.action_type !== action.action || !isDeepStrictEqual(previous.payload, action)) {
        return NextResponse.json({ error: "ID de ação já usado com outro conteúdo." }, { status: 409 });
      }
      const stored = previous.result as { state?: unknown; events?: unknown; version?: unknown } | null;
      const storedState = ArpgRaidStateSchema.parse(stored?.state);
      const storedEvents = z.array(ArpgRaidEventSchema).parse(stored?.events ?? []);
      let reward: unknown = null;
      if (storedState.status === "victory") {
        const { data: rewardData, error: rewardError } = await admin.rpc("grant_raid_mythic_rewards", {
          target_room_id: action.roomId,
        });
        if (!rewardError) reward = rewardData;
      }
      return NextResponse.json({
        state: storedState,
        events: storedEvents,
        version: stored?.version ?? room.version,
        reward,
        authority: "server",
        gameplayMode: room.gameplay_mode,
      });
    }
    if (!room.state || room.status !== "active") {
      throw new ArpgRaidRuleError("A Raid ARPG não está ativa.");
    }
    if (room.version !== action.expectedVersion) {
      return NextResponse.json(
        { error: "A Raid avançou em outra sessão. Atualize o estado.", currentVersion: room.version },
        { status: 409 },
      );
    }

    const resolved = applyArpgRaidAction(
      room.state,
      actorId,
      toEngineAction(action),
      Date.now(),
    );
    const finalState = ArpgRaidStateSchema.parse(resolved.state);
    const publicEvents = z.array(ArpgRaidEventSchema).parse(resolved.events);

    const { data: committed, error: commitError } = await admin.rpc("commit_raid_action", {
      target_room_id: action.roomId,
      acting_user_id: actorId,
      expected_version: action.expectedVersion,
      target_client_action_id: action.actionId,
      target_action_type: action.action,
      action_payload: action,
      result_state: finalState,
      result_events: publicEvents,
    });

    if (commitError) {
      const conflict = commitError.code === "40001" || commitError.code === "23505";
      return NextResponse.json(
        { error: conflict ? "A Raid avançou em outra sessão. Atualize o estado." : "A ação ARPG não pôde ser confirmada." },
        { status: conflict ? 409 : 503 },
      );
    }

    let reward: unknown = null;
    if (finalState.status === "victory") {
      const { data: rewardData, error: rewardError } = await admin.rpc("grant_raid_mythic_rewards", {
        target_room_id: action.roomId,
      });
      if (!rewardError) reward = rewardData;
    }

    const stored = committed as { state?: unknown; events?: unknown; version?: unknown } | null;
    const storedState = ArpgRaidStateSchema.parse(stored?.state ?? finalState);
    const storedEvents = z.array(ArpgRaidEventSchema).parse(stored?.events ?? publicEvents);

    return NextResponse.json({
      state: storedState,
      events: storedEvents,
      version: stored?.version ?? room.version + 1,
      reward,
      authority: "server",
      gameplayMode: "arpg",
    });
  } catch (caught) {
    if (caught instanceof ArpgRaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 404 });
    }
    const message = caught instanceof z.ZodError
      ? "A ação da Raid ARPG é inválida."
      : caught instanceof ArpgRaidRuleError
        ? caught.message
        : "Não foi possível processar a ação da Raid ARPG.";
    return NextResponse.json({ error: message }, { status: caught instanceof ArpgRaidRuleError ? 409 : 400 });
  }
}
