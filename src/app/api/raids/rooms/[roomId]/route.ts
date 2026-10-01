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
    const { room, event, participants } = await loadRaidRoom(
      (await context.params).roomId,
      actorId,
    );
    const visible = room.state ? visibleRaidState(room.state, actorId) : null;
    return NextResponse.json({
      room: {
        id: room.id,
        eventId: room.event_id,
        hostId: room.host_id,
        inviteCode: room.invite_code,
        status: room.status,
        version: room.version,
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
      authority: "server",
    });
  } catch (caught) {
    if (caught instanceof RaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Não foi possível carregar a sala da Raid." }, { status: 500 });
  }
}
