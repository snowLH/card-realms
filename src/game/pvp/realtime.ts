import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID, ARPG_ABILITY_CARD_IDS } from "@/game/arpg/content/ability-cards";
import { AvatarConfigSchema, type AvatarConfig } from "@/game/save/local-progress";

export const PVP_REALTIME_VERSION = 1 as const;
export const PVP_DUEL_WIDTH = 1280;
export const PVP_DUEL_HEIGHT = 720;

const MAX_ADVANCE_MS = 1_000;
const SIMULATION_STEP_MS = 50;
const PLAYER_SPEED = 250;
const PLAYER_RADIUS = 28;
const DASH_SPEED = 650;
const DASH_DURATION_MS = 160;
const DASH_COOLDOWN_MS = 850;
const BASIC_ATTACK_RANGE = 430;
const BASIC_ATTACK_DAMAGE = 18;
const BASIC_ATTACK_COOLDOWN_MS = 440;
const MATCH_DURATION_MS = 3 * 60_000;

export type PvpRealtimePlayerSetup = {
  id: string;
  name: string;
  avatarConfig: AvatarConfig;
  abilityIds: readonly [string, string];
};

export type PvpRealtimeInput = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
};

export type PvpRealtimePlayer = {
  id: string;
  name: string;
  avatarConfig: AvatarConfig;
  abilityIds: [string, string];
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  input: PvpRealtimeInput;
  nextAttackAtMs: number;
  nextDashAtMs: number;
  dashingUntilMs: number;
  dashX: number;
  dashY: number;
  abilityReadyAtMs: [number, number];
  rootedUntilMs: number;
};

export type PvpRealtimeEventKind =
  | "duel_started"
  | "player_attack"
  | "attack_missed"
  | "player_dashed"
  | "ability_cast"
  | "player_hit"
  | "player_healed"
  | "player_rooted"
  | "duel_finished";

export type PvpRealtimeEvent = {
  id: string;
  sequence: number;
  atMs: number;
  actorId: string;
  kind: PvpRealtimeEventKind;
  message: string;
  abilityId?: string;
  slot?: 0 | 1;
  damage?: number;
  healing?: number;
  targetIds?: string[];
};

export type PvpRealtimeState = {
  kind: "pvp_realtime";
  version: typeof PVP_REALTIME_VERSION;
  id: string;
  status: "active" | "finished";
  winnerId: string | null;
  finishReason: "knockout" | "concede" | "timeout" | null;
  startedAtMs: number;
  serverTimeMs: number;
  players: [PvpRealtimePlayer, PvpRealtimePlayer];
  processedActionIds: string[];
  eventSequence: number;
  log: PvpRealtimeEvent[];
};

export type PvpRealtimeAction =
  | { kind: "input"; actionId: string; moveX: number; moveY: number; aimX: number; aimY: number }
  | { kind: "attack"; actionId: string }
  | { kind: "dash"; actionId: string }
  | { kind: "ability"; actionId: string; slot: 0 | 1 }
  | { kind: "concede"; actionId: string };

export type PvpRealtimeActionResult = {
  state: PvpRealtimeState;
  events: PvpRealtimeEvent[];
};

const AxisSchema = z.number().finite().min(-1).max(1);
const InputSchema = z.strictObject({
  moveX: AxisSchema,
  moveY: AxisSchema,
  aimX: AxisSchema,
  aimY: AxisSchema,
});

const PlayerSchema = z.strictObject({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarConfig: AvatarConfigSchema,
  abilityIds: z.tuple([
    z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id)),
    z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id)),
  ]).superRefine((ids, context) => {
    if (ids[0] === ids[1]) context.addIssue({ code: "custom", message: "Os poderes precisam ser diferentes." });
  }),
  x: z.number().finite().min(0).max(PVP_DUEL_WIDTH),
  y: z.number().finite().min(0).max(PVP_DUEL_HEIGHT),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  input: InputSchema,
  nextAttackAtMs: z.number().finite().nonnegative(),
  nextDashAtMs: z.number().finite().nonnegative(),
  dashingUntilMs: z.number().finite().nonnegative(),
  dashX: z.number().finite().min(-1).max(1),
  dashY: z.number().finite().min(-1).max(1),
  abilityReadyAtMs: z.tuple([z.number().finite().nonnegative(), z.number().finite().nonnegative()]),
  rootedUntilMs: z.number().finite().nonnegative(),
});

