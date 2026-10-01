import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { createPvpBattle } from "@/game/battle";
import { createAdminClient } from "@/lib/supabase/admin";

const TeamIdsSchema = z.tuple([
  z.string().min(1), z.string().min(1), z.string().min(1),
  z.string().min(1), z.string().min(1), z.string().min(1),
]);

function secureRandom() {
  return randomInt(0, 0x1000000) / 0x1000000;
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
  const [{ data: profiles, error: profileError }, { data: teams, error: teamError }] = await Promise.all([
    admin.from("profiles").select("id,display_name").in("id", playerIds),
    admin.from("teams").select("id,user_id").in("user_id", playerIds).eq("is_active", true),
  ]);
  if (profileError || teamError || profiles?.length !== 2 || teams?.length !== 2) {
    throw new Error("Os dois jogadores precisam de perfil e equipe ativa.");
  }

  const teamIds = teams.map((team) => team.id);
  const { data: members, error: memberError } = await admin
    .from("team_members")
    .select("team_id,slot,player_creature_id")
    .in("team_id", teamIds)
    .order("slot");
  if (memberError || !members || members.length !== 12) {
    throw new Error("Cada jogador precisa de exatamente seis criaturas.");
  }
  const validMembers = members;

  const instanceIds = validMembers.map((member) => member.player_creature_id);
  const { data: creatures, error: creatureError } = await admin
    .from("player_creatures")
    .select("id,user_id,creature_id,evolution_stage")
    .in("id", instanceIds);
  if (creatureError || !creatures || creatures.length !== 12) {
    throw new Error("A equipe contém uma criatura inválida.");
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const teamByPlayer = new Map(teams.map((team) => [team.user_id, team]));
  const creatureById = new Map(creatures.map((creature) => [creature.id, creature]));

  function playerSetup(playerId: string) {
    const team = teamByPlayer.get(playerId);
    const profile = profileById.get(playerId);
    if (!team || !profile) throw new Error("Perfil ou equipe ativa não encontrado.");
    const orderedMembers = validMembers
      .filter((member) => member.team_id === team.id)
      .sort((left, right) => left.slot - right.slot);
    const catalogIds = orderedMembers.map((member) => {
      const creature = creatureById.get(member.player_creature_id);
      if (!creature || creature.user_id !== playerId) {
        throw new Error("A equipe possui uma criatura que não pertence ao jogador.");
      }
      return creature.creature_id;
    });
    const evolutionStages = orderedMembers.map((member) => {
      const creature = creatureById.get(member.player_creature_id);
      return Number(creature?.evolution_stage) || 0;
    });
    return {
      id: playerId,
      name: profile.display_name,
      teamIds: TeamIdsSchema.parse(catalogIds),
      evolutionStages,
    };
  }

  const battleId = randomUUID();
  const state = createPvpBattle(
    battleId,
    playerSetup(challenge.requester_id),
    playerSetup(challenge.addressee_id),
    secureRandom,
  );
  const { data, error } = await admin.rpc("start_pvp_challenge", {
    target_challenge_id: challengeId,
    acting_user_id: actorId,
    target_battle_id: battleId,
    submitted_state: state,
  });
  if (error) {
    console.error("Falha ao iniciar batalha PVP.", error.code);
    throw new Error("A sala mudou durante a aceitação. Atualize e tente novamente.");
  }
  return data;
}
