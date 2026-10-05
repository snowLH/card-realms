import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameRuleError,
  attachEnergy,
  concedeBattle,
  createDemoBattle,
  createEncounterBattle,
  getDefaultOpponentAbilityIds,
  getOpponent,
  getSide,
  passTurn,
  playNpcTurn,
  resolveAbility,
} from "@/game/engine";
import { CREATURES, CREATURE_BY_ID, REGIONS } from "@/game/catalog";
import { LOCAL_MAPS } from "@/game/exploration/maps";
import { RemotePlayerSnapshotSchema } from "@/game/player";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { GuestBattleSetupSchema } from "@/game/battle/guest-setup";
import { STARTER_ARPG_ABILITY_IDS } from "@/game/arpg/content/ability-cards";
import type { BattleActionResult, BattleEncounter, BattleReward, BattleState, EnergyPool } from "@/game/types";
import { assertTokenUnused, consumeToken, signBattleState, verifyBattleState } from "@/lib/game-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { validateArpgAbilityOwnership } from "@/server/arpg/ability-ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EnergyPoolSchema = z.object({
  fire: z.number().int().nonnegative().max(9999),
  water: z.number().int().nonnegative().max(9999),
  nature: z.number().int().nonnegative().max(9999),
  storm: z.number().int().nonnegative().max(9999),
  spirit: z.number().int().nonnegative().max(9999),
}).strict();

const EncounterSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("wild"), regionId: z.string().min(1).max(80), creatureId: z.string().min(1).max(80) }),
  z.strictObject({ kind: z.literal("npc"), regionId: z.string().min(1).max(80), npcId: z.string().min(1).max(80) }),
  z.strictObject({ kind: z.literal("sanctuary"), regionId: z.string().min(1).max(80), areaId: z.string().min(1).max(80) }),
  z.strictObject({ kind: z.literal("boss"), regionId: z.string().min(1).max(80), areaId: z.string().min(1).max(80) }),
]);

const VersionedAction = {
  token: z.string().min(20),
  actionId: z.string().min(4).max(100),
};

const requestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("start"),
    encounter: EncounterSchema.optional(),
    playerEnergy: EnergyPoolSchema.optional(),
    guestSetup: GuestBattleSetupSchema.optional(),
  }),
  z.strictObject({ ...VersionedAction, action: z.literal("attach"), cardId: z.string().min(8).max(120) }),
  z.strictObject({ ...VersionedAction, action: z.literal("ability"), slot: z.number().int().min(0).max(1) }),
  z.strictObject({ ...VersionedAction, action: z.literal("pass") }),
  z.strictObject({ ...VersionedAction, action: z.literal("concede") }),
]);

const BattleRewardSchema = z.object({
  coins: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  replayed: z.boolean().optional(),
});

function response(state: BattleState, events = state.log.slice(-1), reward?: BattleReward) {
  return NextResponse.json({ state, events, token: signBattleState(state), reward, authority: "server" });
}

async function authenticatedPlayerId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

async function loadAuthenticatedBattleContext() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== "string") return null;
  const playerId = claimsData.claims.sub;
  const { data, error } = await supabase.rpc("get_my_player_snapshot");
  if (error) throw new Error("Não foi possível carregar seu perfil para a batalha.");
  const snapshot = RemotePlayerSnapshotSchema.parse(data);
  if (snapshot.profile.id !== playerId || !snapshot.arpgLoadout) {
    throw new Error("Salve seu personagem e equipe dois poderes no Arquivo antes de batalhar.");
  }
  const abilityIds = snapshot.arpgLoadout.abilityIds;
  const ownership = await validateArpgAbilityOwnership(createAdminClient(), playerId, { abilityIds });
  if (!ownership.valid) {
    if (ownership.reason === "inventory_unavailable") {
      throw new Error("Não foi possível confirmar a posse dos poderes equipados.");
    }
    if (ownership.reason === "invalid_abilities") {
      throw new Error("Equipe exatamente dois poderes válidos e diferentes para batalhar.");
    }
    throw new Error("Um dos poderes equipados não pertence à sua conta.");
  }
  return {
    playerId,
    name: snapshot.profile.displayName,
    avatarConfig: snapshot.profile.avatarConfig,
    abilityIds,
    energy: snapshot.energy as EnergyPool,
    currentRegionId: snapshot.world.currentRegionId,
  };
}