export const PvpRealtimeEventSchema = z.strictObject({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  atMs: z.number().finite().nonnegative(),
  actorId: z.string().min(1),
  kind: z.enum([
    "duel_started", "player_attack", "attack_missed", "player_dashed", "ability_cast",
    "player_hit", "player_healed", "player_rooted", "duel_finished",
  ]),
  message: z.string().max(240),
  abilityId: z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id)).optional(),
  slot: z.union([z.literal(0), z.literal(1)]).optional(),
  damage: z.number().int().nonnegative().optional(),
  healing: z.number().int().nonnegative().optional(),
  targetIds: z.array(z.string().min(1)).max(2).optional(),
});

export const PvpRealtimeStateSchema = z.strictObject({
  kind: z.literal("pvp_realtime"),
  version: z.literal(PVP_REALTIME_VERSION),
  id: z.string().uuid(),
  status: z.enum(["active", "finished"]),
  winnerId: z.string().uuid().nullable(),
  finishReason: z.enum(["knockout", "concede", "timeout"]).nullable(),
  startedAtMs: z.number().finite().nonnegative(),
  serverTimeMs: z.number().finite().nonnegative(),
  players: z.tuple([PlayerSchema, PlayerSchema]),
  processedActionIds: z.array(z.string().min(1)).max(300),
  eventSequence: z.number().int().nonnegative(),
  log: z.array(PvpRealtimeEventSchema).max(120),
}).superRefine((state, context) => {
  if (state.players[0].id === state.players[1].id) {
    context.addIssue({ code: "custom", message: "Os combatentes precisam ser diferentes.", path: ["players"] });
  }
  if (state.players.some((player) => player.hp > player.maxHp)) {
    context.addIssue({ code: "custom", message: "A vida excede o máximo do personagem.", path: ["players"] });
  }
  if (state.status === "active" && (state.winnerId !== null || state.finishReason !== null)) {
    context.addIssue({ code: "custom", message: "Um duelo ativo não pode ter resultado.", path: ["winnerId"] });
  }
  if (state.status === "finished" && state.finishReason === null) {
    context.addIssue({ code: "custom", message: "Um duelo finalizado precisa de um motivo.", path: ["finishReason"] });
  }
});

const CanonicalUuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const VersionedAction = {
  battleId: CanonicalUuidSchema,
  expectedVersion: z.number().int().positive(),
  actionId: CanonicalUuidSchema,
};

export const PvpRealtimeActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...VersionedAction,
    action: z.literal("input"),
    moveX: AxisSchema,
    moveY: AxisSchema,
    aimX: AxisSchema,
    aimY: AxisSchema,
  }),
  z.strictObject({ ...VersionedAction, action: z.literal("attack") }),
  z.strictObject({ ...VersionedAction, action: z.literal("dash") }),
  z.strictObject({ ...VersionedAction, action: z.literal("ability"), slot: z.union([z.literal(0), z.literal(1)]) }),
  z.strictObject({ ...VersionedAction, action: z.literal("concede") }),
]);

export type PvpRealtimeActionRequest = z.infer<typeof PvpRealtimeActionSchema>;

export function toPvpRealtimeEngineAction(action: PvpRealtimeActionRequest): PvpRealtimeAction {
  if (action.action === "input") {
    return {
      kind: "input",
      actionId: action.actionId,
      moveX: action.moveX,
      moveY: action.moveY,
      aimX: action.aimX,
      aimY: action.aimY,
    };
  }
  if (action.action === "ability") return { kind: "ability", actionId: action.actionId, slot: action.slot };
  if (action.action === "attack") return { kind: "attack", actionId: action.actionId };
  if (action.action === "dash") return { kind: "dash", actionId: action.actionId };
  return { kind: "concede", actionId: action.actionId };
}

export class PvpRealtimeRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PvpRealtimeRuleError";
  }
}

