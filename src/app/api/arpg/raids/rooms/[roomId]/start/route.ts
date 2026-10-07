import { NextResponse } from "next/server";
import { PLAYABLE_LEGEND_BY_ID } from "@/game/arpg/content/legends";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AVATAR_CONFIG, AvatarConfigSchema } from "@/game/save/local-progress";
import { ArpgRaidRoomAccessError, loadArpgRaidRoom } from "@/server/raid/arpg-rooms";
import { startArpgRaidRoom } from "@/server/raid/arpg-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasExactLegendPowers(selected: unknown, expected: readonly string[]) {
  return Array.isArray(selected)
    && selected.length === 2
    && selected.every((id) => typeof id === "string")
    && new Set(selected).size === 2
    && selected.every((id) => expected.includes(id));
}

export async function POST(
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
    const roomId = (await context.params).roomId;
    const loaded = await loadArpgRaidRoom(roomId, actorId);
    if (loaded.room.status === "lobby" && loaded.room.host_id === actorId) {
      const participantIds = loaded.participants.map((participant) => participant.user_id);
      const { data: profiles, error: profilesError } = await loaded.admin
        .from("profiles")
        .select("id,avatar_config")
        .in("id", participantIds);
      if (profilesError) {
        return NextResponse.json({ error: "Não foi possível validar as Lendas da equipe." }, { status: 503 });
      }
      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      for (const participant of loaded.participants) {
        const profile = profilesById.get(participant.user_id);
        if (!profile) {
          return NextResponse.json({ error: "Não foi possível validar o perfil de toda a equipe." }, { status: 503 });
        }
        const avatar = AvatarConfigSchema.safeParse(profile.avatar_config ?? DEFAULT_AVATAR_CONFIG);
        const legend = avatar.success ? PLAYABLE_LEGEND_BY_ID.get(avatar.data.legendId) : undefined;
        const snapshot = participant.team_snapshot && typeof participant.team_snapshot === "object"
          && !Array.isArray(participant.team_snapshot)
          ? participant.team_snapshot as Record<string, unknown>
          : {};
        if (!legend || !hasExactLegendPowers(snapshot.abilityIds, legend.signatureAbilityIds)) {
          return NextResponse.json(
            { error: `${participant.name} precisa entrar novamente na sala após equipar os dois poderes da Lenda ativa.` },
            { status: 409 },
          );
        }
      }
    }

    const result = await startArpgRaidRoom(roomId, actorId);
    return NextResponse.json({ result, authority: "server", gameplayMode: "arpg" });
  } catch (caught) {
    if (caught instanceof ArpgRaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível iniciar a Raid ARPG." }, { status: 500 });
  }
}
