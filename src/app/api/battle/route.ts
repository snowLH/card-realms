import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameRuleError,
  acquireEnergy,
  attachEnergy,
  chooseNpcMove,
  createDemoBattle,
  getActive,
  getSide,
  resolveAttack,
  switchActiveCreature,
} from "@/game/engine";
import { ELEMENTS, type BattleActionResult, type BattleState, type Element } from "@/game/types";
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
    action: z.literal("acquire"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
    choices: z.array(z.enum(ELEMENTS)).min(1).max(2),
  }),
  z.object({
    action: z.literal("attach"),
    token: z.string().min(20),
    actionId: z.string().min(4).max(100),
    creatureIndex: z.number().int().min(0).max(5),
    element: z.enum(ELEMENTS),
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
    action: z.literal("npc"),
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
  const side = getSide(state, state.currentSideId);
  if (side.kind !== "npc") throw new GameRuleError("Não é o turno do oponente.");

  let working = state;
  const events: BattleActionResult["events"] = [];
  let move = chooseNpcMove(working, side.id);

  if (!move.attack && side.acquiredThisTurn < 2) {
    const desired = move.energyToAttach ?? "nature";
    if (side.energyReserve[desired] > 0) {
      const acquired = acquireEnergy(working, side.id, [desired], `${actionId}:acquire`);
      working = acquired.state;
      events.push(...acquired.events);
    }
  }

  move = chooseNpcMove(working, side.id);
  if (move.energyToAttach) {
    const attached = attachEnergy(
      working,
      side.id,
      getSide(working, side.id).activeIndex,
      move.energyToAttach,
      `${actionId}:attach`,
    );
    working = attached.state;
    events.push(...attached.events);
  }

  move = chooseNpcMove(working, side.id);
  if (move.attack) {
    const attacked = resolveAttack(
      working,
      side.id,
      move.attack.id,
      randomInt(1, 7),
      `${actionId}:attack`,
    );
    working = attacked.state;
    events.push(...attacked.events);
    return { state: working, events };
  }

  // With a full seven-element opening pool, this path only occurs after an
  // unusually long battle. Attach another matching card before retrying.
  const active = getActive(getSide(working, side.id));
  const fallback = chooseNpcMove(working, side.id).energyToAttach;
  if (fallback && getSide(working, side.id).attachmentsThisTurn < 2) {
    const attached = attachEnergy(
      working,
      side.id,
      getSide(working, side.id).activeIndex,
      fallback,
      `${actionId}:attach-fallback`,
    );
    working = attached.state;
    events.push(...attached.events);
  }
  const definition = active.catalogId;
  throw new GameRuleError(`Oponente não encontrou uma ação válida para ${definition}.`);
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
    let result: BattleActionResult;

    switch (parsed.action) {
      case "acquire":
        result = acquireEnergy(
          state,
          state.currentSideId,
          parsed.choices as Element[],
          parsed.actionId,
        );
        break;
      case "attach":
        result = attachEnergy(
          state,
          state.currentSideId,
          parsed.creatureIndex,
          parsed.element,
          parsed.actionId,
        );
        break;
      case "switch":
        result = switchActiveCreature(
          state,
          state.currentSideId,
          parsed.creatureIndex,
          parsed.actionId,
        );
        break;
      case "attack":
        result = resolveAttack(
          state,
          state.currentSideId,
          parsed.attackId,
          randomInt(1, 7),
          parsed.actionId,
        );
        break;
      case "npc":
        result = performNpcTurn(state, parsed.actionId);
        break;
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