function normalize(x: number, y: number) {
  const safeX = Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
  const safeY = Math.max(-1, Math.min(1, Number.isFinite(y) ? y : 0));
  const length = Math.hypot(safeX, safeY);
  if (length < 0.001) return { x: 0, y: 0 };
  if (length <= 1) return { x: safeX, y: safeY };
  return { x: safeX / length, y: safeY / length };
}

function distance(left: Pick<PvpRealtimePlayer, "x" | "y">, right: Pick<PvpRealtimePlayer, "x" | "y">) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function playerFor(state: PvpRealtimeState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new PvpRealtimeRuleError("Jogador não participa deste duelo.");
  return player;
}

function opponentFor(state: PvpRealtimeState, playerId: string) {
  const opponent = state.players.find((candidate) => candidate.id !== playerId);
  if (!opponent) throw new PvpRealtimeRuleError("Adversário não encontrado.");
  return opponent;
}

function appendEvent(
  state: PvpRealtimeState,
  atMs: number,
  actorId: string,
  kind: PvpRealtimeEventKind,
  message: string,
  extra: Partial<Omit<PvpRealtimeEvent, "id" | "sequence" | "atMs" | "actorId" | "kind" | "message">> = {},
) {
  state.eventSequence += 1;
  const event: PvpRealtimeEvent = {
    id: `pvp-realtime:${state.eventSequence}`,
    sequence: state.eventSequence,
    atMs,
    actorId,
    kind,
    message,
    ...extra,
  };
  state.log.push(event);
  state.log = state.log.slice(-120);
  return event;
}

function validateSetup(player: PvpRealtimePlayerSetup) {
  if (!player.id || player.id.length > 80 || !player.name.trim() || player.name.length > 80) {
    throw new PvpRealtimeRuleError("O perfil do duelista é inválido.");
  }
  if (!AvatarConfigSchema.safeParse(player.avatarConfig).success) {
    throw new PvpRealtimeRuleError(`${player.name} possui uma aparência inválida.`);
  }
  if (player.abilityIds.length !== 2
    || player.abilityIds[0] === player.abilityIds[1]
    || player.abilityIds.some((id) => !ARPG_ABILITY_CARD_BY_ID.has(id))) {
    throw new PvpRealtimeRuleError(`${player.name} precisa levar dois poderes diferentes e válidos.`);
  }
}

export function createPvpRealtimeDuel(
  id: string,
  setups: readonly [PvpRealtimePlayerSetup, PvpRealtimePlayerSetup],
  nowMs: number,
): PvpRealtimeState {
  if (!z.string().uuid().safeParse(id).success) throw new PvpRealtimeRuleError("O identificador do duelo é inválido.");
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new PvpRealtimeRuleError("O relógio do servidor é inválido.");
  if (setups[0].id === setups[1].id) throw new PvpRealtimeRuleError("Os combatentes precisam ser diferentes.");
  setups.forEach(validateSetup);

  const spawn = [{ x: 250, y: PVP_DUEL_HEIGHT / 2 }, { x: PVP_DUEL_WIDTH - 250, y: PVP_DUEL_HEIGHT / 2 }] as const;
  const players = setups.map((setup, index): PvpRealtimePlayer => ({
    id: setup.id,
    name: setup.name.trim(),
    avatarConfig: AvatarConfigSchema.parse(setup.avatarConfig),
    abilityIds: [setup.abilityIds[0], setup.abilityIds[1]],
    x: spawn[index].x,
    y: spawn[index].y,
    hp: 120,
    maxHp: 120,
    input: { moveX: 0, moveY: 0, aimX: index === 0 ? 1 : -1, aimY: 0 },
    nextAttackAtMs: nowMs,
    nextDashAtMs: nowMs,
    dashingUntilMs: nowMs,
    dashX: index === 0 ? 1 : -1,
    dashY: 0,
    abilityReadyAtMs: [nowMs, nowMs],
    rootedUntilMs: nowMs,
  }));

  const state: PvpRealtimeState = {
    kind: "pvp_realtime",
    version: PVP_REALTIME_VERSION,
    id,
    status: "active",
    winnerId: null,
    finishReason: null,
    startedAtMs: nowMs,
    serverTimeMs: nowMs,
    players: [players[0], players[1]],
    processedActionIds: [],
    eventSequence: 0,
    log: [],
  };
  appendEvent(state, nowMs, "system", "duel_started", "O duelo em tempo real começou.");
  return state;
}

