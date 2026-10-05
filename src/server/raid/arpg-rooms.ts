import "server-only";

import { z } from "zod";
import { ArpgRaidStateSchema } from "@/game/arpg/raid";
import { createAdminClient } from "@/lib/supabase/admin";

export class ArpgRaidRoomAccessError extends Error {
  constructor(message = "Sala de Raid ARPG não encontrada.") {
    super(message);
    this.name = "ArpgRaidRoomAccessError";
  }
}

export async function loadArpgRaidRoom(roomId: string, actorId: string) {
  const parsedRoomId = z.string().uuid().safeParse(roomId);
  if (!parsedRoomId.success) throw new ArpgRaidRoomAccessError();
  const normalizedRoomId = parsedRoomId.data.toLowerCase();
  const admin = createAdminClient();
  const { data: participant, error: participantError } = await admin
    .from("raid_participants")
    .select("room_id,user_id,seat,is_ready,presence_status,contribution,team_snapshot")
    .eq("room_id", normalizedRoomId)
    .eq("user_id", actorId)
    .maybeSingle();
  if (participantError || !participant) throw new ArpgRaidRoomAccessError();

  const { data: room, error: roomError } = await admin
    .from("raid_rooms")
    .select("id,event_id,host_id,invite_code,status,state,version,gameplay_mode,gameplay_version,created_at,started_at,finished_at")
    .eq("id", normalizedRoomId)
    .single();
  if (roomError || !room) throw new ArpgRaidRoomAccessError();

  const { data: event, error: eventError } = await admin
    .from("raid_events")
    .select("id,slug,title,boss_creature_id,starts_at,ends_at,presentation_timezone,min_players,max_players,recommended_level,boss_config,rewards")
    .eq("id", room.event_id)
    .single();
  if (eventError || !event) throw new ArpgRaidRoomAccessError("Evento da Raid não encontrado.");
  if (room.gameplay_mode !== "arpg" || room.gameplay_version !== 2) {
    throw new ArpgRaidRoomAccessError("Esta sala usa o modo legado de Raid.");
  }

  const { data: participants, error: participantsError } = await admin
    .from("raid_participants")
    .select("user_id,seat,is_ready,presence_status,contribution,team_snapshot,joined_at,last_seen_at")
    .eq("room_id", room.id)
    .order("seat");
  if (participantsError) throw new ArpgRaidRoomAccessError();

  const ids = (participants ?? []).map((entry) => entry.user_id);
  const { data: profiles } = ids.length > 0
    ? await admin.from("profiles").select("id,display_name,level").in("id", ids)
    : { data: [] as Array<{ id: string; display_name: string; level: number }> };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const parsedState = room.state ? ArpgRaidStateSchema.safeParse(room.state) : null;
  if (room.state && (!parsedState || !parsedState.success)) {
    throw new Error("Estado persistido da Raid ARPG é incompatível.");
  }
  if (["active", "victory", "defeat"].includes(room.status) && (!parsedState?.success)) {
    throw new Error("O combate da Raid ARPG não possui um estado válido.");
  }
  if (parsedState?.success && (
    parsedState.data.roomId !== room.id
    || parsedState.data.eventId !== event.id
    || parsedState.data.boss.catalogId !== event.boss_creature_id
    || (["active", "victory", "defeat"].includes(room.status) && parsedState.data.status !== room.status)
  )) {
    throw new Error("O estado da Raid ARPG não corresponde à sala ou ao boss do evento.");
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
