import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { createPvpBattle } from "@/game/battle";
import { DEFAULT_AVATAR_CONFIG, AvatarConfigSchema } from "@/game/save/local-progress";
import type { EnergyPool } from "@/game/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateArpgAbilityOwnership } from "@/server/arpg/ability-ownership";

function secureRandom() {
  return randomInt(0, 0x1000000) / 0x1000000;
}

function abilitySelectionFromRow(row: { ability_ids: string[] }) {
  const parsed = z.tuple([z.string().min(1), z.string().min(1)]).safeParse(row.ability_ids);
  if (!parsed.success) throw new Error("Os dois jogadores precisam salvar exatamente dois poderes no Arquivo.");
  return { abilityIds: parsed.data };
}

export async function acceptPvpChallenge(challengeId: string, actorId: string) {
  const admin = createAdminClient();
  const { data: challenge, error: challengeError } = await admin
    .from("pvp_challenges")
    .select("id,requester_id,addressee_id,status,expires_at")
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) throw new Error("Desafio não encontrado.");
  if (challenge.addressee_id !== actorId) throw new Error("Somente o jogador desafiado pode aceitar.");
  if (challenge.status !== "pending" || new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw new Error("O desafio não está mais disponível.");
  }

  const playerIds = [challenge.requester_id, challenge.addressee_id];
  const [
    { data: profiles, error: profileError },
    { data: loadoutRows, error: loadoutError },
    { data: energyRows, error: energyError },
  ] = await Promise.all([
    admin.from("profiles").select("id,display_name,avatar_config").in("id", playerIds),
    admin.from("player_arpg_loadouts").select("user_id,ability_ids").in("user_id", playerIds),
    admin.from("player_energy_inventory").select("user_id,element,quantity").in("user_id", playerIds),
  ]);
  if (profileError || loadoutError || profiles?.length !== 2 || loadoutRows?.length !== 2) {
    throw new Error("Os dois jogadores precisam de perfil e poderes salvos no Arquivo.");
  }
  if (energyError) throw new Error("Não foi possível carregar as Energias da batalha.");

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const loadoutByPlayer = new Map(loadoutRows.map((row) => [row.user_id, row]));
  const energyByPlayer = new Map<string, EnergyPool>(playerIds.map((playerId) => [
    playerId,
    { fire: 0, water: 0, nature: 0, storm: 0, spirit: 0 },
  ]));
  for (const row of energyRows ?? []) {
    const pool = energyByPlayer.get(row.user_id);
    const element = String(row.element);
    if (pool && (element === "fire" || element === "water" || element === "nature" || element === "storm" || element === "spirit")) {
      pool[element] = Math.max(0, Number(row.quantity) || 0);
    }
  }

  async function playerSetup(playerId: string) {
    const profile = profileById.get(playerId);
    const row = loadoutByPlayer.get(playerId);
    if (!profile || !row) throw new Error("Perfil ou personagem equipado não encontrado.");
    const selection = abilitySelectionFromRow(row);
    const ownership = await validateArpgAbilityOwnership(admin, playerId, selection);
    if (!ownership.valid) {
      if (ownership.reason === "inventory_unavailable") {
        throw new Error("Não foi possível confirmar a posse dos poderes do duelo.");
      }
      if (ownership.reason === "invalid_abilities") {
        throw new Error("Cada jogador precisa salvar exatamente dois poderes válidos e diferentes.");
      }
      throw new Error("Um dos poderes equipados não pertence ao jogador.");
    }
    return {
      id: playerId,
      name: profile.display_name,
      avatarConfig: AvatarConfigSchema.parse(profile.avatar_config ?? DEFAULT_AVATAR_CONFIG),
      abilityIds: selection.abilityIds,
      energy: energyByPlayer.get(playerId),
    };
  }

  const [challenger, challenged] = await Promise.all([
    playerSetup(challenge.requester_id),
    playerSetup(challenge.addressee_id),
  ]);
  const battleId = randomUUID();
  const state = createPvpBattle(battleId, challenger, challenged, secureRandom);
  const { data, error } = await admin.rpc("start_pvp_challenge", {
    target_challenge_id: challengeId,
    acting_user_id: actorId,
    target_battle_id: battleId,
    submitted_state: state,
  });
  if (error) {
    console.error("Falha ao iniciar batalha PVP.", error.code);
    throw new Error("A sala mudou ou o loadout não corresponde ao salvo. Atualize e tente novamente.");
  }
  return data;
}