function finish(state: PvpRealtimeState, reason: NonNullable<PvpRealtimeState["finishReason"]>, winnerId: string | null, atMs: number, events: PvpRealtimeEvent[]) {
  if (state.status === "finished") return;
  state.status = "finished";
  state.finishReason = reason;
  state.winnerId = winnerId;
  const winner = winnerId ? state.players.find((player) => player.id === winnerId) : null;
  const message = reason === "timeout"
    ? winner ? `${winner.name} venceu ao fim do tempo.` : "O duelo terminou empatado pelo tempo."
    : winner ? `${winner.name} venceu o duelo.` : "O duelo terminou sem vencedor.";
  events.push(appendEvent(state, atMs, "system", "duel_finished", message));
}

function finishIfNeeded(state: PvpRealtimeState, atMs: number, events: PvpRealtimeEvent[]) {
  if (state.status !== "active") return;
  const [left, right] = state.players;
  if (left.hp <= 0 || right.hp <= 0) {
    const winnerId = left.hp === right.hp ? null : left.hp <= 0 ? right.id : left.id;
    finish(state, "knockout", winnerId, atMs, events);
  } else if (atMs - state.startedAtMs >= MATCH_DURATION_MS) {
    const winnerId = left.hp === right.hp ? null : left.hp > right.hp ? left.id : right.id;
    finish(state, "timeout", winnerId, atMs, events);
  }
}

function advancePlayers(state: PvpRealtimeState, fromMs: number, toMs: number) {
  const elapsed = (toMs - fromMs) / 1000;
  for (const player of state.players) {
    let remaining = elapsed;
    let cursor = fromMs;
    if (player.dashingUntilMs > cursor) {
      const dashEnd = Math.min(toMs, player.dashingUntilMs);
      const dashSeconds = Math.max(0, dashEnd - cursor) / 1000;
      player.x += player.dashX * DASH_SPEED * dashSeconds;
      player.y += player.dashY * DASH_SPEED * dashSeconds;
      remaining -= dashSeconds;
      cursor = dashEnd;
    }
    if (remaining > 0 && toMs >= player.rootedUntilMs) {
      const movement = normalize(player.input.moveX, player.input.moveY);
      player.x += movement.x * PLAYER_SPEED * remaining;
      player.y += movement.y * PLAYER_SPEED * remaining;
    }
    player.x = Math.max(PLAYER_RADIUS, Math.min(PVP_DUEL_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(PVP_DUEL_HEIGHT - PLAYER_RADIUS, player.y));
  }

  const [left, right] = state.players;
  const separation = distance(left, right);
  if (separation > 0 && separation < PLAYER_RADIUS * 2) {
    const overlap = PLAYER_RADIUS * 2 - separation;
    const dx = (right.x - left.x) / separation;
    const dy = (right.y - left.y) / separation;
    left.x = Math.max(PLAYER_RADIUS, Math.min(PVP_DUEL_WIDTH - PLAYER_RADIUS, left.x - dx * overlap / 2));
    left.y = Math.max(PLAYER_RADIUS, Math.min(PVP_DUEL_HEIGHT - PLAYER_RADIUS, left.y - dy * overlap / 2));
    right.x = Math.max(PLAYER_RADIUS, Math.min(PVP_DUEL_WIDTH - PLAYER_RADIUS, right.x + dx * overlap / 2));
    right.y = Math.max(PLAYER_RADIUS, Math.min(PVP_DUEL_HEIGHT - PLAYER_RADIUS, right.y + dy * overlap / 2));
  }
}

export function advancePvpRealtimeDuel(input: PvpRealtimeState, requestedNowMs: number): PvpRealtimeActionResult {
  const state = structuredClone(input);
  const events: PvpRealtimeEvent[] = [];
  if (state.status !== "active") return { state, events };
  const targetMs = Math.max(state.serverTimeMs, Math.min(requestedNowMs, state.serverTimeMs + MAX_ADVANCE_MS));
  let cursor = state.serverTimeMs;
  while (cursor < targetMs && state.status === "active") {
    const stepEnd = Math.min(targetMs, cursor + SIMULATION_STEP_MS);
    advancePlayers(state, cursor, stepEnd);
    cursor = stepEnd;
    finishIfNeeded(state, cursor, events);
  }
  state.serverTimeMs = targetMs;
  return { state, events };
}

function aimVector(player: PvpRealtimePlayer, opponent: PvpRealtimePlayer) {
  const requested = normalize(player.input.aimX, player.input.aimY);
  if (Math.abs(requested.x) + Math.abs(requested.y) > 0.05) return requested;
  return normalize(opponent.x - player.x, opponent.y - player.y);
}

function canReach(player: PvpRealtimePlayer, opponent: PvpRealtimePlayer, range: number, minimumDot: number) {
  const dx = opponent.x - player.x;
  const dy = opponent.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length > range + PLAYER_RADIUS) return false;
  if (length < 0.001) return true;
  const aim = aimVector(player, opponent);
  return aim.x * (dx / length) + aim.y * (dy / length) >= minimumDot;
}

