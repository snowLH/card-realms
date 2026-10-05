import { NextResponse } from "next/server";
import { visibleRaidState } from "@/game/raid";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadRaidRoom, RaidRoomAccessError } from "@/server/raid/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const actorId = data?.claims?.sub;
  if (error || typeof actorId !== "string") {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const { admin, room, event, participants } = await loadRaidRoom(
      (await context.params).roomId,
      actorId,
    );
    const visible = room.state ? visibleRaidState(room.state, actorId) : null;
    const [{ data: eventReward }, { data: roomEvents }, { data: historicalRewards }] = await Promise.all([
      admin
        .from("raid_reward_ledger")
        .select("coins_awarded,xp_awarded,granted_at")
        .eq("event_id", event.id)
        .eq("player_id", actorId)
        .eq("reward_type", "currency_reward")
        .maybeSingle(),
      admin
        .from("raid_room_events")
        .select("sequence,event_type,payload,created_at")
        .eq("room_id", room.id)
        .order("sequence", { ascending: false })
        .limit(40),
      admin
        .from("raid_reward_ledger")
        .select("reward_type,creature_card_id,ability_card_id,coins_awarded,xp_awarded,granted_at")
        .eq("event_id", event.id)
        .eq("player_id", actorId)
        .order("granted_at", { ascending: false }),
    ]);
    return NextResponse.json({
      room: {
        id: room.id,
        eventId: room.event_id,
        hostId: room.host_id,
        inviteCode: room.invite_code,
        status: room.status,
        version: room.version,
        gameplayMode: room.gameplay_mode,
        gameplayVersion: room.gameplay_version,
      },
      event,
      participants: participants.map((participant) => ({
        id: participant.user_id,
        name: participant.name,
        level: participant.level,
        seat: participant.seat,
        isReady: participant.is_ready,
        presenceStatus: participant.presence_status,
        contribution: participant.contribution,
      })),
      state: visible?.state ?? null,
      hidden: visible?.hidden ?? {},
      gameplayMode: room.gameplay_mode,
      events: (roomEvents ?? []).slice().reverse(),
      eventReward: {
        obtained: Boolean(eventReward),
        coinsAwarded: Number(eventReward?.coins_awarded ?? 0),
        xpAwarded: Number(eventReward?.xp_awarded ?? 0),
        grantedAt: eventReward?.granted_at ?? null,
      },
      historicalRewards: historicalRewards ?? [],
      authority: "server",
    });
  } catch (caught) {
    if (caught instanceof RaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Não foi possível carregar a sala da Raid." }, { status: 500 });
  }
}
