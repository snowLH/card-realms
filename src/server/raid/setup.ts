import "server-only";

import { randomInt } from "node:crypto";
import { ARPG_ABILITY_CARD_IDS } from "@/game/arpg/content/ability-cards";
import { createRaidState, RaidStateSchema, resolveRaidBossTurn, type RaidPlayerSetup } from "@/game/raid";
import { AvatarConfigSchema } from "@/game/save/local-progress";
import type { EnergyPool } from "@/game/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRaidRoom, RaidRoomAccessError } from "./rooms";

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export async function startRaidRoom(roomId: string, actorId: string) {
  const loaded = await loadRaidRoom(roomId, actorId);
  const { room, event, participants } = loaded;

  if (room.host_id !== actorId) {
    throw new RaidRoomAccessError("Somente o líder da sala pode iniciar a Raid.");
  }
  if (room.status !== "lobby") {
    throw new RaidRoomAccessError("A sala já foi iniciada ou encerrada.");
  }
  if (room.gameplay_mode !== "avatar" || room.gameplay_version !== 2) {
    throw new RaidRoomAccessError("Esta sala não usa a versão atual da Raid por avatar.");
  }
  if (participants.length < event.min_players || participants.length > event.max_players) {
    throw new RaidRoomAccessError(`A Raid precisa de ${event.min_players} a ${event.max_players} jogadores.`);
  }
  if (participants.some((participant) => !participant.is_ready)) {
    throw new RaidRoomAccessError("Todos os jogadores precisam estar prontos.");
  }

  const admin = createAdminClient();
  const ids = participants.map((participant) => participant.user_id);
  const { data: energyRows, error: energyError } = await admin
    .from("player_energy_inventory")
    .select("user_id,element,quantity")
    .in("user_id", ids);
  if (energyError) throw new Error("Não foi possível carregar as Energias da equipe.");

  const pools = new Map<string, EnergyPool>();
  for (const playerId of ids) {
    pools.set(playerId, { fire: 0, water: 0, nature: 0, storm: 0, spirit: 0 });
  }
  for (const row of energyRows ?? []) {
    const pool = pools.get(row.user_id);
    if (!pool) continue;
    const element = typeof row.element === "string" ? row.element : "";
    if (element === "fire" || element === "water" || element === "nature" || element === "storm" || element === "spirit") {
      pool[element] = Math.max(0, Number(row.quantity) || 0);
    }
  }

  const raidPlayers: RaidPlayerSetup[] = participants.map((participant) => {
    const snapshot = participant.combat_snapshot && typeof participant.combat_snapshot === "object"
      && !Array.isArray(participant.combat_snapshot)
      ? participant.combat_snapshot as Record<string, unknown>
      : {};
    const avatarConfig = AvatarConfigSchema.safeParse(snapshot.avatarConfig);
    const abilityIds = Array.isArray(snapshot.abilityIds) ? snapshot.abilityIds : [];
    if (!avatarConfig.success
      || abilityIds.length !== 2
      || abilityIds.some((id) => typeof id !== "string" || !ARPG_ABILITY_CARD_IDS.has(id))
      || abilityIds[0] === abilityIds[1]) {
      throw new RaidRoomAccessError(`${participant.name} precisa de avatar salvo e dois poderes próprios no Arquivo.`);
    }
    return {
      id: participant.user_id,
      name: participant.name,
      seat: participant.seat,
      avatarConfig: avatarConfig.data,
      abilityIds: [abilityIds[0] as string, abilityIds[1] as string],
      energy: pools.get(participant.user_id),
    };
  });

  const bossConfig = event.boss_config && typeof event.boss_config === "object" && !Array.isArray(event.boss_config)
    ? event.boss_config as Record<string, unknown>
    : {};

  let state = createRaidState(
    room.id,
    event.id,
    raidPlayers,
    {
      catalogId: event.boss_creature_id,
      maxHp: numeric(bossConfig.maxHp, 10000),
      speed: numeric(bossConfig.speed, 60),
      maxRounds: numeric(bossConfig.maxRounds, 30),
    },
  );
  if (state.turn.actorKind === "boss") {
    state = resolveRaidBossTurn(state, randomInt(0, 1000000), "raid-opening-boss").state;
  }
  const validated = RaidStateSchema.parse(state);

  const { data, error } = await admin.rpc("start_raid_room", {
    target_room_id: room.id,
    submitted_state: validated,
  });
  if (error) {
    throw new RaidRoomAccessError(error.message.includes("prontos")
      ? "Todos os jogadores precisam estar prontos."
      : "A Raid não pôde ser iniciada.");
  }

  return data;
}