function damagePlayer(
  state: PvpRealtimeState,
  actor: PvpRealtimePlayer,
  target: PvpRealtimePlayer,
  damage: number,
  atMs: number,
  events: PvpRealtimeEvent[],
  abilityId?: string,
) {
  if (atMs < target.dashingUntilMs) return 0;
  const applied = Math.max(0, Math.min(target.hp, Math.round(damage)));
  if (applied <= 0) return 0;
  target.hp -= applied;
  events.push(appendEvent(
    state,
    atMs,
    actor.id,
    "player_hit",
    `${actor.name} atingiu ${target.name} e causou ${applied} de dano.`,
    { damage: applied, targetIds: [target.id], ...(abilityId ? { abilityId } : {}) },
  ));
  return applied;
}

function performAttack(state: PvpRealtimeState, player: PvpRealtimePlayer, opponent: PvpRealtimePlayer, atMs: number, events: PvpRealtimeEvent[]) {
  if (atMs < player.nextAttackAtMs) throw new PvpRealtimeRuleError("O ataque básico ainda está em recarga.");
  player.nextAttackAtMs = atMs + BASIC_ATTACK_COOLDOWN_MS;
  if (canReach(player, opponent, BASIC_ATTACK_RANGE, 0.45)) {
    damagePlayer(state, player, opponent, BASIC_ATTACK_DAMAGE, atMs, events);
    events.push(appendEvent(state, atMs, player.id, "player_attack", `${player.name} lançou um ataque básico.`, { targetIds: [opponent.id] }));
  } else {
    events.push(appendEvent(state, atMs, player.id, "attack_missed", `${player.name} lançou um ataque, mas errou o alvo.`, { targetIds: [opponent.id] }));
  }
}

function performDash(state: PvpRealtimeState, player: PvpRealtimePlayer, opponent: PvpRealtimePlayer, atMs: number, events: PvpRealtimeEvent[]) {
  if (atMs < player.nextDashAtMs) throw new PvpRealtimeRuleError("O dash ainda está em recarga.");
  const movement = normalize(player.input.moveX, player.input.moveY);
  const aim = aimVector(player, opponent);
  const vector = Math.abs(movement.x) + Math.abs(movement.y) > 0.05 ? movement : { x: -aim.x, y: -aim.y };
  player.dashX = vector.x;
  player.dashY = vector.y;
  player.dashingUntilMs = atMs + DASH_DURATION_MS;
  player.nextDashAtMs = atMs + DASH_COOLDOWN_MS;
  events.push(appendEvent(state, atMs, player.id, "player_dashed", `${player.name} executou um dash.`));
}

