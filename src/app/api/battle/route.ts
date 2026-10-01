import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameRuleError,
  attachEnergy,
  createDemoBattle,
  createEncounterBattle,
  drawPowerCard,
  equipPowerCard,
  evolveActiveCreature,
  passTurn,
  planNpcTurn,
  getSide,
  getOpponent,
  resolveAttack,
  switchActiveCreature,
} from "@/game/engine";
import { CREATURES, CREATURE_BY_ID, REGIONS } from "@/game/catalog";
import { LOCAL_MAPS } from "@/game/exploration/maps";
import { RemotePlayerSnapshotSchema } from "@/game/player";
import { ELEMENTS, type BattleActionResult, type BattleEncounter, type BattleReward, type BattleState, type EnergyPool } from "@/game/types";
import {
  assertTokenUnused,
  consumeToken,
  signBattleState,
  verifyBattleState,
} from "@/lib/game-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EnergyPoolSchema = z.object({
  fire: z.number().int().nonnegative().max(9999),
  water: z.number().int().nonnegative().max(9999),
  nature: z.number().int().nonnegative().max(9999),
  storm: z.number().int().nonnegative().max(9999),
  spirit: z.number().int().nonnegative().max(9999),
});

const EncounterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("wild"), regionId: z.string().min(1).max(80), creatureId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("npc"), regionId: z.string().min(1).max(80), npcId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("sanctuary"), regionId: z.string().min(1).max(80), areaId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("boss"), regionId: z.string().min(1).max(80), areaId: z.string().min(1).max(80) }),
]);

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    encounter: EncounterSchema.optional(),
    playerEnergy: EnergyPoolSchema.optional(),
  }),
  z.object({
    action: z.literal("attach"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
    creatureIndex: z.number().int().min(0).max(5),
    cardId: z.string().min(8).max(120),
  }),
  z.object({
    action: z.literal("switch"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
    creatureIndex: z.number().int().min(0).max(5),
  }),
  z.object({
    action: z.literal("draw_power"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
  }),
  z.object({
    action: z.literal("equip_power"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
    creatureIndex: z.number().int().min(0).max(5),
    cardId: z.string().min(8).max(160),
    slot: z.number().int().min(0).max(3).optional(),
  }),
  z.object({
    action: z.literal("evolve"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
  }),
  z.object({
    action: z.literal("attack"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
    attackId: z.string().min(3).max(100),
  }),
  z.object({
    action: z.literal("pass"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
  }),
]);

const BattleRewardSchema = z.object({
  coins: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  creatureId: z.string().nullable().default(null),
  replayed: z.boolean().optional(),
});

function response(
  state: BattleState,
  events = state.log.slice(-1),
  reward?: BattleReward,
) {
  return NextResponse.json({
    state,
    events,
    token: signBattleState(state),
    reward,
    authority: "server",
  });
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
  const { data, error } = await supabase.rpc("get_my_player_snapshot");
  if (error) throw new Error("Não foi possível carregar seu progresso para a batalha.");
  const snapshot = RemotePlayerSnapshotSchema.parse(data);
  const team = snapshot.teams.find((candidate) => candidate.isActive);
  return {
    teamIds: team?.members
      .slice()
      .sort((left, right) => left.slot - right.slot)
      .map((member) => member.catalogId) ?? [],
    energy: snapshot.energy as EnergyPool,
    currentRegionId: snapshot.world.currentRegionId,
  };
}

function encounterSetup(
  encounter: BattleEncounter,
  playerTeamIds: readonly string[],
  currentRegionId?: string,
) {
  if (currentRegionId && encounter.regionId !== currentRegionId) {
    throw new GameRuleError("Este encontro não pertence à região atual da conta.");
  }
  const map = LOCAL_MAPS[encounter.regionId];
  const region = REGIONS.find((candidate) => candidate.id === encounter.regionId);
  if (!map || !region) throw new GameRuleError("A região do encontro é inválida.");

  if (encounter.kind === "wild") {
    const creature = CREATURE_BY_ID.get(encounter.creatureId);
    if (!creature || creature.regionId !== encounter.regionId) {
      throw new GameRuleError("A criatura encontrada não pertence a esta região.");
    }
    return {
      mode: "wild" as const,
      opponentId: `wild:${creature.id}`,
      opponentName: creature.name,
      opponentTeamIds: [creature.id],
      playerTeamIds,
      startMessage: `Um encontro selvagem começou contra ${creature.name}.`,
    };
  }

  if (encounter.kind === "npc") {
    const npc = map.npcs.find((candidate) => candidate.id === encounter.npcId);
    if (!npc) throw new GameRuleError("Este viajante não pertence à região atual.");
    const regional = CREATURES.filter((creature) => creature.regionId === encounter.regionId);
    if (regional.length === 0) throw new GameRuleError("O viajante ainda não possui uma equipe válida.");
    const start = Math.max(0, map.npcs.findIndex((candidate) => candidate.id === npc.id));
    const size = Math.max(1, Math.min(playerTeamIds.length, 6));
    const opponentTeamIds = Array.from({ length: size }, (_, index) =>
      regional[(start + index) % regional.length].id
    );
    return {
      mode: "npc" as const,
      opponentId: `npc:${npc.id}`,
      opponentName: npc.name,
      opponentTeamIds,
      playerTeamIds,
      startMessage: `${npc.name} aceitou o duelo de treino em ${region.name}.`,
    };
  }

  const area = region.areas?.find((candidate) => candidate.id === encounter.areaId);
  if (!area || area.activity !== encounter.kind) {
    throw new GameRuleError("A área não corresponde ao tipo de batalha solicitado.");
  }
  const regional = CREATURES.filter((creature) => creature.regionId === encounter.regionId);
  if (regional.length === 0) throw new GameRuleError("Esta área ainda não possui adversários válidos.");
  const size = Math.max(1, Math.min(playerTeamIds.length, 6));
  const opponentTeamIds = encounter.kind === "boss"
    ? [...regional].slice(-size).map((creature) => creature.id)
    : regional.slice(0, size).map((creature) => creature.id);
  return {
    mode: encounter.kind,
    opponentId: `${encounter.kind}:${area.id}`,
    opponentName: area.name,
    opponentKind: encounter.kind === "boss" ? "boss" as const : "npc" as const,
    opponentTeamIds,
    playerTeamIds,
    startMessage: `${area.name} iniciou uma ${encounter.kind === "boss" ? "batalha de guardião" : "provação de santuário"}.`,
  };
}

async function recordBattleMissionEvents(
  state: BattleState,
  events: BattleActionResult["events"],
) {
  const playerId = await authenticatedPlayerId();
  if (!playerId) return;

  const opponent = getOpponent(state, "player-one");
  const regionId = opponent.id === "warden-aya"
    ? "roots"
    : opponent.id.startsWith("boss:roots-")
      ? "roots"
      : CREATURE_BY_ID.get(opponent.team[0]?.catalogId ?? "")?.regionId ?? null;
  const missionEvents = [...events];
  if (state.status === "finished" && state.winnerId === "player-one") {
    missionEvents.push({
      id: `${state.id}:mission:victory`,
      turn: state.turn.number,
      actorId: "player-one",
      kind: "battle_victory" as never,
      message: "Vitória registrada para o progresso de missões.",
    });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_mission_events", {
    target_player_id: playerId,
    target_events: missionEvents,
    target_context: {
      regionId,
      opponentId: opponent.id,
      mode: state.mode,
    },
  });
  if (error) {
    console.error("Falha ao registrar progresso de missão.", error.code);
  }
}

async function claimStoryReward(battleId: string): Promise<BattleReward | undefined> {
  const playerId = await authenticatedPlayerId();
  if (!playerId) return undefined;
  const parsedBattleId = z.string().uuid().parse(battleId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_story_battle_reward", {
    target_player_id: playerId,
    target_battle_id: parsedBattleId,
  });
  if (error) {
    console.error("Falha ao registrar recompensa da batalha.", error.code);
    throw new Error("A vitória ocorreu, mas a recompensa não pôde ser registrada.");
  }
  return BattleRewardSchema.parse(data);
}

function performNpcTurn(state: BattleState, actionId: string): BattleActionResult {
  const side = getSide(state, state.turn.sideId);
  if (side.kind !== "npc" && side.kind !== "boss") throw new GameRuleError("Não é o turno do oponente.");

  let working = state;
  const events: BattleActionResult["events"] = [];

  if (side.powerDrawsRemaining > 0) {
    const drawnPower = drawPowerCard(working, side.id, `${actionId}:draw-power`);
    working = drawnPower.state;
    events.push(...drawnPower.events);

    const refreshedSide = getSide(working, side.id);
    const activeCreature = refreshedSide.team[refreshedSide.activeIndex];
    const activeDefinition = CREATURE_BY_ID.get(activeCreature.catalogId);
    const compatiblePower = refreshedSide.powerHand.find((card) =>
      activeDefinition
      && card.element === activeDefinition.element
      && !activeCreature.equippedPowerIds.includes(card.attackId)
    );
    if (compatiblePower && activeCreature.equippedPowerIds.length < 4) {
      const equippedPower = equipPowerCard(
        working,
        side.id,
        refreshedSide.activeIndex,
        compatiblePower.id,
        undefined,
        `${actionId}:equip-power`,
      );
      working = equippedPower.state;
      events.push(...equippedPower.events);
    }
  }

  let plan = planNpcTurn(working, side.id);
  if (plan.forcedSwitchIndex !== undefined) {
    const switched = switchActiveCreature(
      working,
      side.id,
      plan.forcedSwitchIndex,
      `${actionId}:forced-switch`,
    );
    working = switched.state;
    events.push(...switched.events);
    plan = planNpcTurn(working, side.id);
  }

  if (plan.evolve) {
    const evolved = evolveActiveCreature(
      working,
      side.id,
      `${actionId}:evolve`,
    );
    working = evolved.state;
    events.push(...evolved.events);
    plan = planNpcTurn(working, side.id);
  }

  for (const [index, attachment] of plan.attachments.entries()) {
    const attached = attachEnergy(
      working,
      side.id,
      attachment.creatureIndex,
      attachment.cardId,
      `${actionId}:attach:${index}`,
    );
    working = attached.state;
    events.push(...attached.events);
  }

  if (plan.attackId) {
    const attacked = resolveAttack(
      working,
      side.id,
      plan.attackId,
      randomInt(1, 7),
      randomInt(1, 101),
      `${actionId}:attack`,
    );
    working = attacked.state;
    events.push(...attacked.events);
    return { state: working, events };
  }

  const passed = passTurn(working, side.id, `${actionId}:pass`);
  events.push(...passed.events);
  return { state: passed.state, events };
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.parse(await request.json());
    if (parsed.action === "start") {
      const authenticated = await loadAuthenticatedBattleContext();
      const playerTeamIds = authenticated?.teamIds ?? undefined;
      if (authenticated && authenticated.teamIds.length === 0) {
        throw new GameRuleError("Escolha sua primeira carta antes de entrar em combate.");
      }
      const random = () => randomInt(0, 0x1000000) / 0x1000000;
      const playerEnergy = authenticated?.energy ?? parsed.playerEnergy;
      if (playerEnergy && ELEMENTS.every((element) => playerEnergy[element] === 0)) {
        throw new GameRuleError("Você ainda não possui cartas de energia para batalhar.");
      }
      const state = parsed.encounter
        ? createEncounterBattle(
            randomUUID(),
            {
              ...encounterSetup(
                parsed.encounter,
                playerTeamIds ?? ["boitata"],
                authenticated?.currentRegionId,
              ),
              playerEnergy,
            },
            random,
          )
        : createDemoBattle(
            randomUUID(),
            random,
            playerTeamIds,
            playerEnergy,
          );
      return response(state, state.log);
    }

    assertTokenUnused(parsed.token);
    const state = verifyBattleState(parsed.token);
    const actor = getSide(state, state.turn.sideId);
    if (actor.kind !== "player") {
      throw new GameRuleError("O estado recebido não está aguardando uma ação do jogador.");
    }
    let result: BattleActionResult;

    switch (parsed.action) {
      case "attach":
        result = attachEnergy(
          state,
          state.turn.sideId,
          parsed.creatureIndex,
          parsed.cardId,
          parsed.actionId,
        );
        break;
      case "switch":
        result = switchActiveCreature(
          state,
          state.turn.sideId,
          parsed.creatureIndex,
          parsed.actionId,
        );
        break;
      case "draw_power":
        result = drawPowerCard(
          state,
          state.turn.sideId,
          parsed.actionId,
        );
        break;
      case "equip_power":
        result = equipPowerCard(
          state,
          state.turn.sideId,
          parsed.creatureIndex,
          parsed.cardId,
          parsed.slot,
          parsed.actionId,
        );
        break;
      case "evolve":
        result = evolveActiveCreature(
          state,
          state.turn.sideId,
          parsed.actionId,
        );
        break;
      case "attack":
        result = resolveAttack(
          state,
          state.turn.sideId,
          parsed.attackId,
          randomInt(1, 7),
          randomInt(1, 101),
          parsed.actionId,
        );
        break;
      case "pass":
        result = passTurn(state, state.turn.sideId, parsed.actionId);
        break;
    }

    if (
      result.state.status === "active" &&
      getSide(result.state, result.state.turn.sideId).kind === "npc"
    ) {
      const npcResult = performNpcTurn(result.state, `${parsed.actionId}:npc`);
      result = { state: npcResult.state, events: [...result.events, ...npcResult.events] };
    }

    await recordBattleMissionEvents(result.state, result.events);
    const reward = result.state.status === "finished" && result.state.winnerId === "player-one"
      ? await claimStoryReward(result.state.id)
      : undefined;
    consumeToken(parsed.token);
    return response(result.state, result.events, reward);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "A solicitação de batalha é inválida."
        : error instanceof Error
          ? error.message
          : "Não foi possível processar a ação.";
    const status = error instanceof GameRuleError ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

