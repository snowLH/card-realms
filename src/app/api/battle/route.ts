import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameRuleError,
  attachEnergy,
  concedeBattle,
  getOpponent,
  getSide,
  passTurn,
  playNpcTurn,
  resolveAbility,
} from "@/game/engine";
import type { BattleActionResult, BattleReward, BattleState } from "@/game/types";
import { assertTokenUnused, consumeToken, signBattleState, verifyBattleState } from "@/lib/game-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VersionedAction = {
  token: z.string().min(20),
  actionId: z.string().min(4).max(100),
};

const requestSchema = z.discriminatedUnion("action", [
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

function retiredBattleResponse() {
  return NextResponse.json({
    error: "Os combates clássicos foram desativados. Use CONFLITO/PvP para duelos de avatar com dois poderes.",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}

async function authenticatedPlayerId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
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
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "action" in body && body.action === "start") {
      return retiredBattleResponse();
    }
    const parsed = requestSchema.parse(body);

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