function performAbility(state: PvpRealtimeState, player: PvpRealtimePlayer, opponent: PvpRealtimePlayer, slot: 0 | 1, atMs: number, events: PvpRealtimeEvent[]) {
  const abilityId = player.abilityIds[slot];
  const card = ARPG_ABILITY_CARD_BY_ID.get(abilityId);
  if (!card) throw new PvpRealtimeRuleError("O poder equipado não é válido.");
  if (atMs < player.abilityReadyAtMs[slot]) throw new PvpRealtimeRuleError("Este poder ainda está em recarga.");
  player.abilityReadyAtMs[slot] = atMs + card.cooldownMs;

  if (card.behavior === "renewal") {
    const healing = Math.min(card.restoreHp ?? 35, player.maxHp - player.hp);
    if (healing > 0) {
      player.hp += healing;
      events.push(appendEvent(state, atMs, player.id, "player_healed", `${player.name} recuperou ${healing} de vida.`, { healing }));
    }
  } else if (card.behavior === "self-area") {
    if (distance(player, opponent) <= (card.radius ?? 130) + PLAYER_RADIUS) {
      damagePlayer(state, player, opponent, card.damage, atMs, events, abilityId);
    }
  } else {
    const range = card.behavior === "targeted-control" ? 520 : 900;
    const minimumDot = card.behavior === "targeted-control" ? 0.5 : 0.68;
    if (canReach(player, opponent, range, minimumDot)) {
      damagePlayer(state, player, opponent, card.damage, atMs, events, abilityId);
      if (card.behavior === "targeted-control" && atMs >= opponent.dashingUntilMs) {
        opponent.rootedUntilMs = Math.max(opponent.rootedUntilMs, atMs + (card.durationMs ?? 1_200));
        events.push(appendEvent(state, atMs, player.id, "player_rooted", `${opponent.name} foi preso pelo poder de ${player.name}.`, {
          abilityId,
          targetIds: [opponent.id],
        }));
      }
    }
  }

  events.push(appendEvent(state, atMs, player.id, "ability_cast", `${player.name} usou ${card.name}.`, {
    abilityId,
    slot,
    targetIds: card.behavior === "renewal" ? [player.id] : [opponent.id],
  }));
}

export function applyPvpRealtimeAction(
  input: PvpRealtimeState,
  playerId: string,
  action: PvpRealtimeAction,
  nowMs: number,
): PvpRealtimeActionResult {
  if (input.processedActionIds.includes(action.actionId)) return { state: structuredClone(input), events: [] };
  const advanced = advancePvpRealtimeDuel(input, nowMs);
  const state = advanced.state;
  const events = [...advanced.events];
  if (state.status !== "active") throw new PvpRealtimeRuleError("O duelo já terminou.");
  const player = playerFor(state, playerId);
  const opponent = opponentFor(state, playerId);
  const atMs = state.serverTimeMs;

  if (action.kind === "input") {
    const movement = normalize(action.moveX, action.moveY);
    const aim = normalize(action.aimX, action.aimY);
    player.input = { moveX: movement.x, moveY: movement.y, aimX: aim.x, aimY: aim.y };
  } else if (action.kind === "attack") {
    performAttack(state, player, opponent, atMs, events);
  } else if (action.kind === "dash") {
    performDash(state, player, opponent, atMs, events);
  } else if (action.kind === "ability") {
    performAbility(state, player, opponent, action.slot, atMs, events);
  } else {
    finish(state, "concede", opponent.id, atMs, events);
  }

  state.processedActionIds.push(action.actionId);
  state.processedActionIds = state.processedActionIds.slice(-300);
  finishIfNeeded(state, atMs, events);
  return { state, events };
}

export function visiblePvpRealtimeState(state: PvpRealtimeState, playerId: string) {
  const visible = structuredClone(state);
  if (!visible.players.some((player) => player.id === playerId)) {
    throw new PvpRealtimeRuleError("Jogador não participa deste duelo.");
  }
  visible.processedActionIds = [];
  visible.log = visiblePvpRealtimeEvents(visible.log);
  return visible;
}

export function visiblePvpRealtimeEvents(events: readonly PvpRealtimeEvent[]) {
  return events.map((event) => ({
    ...event,
    id: `public-event:${event.sequence}`,
  }));
}
