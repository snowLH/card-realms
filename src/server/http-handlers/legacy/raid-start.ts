import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { PLAYABLE_LEGEND_BY_ID } from "@/game/arpg/content/legends";
import { DEFAULT_AVATAR_CONFIG, AvatarConfigSchema } from "@/game/save/local-progress";
import { createClient } from "@/lib/supabase/server";
import { loadRaidRoom, RaidRoomAccessError } from "@/server/raid/rooms";
import { startRaidRoom } from "@/server/raid/setup";

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
    const loaded = await loadRaidRoom(roomId, actorId);
    if (loaded.room.status === "lobby"
      && loaded.room.gameplay_mode === "avatar"
      && loaded.room.host_id === actorId) {
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
        const activeAvatar = AvatarConfigSchema.safeParse(profile.avatar_config ?? DEFAULT_AVATAR_CONFIG);
        const activeLegendId = activeAvatar.success ? activeAvatar.data.legendId : null;
        const legend = activeLegendId
          ? PLAYABLE_LEGEND_BY_ID.get(activeLegendId)
          : undefined;
        const snapshot = participant.combat_snapshot && typeof participant.combat_snapshot === "object"
          && !Array.isArray(participant.combat_snapshot)
          ? participant.combat_snapshot as Record<string, unknown>
          : {};
        const snapshotAvatar = AvatarConfigSchema.safeParse(snapshot.avatarConfig);
        if (!legend
          || !activeLegendId
          || !snapshotAvatar.success
          || snapshotAvatar.data.legendId !== activeLegendId
          || !hasExactLegendPowers(snapshot.abilityIds, legend.signatureAbilityIds)) {
          return NextResponse.json(
            { error: `${participant.name} precisa entrar novamente na sala após equipar os dois poderes da Lenda ativa.` },
            { status: 409 },
          );
        }
      }
    }

    const result = await startRaidRoom(roomId, actorId);
    return NextResponse.json({ result, authority: "server" });
  } catch (caught) {
    if (caught instanceof RaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível iniciar a Raid." }, { status: 500 });
  }
}
