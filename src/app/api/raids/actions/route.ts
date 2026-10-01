import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  RaidActionSchema,
  RaidLogEntrySchema,
  RaidRuleError,
  RaidStateSchema,
  attachRaidEnergy,
  drawRaidPower,
  equipRaidPower,
  evolveRaidCreature,
  passRaidTurn,
  resolveRaidAttack,
  resolveRaidBossTurn,
  switchRaidCreature,
  visibleRaidEvents,
  visibleRaidState,
} from "@/game/raid";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadRaidRoom, RaidRoomAccessError } from "@/server/raid/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  try {
    const action = RaidActionSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const actorId = data?.claims?.sub;
    if (error || typeof actorId !== "string") {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { admin, room } = await loadRaidRoom(action.roomId, actorId);
    if (!room.state || room.status !== "active") {
      throw new RaidRuleError("A Raid não está ativa.");
    }
    if (room.version !== action.expectedVersion) {
      return NextResponse.json(
        { error: "A Raid avançou em outra sessão. Atualize o estado.", currentVersion: room.version },
        { status: 409 },
      );
    }

    let resolved = action.action === "attach"
      ? attachRaidEnergy(room.state, actorId, action.creatureIndex, action.cardId, action.actionId)
      : action.action === "draw_power"
        ? drawRaidPower(room.state, actorId, action.actionId)
        : action.action === "equip_power"
          ? equipRaidPower(room.state, actorId, action.creatureIndex, action.cardId, action.slot, action.actionId)
          : action.action === "switch"
            ? switchRaidCreature(room.state, actorId, action.creatureIndex, action.actionId)
            : action.action === "attack"
              ? resolveRaidAttack(room.state, actorId, action.attackId, randomInt(1, 7), action.actionId)
              : action.action === "evolve"
                ? evolveRaidCreature(room.state, actorId, action.actionId)
                : passRaidTurn(room.state, actorId, action.actionId);

    const combinedEvents = [...resolved.events];
    let bossStep = 0;
    while (
      resolved.state.status === "active"
      && resolved.state.turn.actorKind === "boss"
      && bossStep < 2
    ) {
      const bossActionId = `${action.actionId}:boss:${bossStep + 1}`;
      const boss = resolveRaidBossTurn(resolved.state, randomInt(0, 1000000), bossActionId);
      resolved = boss;
      combinedEvents.push(...boss.events);
      bossStep += 1;
    }

    const finalState = RaidStateSchema.parse(resolved.state);
    const publicEvents = combinedEvents.map((entry, index) => ({
      ...entry,
      id: `server:${randomUUID()}:${index + 1}`,
    }));
    z.array(RaidLogEntrySchema).parse(publicEvents);

    const actionType = action.action === "attach" ? "attach_energy" : action.action;
    const { data: committed, error: commitError } = await admin.rpc("commit_raid_action", {
      target_room_id: action.roomId,
      acting_user_id: actorId,
      expected_version: action.expectedVersion,
      target_client_action_id: action.actionId,
      target_action_type: actionType,
      action_payload: action,
      result_state: finalState,
      result_events: publicEvents,
    });

    if (commitError) {
      const conflict = commitError.code === "40001" || commitError.code === "23505";
      return NextResponse.json(
        { error: conflict ? "A Raid avançou em outra sessão. Atualize o estado." : "A ação não pôde ser confirmada." },
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
    const storedState = RaidStateSchema.parse(stored?.state ?? finalState);
    const visible = visibleRaidState(storedState, actorId);
    const storedEvents = z.array(RaidLogEntrySchema).parse(stored?.events ?? publicEvents);

    return NextResponse.json({
      state: visible.state,
      events: visibleRaidEvents(storedEvents),
      hidden: visible.hidden,
      version: stored?.version ?? room.version + 1,
      reward,
      authority: "server",
    });
  } catch (caught) {
    if (caught instanceof RaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 404 });
    }
    const message = caught instanceof z.ZodError
      ? "A ação da Raid é inválida."
      : caught instanceof RaidRuleError
        ? caught.message
        : "Não foi possível processar a ação da Raid.";
    return NextResponse.json({ error: message }, { status: caught instanceof RaidRuleError ? 409 : 400 });
  }
}
