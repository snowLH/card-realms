import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameRuleError,
  attachEnergy,
  createDemoBattle,
  passTurn,
  planNpcTurn,
  getSide,
  resolveAttack,
  switchActiveCreature,
} from "@/game/engine";
import { type BattleActionResult, type BattleState } from "@/game/types";
import {
  assertTokenUnused,
  consumeToken,
  signBattleState,
  verifyBattleState,
} from "@/lib/game-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
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

function response(state: BattleState, events = state.log.slice(-1)) {
  return NextResponse.json({
    state,
    events,
    token: signBattleState(state),
    authority: "server",
  });
}

function performNpcTurn(state: BattleState, actionId: string): BattleActionResult {
  const side = getSide(state, state.turn.sideId);
  if (side.kind !== "npc") throw new GameRuleError("Não é o turno do oponente.");

  let working = state;
  const events: BattleActionResult["events"] = [];
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
      const state = createDemoBattle(randomUUID());
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

    consumeToken(parsed.token);
    return response(result.state, result.events);
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
