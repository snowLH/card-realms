import { NextResponse } from "next/server";
import { z } from "zod";
import { RaidLobbyActionSchema } from "@/game/raid";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticated() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado.", status: 503 } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") {
    return { ok: false, error: "Autenticação necessária.", status: 401 } as const;
  }
  return { ok: true, supabase, userId } as const;
}

async function findCurrentRaidRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: participations } = await supabase
    .from("raid_participants")
    .select("room_id,joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(8);
  const roomIds = [...new Set((participations ?? []).map((entry) => entry.room_id))];
  if (!roomIds.length) return null;

  const { data: rooms } = await supabase
    .from("raid_rooms")
    .select("id,event_id,status,version,gameplay_mode,gameplay_version,created_at")
    .in("id", roomIds)
    .neq("gameplay_mode", "legacy")
    .in("status", ["lobby", "active"]);
  const room = (rooms ?? []).sort((left, right) => {
    if (left.status !== right.status) return left.status === "active" ? -1 : 1;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  })[0];
  if (!room) return null;

  return {
    roomId: room.id,
    eventId: room.event_id,
    status: room.status,
    version: room.version,
    gameplayMode: room.gameplay_mode as "avatar" | "arpg" | "legacy",
    gameplayVersion: room.gameplay_version,
  };
}

export async function GET() {
  const auth = await authenticated();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [
    { data: schedule, error: scheduleError },
    { data: rewards },
    activeRoom,
  ] = await Promise.all([
    auth.supabase.rpc("get_raid_schedule"),
    auth.supabase
      .from("raid_reward_ledger")
      .select("event_id,reward_type,creature_card_id,ability_card_id,coins_awarded,xp_awarded,granted_at")
      .eq("player_id", auth.userId),
    findCurrentRaidRoom(auth.supabase, auth.userId),
  ]);

  if (scheduleError) {
    console.error("Falha ao carregar agenda de Raids.", scheduleError.code);
    return NextResponse.json(
      { error: "O sistema de Raids ainda não está disponível no banco." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    schedule: schedule ?? [],
    rewards: rewards ?? [],
    activeRoom,
    serverAuthority: true,
  });
}

export async function POST(request: Request) {
  try {
    const action = RaidLobbyActionSchema.parse(await request.json());
    const auth = await authenticated();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rpc = action.action === "create"
      ? { name: "create_raid_room", args: { target_event_id: action.eventId } }
      : action.action === "join"
        ? { name: "join_raid_room", args: { target_invite_code: action.inviteCode } }
        : action.action === "ready"
          ? { name: "set_raid_ready", args: { target_room_id: action.roomId, ready: action.ready } }
          : { name: "leave_raid_room", args: { target_room_id: action.roomId } };

    const { data, error } = await auth.supabase.rpc(rpc.name, rpc.args);
    if (error) {
      const message = error.message.includes("avatar") || error.message.includes("poder")
        ? "Salve seu avatar e equipe exatamente dois poderes no Arquivo antes da Raid."
        : error.message.includes("cheia")
          ? "A sala da Raid já está cheia."
          : error.message.includes("ativa")
            ? "Esta Raid não está ativa neste momento."
            : "A ação da Raid não pôde ser concluída.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ result: data, authority: "supabase" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Ação de Raid inválida." : "Não foi possível processar a Raid." },
      { status: 400 },
    );
  }
}