function encounterSetup(
  encounter: BattleEncounter,
  player: { avatarConfig: typeof DEFAULT_AVATAR_CONFIG; abilityIds: readonly string[]; currentRegionId?: string } | null,
) {
  if (player?.currentRegionId && encounter.regionId !== player.currentRegionId) {
    throw new GameRuleError("Este encontro não pertence à região atual da conta.");
  }
  const map = LOCAL_MAPS[encounter.regionId];
  const region = REGIONS.find((candidate) => candidate.id === encounter.regionId);
  if (!map || !region) throw new GameRuleError("A região do encontro é inválida.");
  const playerSettings = {
    regionId: encounter.regionId,
    playerAvatarConfig: player?.avatarConfig ?? DEFAULT_AVATAR_CONFIG,
    playerAbilityIds: player?.abilityIds ?? STARTER_ARPG_ABILITY_IDS,
  };

  if (encounter.kind === "wild") {
    const creature = CREATURE_BY_ID.get(encounter.creatureId);
    if (!creature || creature.regionId !== encounter.regionId) throw new GameRuleError("O inimigo encontrado não pertence a esta região.");
    return {
      ...playerSettings,
      mode: "wild" as const,
      opponentId: `wild:${creature.id}`,
      opponentName: creature.name,
      opponentAbilityIds: getDefaultOpponentAbilityIds(creature.id),
      opponentHp: Math.max(110, creature.hp * 2),
      startMessage: `Um encontro começou contra ${creature.name}.`,
    };
  }

  if (encounter.kind === "npc") {
    const npc = map.npcs.find((candidate) => candidate.id === encounter.npcId);
    if (!npc) throw new GameRuleError("Este viajante não pertence à região atual.");
    const regional = CREATURES.filter((creature) => creature.regionId === encounter.regionId);
    if (regional.length === 0) throw new GameRuleError("Esta região ainda não possui inimigos válidos.");
    const order = Math.max(0, map.npcs.findIndex((candidate) => candidate.id === npc.id));
    const enemy = regional[order % regional.length];
    return {
      ...playerSettings,
      mode: "npc" as const,
      opponentId: `npc:${npc.id}`,
      opponentName: npc.name,
      opponentAbilityIds: getDefaultOpponentAbilityIds(enemy.id),
      opponentHp: 150,
      startMessage: `${npc.name} aceitou o duelo em ${region.name}.`,
    };
  }

  const area = region.areas?.find((candidate) => candidate.id === encounter.areaId);
  if (!area || area.activity !== encounter.kind) throw new GameRuleError("A área não corresponde ao tipo de batalha solicitado.");
  const regional = CREATURES.filter((creature) => creature.regionId === encounter.regionId);
  if (regional.length === 0) throw new GameRuleError("Esta área ainda não possui inimigos válidos.");
  const enemy = encounter.kind === "boss" ? regional.at(-1)! : regional[0];
  return {
    ...playerSettings,
    mode: encounter.kind,
    opponentId: `${encounter.kind}:${area.id}`,
    opponentName: area.name,
    opponentKind: encounter.kind === "boss" ? "boss" as const : "npc" as const,
    opponentAbilityIds: getDefaultOpponentAbilityIds(enemy.id),
    opponentHp: encounter.kind === "boss" ? Math.max(260, enemy.hp * 4) : 175,
    startMessage: `${area.name} iniciou uma ${encounter.kind === "boss" ? "batalha de guardião" : "provação de santuário"}.`,
  };
}

