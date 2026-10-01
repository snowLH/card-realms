import "server-only";

import { RaidStateSchema } from "@/game/raid";
import { createAdminClient } from "@/lib/supabase/admin";

export class RaidRoomAccessError extends Error {
  constructor(message = "Sala de Raid não encontrada.") {
    super(message);
    this.name = "RaidRoomAccessError";
  }
}

export async function loadRaidRoom(roomId: string, actorId: string) {
  const admin = createAdminClient();
  const { data: participant, error: participantError } = await admin
    .from("raid_participants")
    .select("room_id,user_id,seat,is_ready,presence_status,contribution")
    .eq("room_id", roomId)
    .eq("user_id", actorId)
    .maybeSingle();

  if (participantError || !participant) throw new RaidRoomAccessError();

  const { data: room, error: roomError } = await admin
    .from("raid_rooms")
    .select("id,event_id,host_id,invite_code,status,state,version,created_at,started_at,finished_at")
    .eq("id", roomId)
    .single();
  if (roomError || !room) throw new RaidRoomAccessError();

  const { data: event, error: eventError } = await admin
    .from("raid_events")
    .select("id,slug,title,boss_creature_id,starts_at,ends_at,presentation_timezone,min_players,max_players,recommended_level,boss_config,rewards")
    .eq("id", room.event_id)
    .single();
  if (eventError || !event) throw new RaidRoomAccessError("Evento da Raid não encontrado.");

  const { data: participants, error: participantsError } = await admin
    .from("raid_participants")
    .select("user_id,seat,is_ready,presence_status,contribution,team_snapshot,joined_at,last_seen_at")
    .eq("room_id", room.id)
    .order("seat");
  if (participantsError) throw new RaidRoomAccessError();

  const ids = (participants ?? []).map((entry) => entry.user_id);
  const { data: profiles } = ids.length > 0
    ? await admin.from("profiles").select("id,display_name,level").in("id", ids)
    : { data: [] as Array<{ id: string; display_name: string; level: number }> };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const parsedState = room.state ? RaidStateSchema.safeParse(room.state) : null;
  if (room.state && (!parsedState || !parsedState.success)) {
    throw new Error("Estado persistido da Raid é incompatível.");
  }

  return {
    admin,
    room: {
      ...room,
      state: parsedState?.success ? parsedState.data : null,
    },
    event,
    participants: (participants ?? []).map((entry) => ({
      ...entry,
      name: profileMap.get(entry.user_id)?.display_name ?? "Cartógrafo",
      level: profileMap.get(entry.user_id)?.level ?? 1,
    })),
    actor: participant,
  };
}
