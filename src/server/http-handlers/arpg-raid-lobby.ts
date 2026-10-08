import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAYABLE_LEGEND_BY_ID } from "@/game/arpg/content/legends";
import { DEFAULT_AVATAR_CONFIG, AvatarConfigSchema } from "@/game/save/local-progress";
import { RaidLobbyActionSchema } from "@/game/arpg/raid/lobby-schema";
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

async function validateActiveLegendPowers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const [profileResult, loadoutResult] = await Promise.all([
    supabase.from("profiles").select("avatar_config").eq("id", userId).maybeSingle(),
    supabase.from("player_arpg_loadouts").select("ability_ids").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileResult.error || loadoutResult.error) {
    return { error: "Não foi possível validar a Lenda ativa e os poderes do perfil.", status: 503 } as const;
  }
  if (!profileResult.data || !loadoutResult.data) {
    return { error: "Salve sua Lenda e equipe os dois poderes no Arsenal antes da Raid.", status: 409 } as const;
  }

  const avatar = AvatarConfigSchema.safeParse(profileResult.data.avatar_config ?? DEFAULT_AVATAR_CONFIG);
  const legend = avatar.success ? PLAYABLE_LEGEND_BY_ID.get(avatar.data.legendId) : undefined;
  const selected = loadoutResult.data.ability_ids;
  const matches = legend
    && Array.isArray(selected)
    && selected.length === 2
    && new Set(selected).size === 2
    && selected.every((id) => typeof id === "string" && legend.signatureAbilityIds.includes(id));
  return matches
    ? null
    : { error: `Equipe exatamente os dois poderes da Lenda ativa antes da Raid.`, status: 409 } as const;
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

    if (action.action !== "leave" && !(action.action === "ready" && action.ready === false)) {
      const powerValidation = await validateActiveLegendPowers(auth.supabase, auth.userId);
      if (powerValidation) {
        return NextResponse.json({ error: powerValidation.error }, { status: powerValidation.status });
      }
    }

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