async function recordBattleMissionEvents(state: BattleState, events: BattleActionResult["events"]) {
  const playerId = await authenticatedPlayerId();
  if (!playerId) return;
  const opponent = getOpponent(state, "player-one");
  const missionEvents: Array<BattleActionResult["events"][number] | Record<string, unknown>> = [...events];
  if (state.status === "finished" && state.winnerId === "player-one") {
    missionEvents.push({
      id: `${state.id}:mission:victory`,
      turn: state.turn.number,
      actorId: "player-one",
      kind: "battle_victory",
      message: "Vitória registrada para o progresso de missões.",
    });
  }
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_mission_events", {
    target_player_id: playerId,
    target_events: missionEvents,
    target_context: { regionId: state.regionId ?? null, opponentId: opponent.id, mode: state.mode },
  });
  if (error) console.error("Falha ao registrar progresso de missão.", error.code);
}

async function claimStoryReward(battleId: string): Promise<BattleReward | undefined> {
  const playerId = await authenticatedPlayerId();
  if (!playerId) return undefined;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_story_battle_reward", {
    target_player_id: playerId,
    target_battle_id: z.string().uuid().parse(battleId),
  });
  if (error) {
    console.error("Falha ao registrar recompensa da batalha.", error.code);
    throw new Error("A vitória ocorreu, mas a recompensa não pôde ser registrada.");
  }
  return BattleRewardSchema.parse(data);
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.parse(await request.json());
    if (parsed.action === "start") {
      const authenticated = await loadAuthenticatedBattleContext();
      const guestSetup = authenticated ? undefined : parsed.guestSetup;
      const random = () => randomInt(0, 0x1000000) / 0x1000000;
      const playerEnergy = authenticated?.energy ?? parsed.playerEnergy;
      const playerSettings = {
        playerAvatarConfig: authenticated?.avatarConfig ?? guestSetup?.avatarConfig,
        playerAbilityIds: authenticated?.abilityIds ?? guestSetup?.abilityIds,
        playerEnergy,
      };
      const state = parsed.encounter
        ? createEncounterBattle(
            randomUUID(),
            { ...encounterSetup(parsed.encounter, authenticated), ...playerSettings },
            random,
          )
        : createDemoBattle(
            randomUUID(),
            random,
            playerSettings.playerAvatarConfig,
            playerSettings.playerAbilityIds,
            playerSettings.playerEnergy,
          );
      return response(state, state.log);
    }

    assertTokenUnused(parsed.token);
    const state = verifyBattleState(parsed.token);
    const actor = getSide(state, state.turn.sideId);
    if (actor.kind !== "player") throw new GameRuleError("A batalha ainda está aguardando uma ação do oponente.");

    let result: BattleActionResult;
    if (parsed.action === "attach") {
      result = attachEnergy(state, actor.id, parsed.cardId, parsed.actionId);
    } else if (parsed.action === "ability") {
      result = resolveAbility(state, actor.id, parsed.slot, randomInt(1, 7), randomInt(1, 101), parsed.actionId);
    } else if (parsed.action === "concede") {
      result = concedeBattle(state, actor.id, parsed.actionId);
    } else {
      result = passTurn(state, actor.id, parsed.actionId);
    }

    if (result.state.status === "active" && getSide(result.state, result.state.turn.sideId).kind !== "player") {
      const npcResult = playNpcTurn(result.state, result.state.turn.sideId, `${parsed.actionId}:npc`, () => randomInt(0, 0x1000000) / 0x1000000);
      result = { state: npcResult.state, events: [...result.events, ...npcResult.events] };
    }

    await recordBattleMissionEvents(result.state, result.events);
    const reward = result.state.status === "finished" && result.state.winnerId === "player-one"
      ? await claimStoryReward(result.state.id)
      : undefined;
    consumeToken(parsed.token);
    return response(result.state, result.events, reward);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "A solicitação de batalha é inválida."
      : error instanceof Error
        ? error.message
        : "Não foi possível processar a ação.";
    return NextResponse.json({ error: message }, { status: error instanceof GameRuleError ? 409 : 400 });
  }
}
