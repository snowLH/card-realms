import "server-only";

import { AvatarConfigSchema, DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import {
  ArpgRaidLoadoutSchema,
  ArpgRaidStateSchema,
  createArpgRaidState,
  type ArpgRaidPlayerSetup,
} from "@/game/arpg/raid";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadArpgRaidRoom, ArpgRaidRoomAccessError } from "./arpg-rooms";

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export async function startArpgRaidRoom(roomId: string, actorId: string) {
  const loaded = await loadArpgRaidRoom(roomId, actorId);
  const { room, event, participants } = loaded;

  if (room.host_id !== actorId) {
    throw new ArpgRaidRoomAccessError("Somente o líder da sala pode iniciar a Raid.");
  }
  if (room.status !== "lobby") {
    throw new ArpgRaidRoomAccessError("A sala já foi iniciada ou encerrada.");
  }
  if (room.gameplay_mode !== "arpg" || room.gameplay_version !== 2) {
    throw new ArpgRaidRoomAccessError("Esta sala não usa a versão atual da Raid ARPG.");
  }
  if (participants.length < event.min_players || participants.length > event.max_players) {
    throw new ArpgRaidRoomAccessError(`A Raid precisa de ${event.min_players} a ${event.max_players} jogadores.`);
  }
  if (participants.some((participant) => !participant.is_ready)) {
    throw new ArpgRaidRoomAccessError("Todos os jogadores precisam estar prontos.");
  }

  const playerIds = participants.map((participant) => participant.user_id);
  const { data: profiles, error: profilesError } = await loaded.admin
    .from("profiles")
    .select("id,avatar_config")
    .in("id", playerIds);
  if (profilesError) {
    throw new Error("Os avatares da equipe não puderam ser validados.");
  }
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const setups: ArpgRaidPlayerSetup[] = participants.map((participant) => {
    const parsed = ArpgRaidLoadoutSchema.safeParse(participant.team_snapshot);
    if (!parsed.success) {
      throw new ArpgRaidRoomAccessError(`${participant.name} não possui um loadout ARPG válido.`);
    }
    const profile = profileById.get(participant.user_id);
    const avatarConfig = AvatarConfigSchema.safeParse(profile?.avatar_config ?? DEFAULT_AVATAR_CONFIG);
    if (!avatarConfig.success) {
      throw new ArpgRaidRoomAccessError(`${participant.name} não possui um avatar ARPG válido.`);
    }
    return {
      id: participant.user_id,
      name: participant.name,
      seat: participant.seat,
      avatarConfig: avatarConfig.data,
      loadout: parsed.data,
    };
  });

  const bossConfig = event.boss_config && typeof event.boss_config === "object" && !Array.isArray(event.boss_config)
    ? event.boss_config as Record<string, unknown>
    : {};
  const nowMs = Date.now();
  const state = createArpgRaidState(
    room.id,
    event.id,
    setups,
    {
      catalogId: event.boss_creature_id,
      maxHp: numeric(bossConfig.maxHp, 10_000),
      speed: numeric(bossConfig.speed, 92),
      maxDurationMs: numeric(bossConfig.maxDurationMs, 6 * 60_000),
    },
    nowMs,
  );

  const validated = ArpgRaidStateSchema.parse(state);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("start_raid_room", {
    target_room_id: room.id,
    submitted_state: validated,
  });
  if (error) {
    throw new ArpgRaidRoomAccessError(error.message.includes("prontos")
      ? "Todos os jogadores precisam estar prontos."
      : "A Raid ARPG não pôde ser iniciada.");
  }

  return data;
}
