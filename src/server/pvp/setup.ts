import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createPvpRealtimeDuel } from "@/game/pvp/realtime";
import { hasMatchingLegendPowerPair } from "@/game/pvp/legend-readiness";
import { DEFAULT_AVATAR_CONFIG, AvatarConfigSchema } from "@/game/save/local-progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateArpgAbilityOwnership } from "@/server/arpg/ability-ownership";

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
  ] = await Promise.all([
    admin.from("profiles").select("id,display_name,avatar_config").in("id", playerIds),
    admin.from("player_arpg_loadouts").select("user_id,ability_ids").in("user_id", playerIds),
  ]);
  if (profileError || loadoutError || profiles?.length !== 2 || loadoutRows?.length !== 2) {
    throw new Error("Os dois jogadores precisam de perfil e poderes salvos no Arquivo.");
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const loadoutByPlayer = new Map(loadoutRows.map((row) => [row.user_id, row]));

  async function playerSetup(playerId: string) {
    const profile = profileById.get(playerId);
    const row = loadoutByPlayer.get(playerId);
    if (!profile || !row) throw new Error("Perfil ou personagem equipado não encontrado.");
    const selection = abilitySelectionFromRow(row);
    const avatar = AvatarConfigSchema.safeParse(profile.avatar_config ?? DEFAULT_AVATAR_CONFIG);
    if (!avatar.success || !hasMatchingLegendPowerPair(avatar.data, selection.abilityIds)) {
      throw new Error("Cada jogador precisa dos dois poderes próprios da Lenda ativa.");
    }
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
      avatarConfig: avatar.data,
      abilityIds: selection.abilityIds,
    };
  }

  const [challenger, challenged] = await Promise.all([
    playerSetup(challenge.requester_id),
    playerSetup(challenge.addressee_id),
  ]);
  const battleId = randomUUID();
  const state = createPvpRealtimeDuel(battleId, [challenger, challenged], Date.now());
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
