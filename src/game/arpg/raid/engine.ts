import { CREATURE_BY_ID } from "@/game/catalog";
import { elementMultiplier } from "@/game/domain/elements";
import { AvatarConfigSchema } from "@/game/save/local-progress";
import { ARPG_ABILITY_CARD_BY_ID } from "../content/ability-cards";
import {
  ARPG_ARMORS,
  ARPG_WEAPONS,
  getArmorAbilityCooldownMs,
  getArmorDashCooldownMs,
  getArmorMovingDefenseBonus,
  getArmorRetaliationDamage,
  getWeaponAttackIntervalMs,
  getWeaponAttackProc,
} from "../content/equipment";
import {
  ARPG_RELIC_BY_ID,
  getRelicAbilityCooldownMs,
} from "../content/relics";
import type { ArpgArmorDefinition, ArpgWeaponDefinition } from "../domain/types";
import {
  ARPG_RAID_MAX_PLAYERS,
  ARPG_RAID_MIN_PLAYERS,
  ARPG_RAID_STATE_VERSION,
  type ArpgRaidAction,
  type ArpgRaidActionResult,
  type ArpgRaidBossSetup,
  type ArpgRaidEvent,
  type ArpgRaidEventKind,
  type ArpgRaidPhase,
  type ArpgRaidPlayerSetup,
  type ArpgRaidPlayerState,
  type ArpgRaidState,
} from "./types";

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const PLAYER_BASE_HP = 120;
const PLAYER_BASE_SPEED = 220;
const DASH_SPEED = 610;
const DASH_DURATION_MS = 170;
const DASH_COOLDOWN_MS = 820;
const MAX_ADVANCE_MS = 1_000;
const SIMULATION_STEP_MS = 50;
const BOSS_RADIUS = 58;

const SPAWNS = [
  { x: 360, y: 560 },
  { x: 500, y: 610 },
  { x: 640, y: 630 },
  { x: 780, y: 610 },
  { x: 920, y: 560 },
] as const;

export class ArpgRaidRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArpgRaidRuleError";
  }
}

function clampAxis(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function normalize(x: number, y: number) {
  const safeX = clampAxis(x);
  const safeY = clampAxis(y);
  const length = Math.hypot(safeX, safeY);
  if (length < 0.001) return { x: 0, y: 0 };
  if (length <= 1) return { x: safeX, y: safeY };
  return { x: safeX / length, y: safeY / length };
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

function playerFor(state: ArpgRaidState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new ArpgRaidRuleError("Jogador não participa desta Raid ARPG.");
  return player;
}

function weaponFor(player: ArpgRaidPlayerState): ArpgWeaponDefinition {
  return ARPG_WEAPONS.find((item) => item.id === player.loadout.weaponId) ?? ARPG_WEAPONS[0];
}

function armorFor(player: ArpgRaidPlayerState): ArpgArmorDefinition {
  return ARPG_ARMORS.find((item) => item.id === player.loadout.armorId) ?? ARPG_ARMORS[0];
}

function isMoving(player: ArpgRaidPlayerState) {
  return Math.abs(player.input.moveX) + Math.abs(player.input.moveY) > 0.08;
}

function appendEvent(
  state: ArpgRaidState,
  atMs: number,
  actorId: string,
  kind: ArpgRaidEventKind,
  message: string,
  extra: Partial<Omit<ArpgRaidEvent, "id" | "sequence" | "atMs" | "actorId" | "kind" | "message">> = {},
) {
  state.eventSequence += 1;
  const event: ArpgRaidEvent = {
    id: `arpg-raid:${state.eventSequence}`,
    sequence: state.eventSequence,
    atMs,
    actorId,
    kind,
    message,
    ...extra,
  };
  state.log.push(event);
  state.log = state.log.slice(-240);
  return event;
}

function validateLoadout(setup: ArpgRaidPlayerSetup) {
  const { loadout } = setup;
  if (!ARPG_WEAPONS.some((item) => item.id === loadout.weaponId)) {
    throw new ArpgRaidRuleError(`${setup.name} possui uma arma ARPG inválida.`);
  }
  if (!ARPG_ARMORS.some((item) => item.id === loadout.armorId)) {
    throw new ArpgRaidRuleError(`${setup.name} possui uma armadura ARPG inválida.`);
  }
  if (!ARPG_RELIC_BY_ID.has(loadout.relicId)) {
    throw new ArpgRaidRuleError(`${setup.name} possui uma relíquia ARPG inválida.`);
  }
  if (loadout.abilityIds.length !== 2
    || new Set(loadout.abilityIds).size !== 2
    || loadout.abilityIds.some((id) => !ARPG_ABILITY_CARD_BY_ID.has(id))) {
    throw new ArpgRaidRuleError(`${setup.name} precisa levar exatamente dois ataques diferentes.`);
  }
}

function phaseForBoss(state: ArpgRaidState): ArpgRaidPhase {
  const ratio = state.boss.hp / Math.max(1, state.boss.maxHp);
  if (ratio <= 0.34) return 3;
  if (ratio <= 0.67) return 2;
  return 1;
}

function refreshBossPhase(state: ArpgRaidState, atMs: number, events: ArpgRaidEvent[]) {
  const next = phaseForBoss(state);
  if (next <= state.boss.phase) return;
  state.boss.phase = next;
  events.push(appendEvent(
    state,
    atMs,
    "raid-boss",
    "boss_phase",
    next === 2 ? "FASE 2: o céu escurece sobre a arena." : "FASE 3: o Roc convoca a Tempestade do Horizonte.",
    { phase: next },
  ));
}

function finishIfNeeded(state: ArpgRaidState, atMs: number, events: ArpgRaidEvent[]) {
  if (state.status !== "active") return;
  if (state.boss.hp <= 0) {
    state.boss.hp = 0;
    state.status = "victory";
    events.push(appendEvent(state, atMs, "system", "raid_victory", `${state.boss.name} foi derrotado. RAID ARPG CONCLUÍDA!`));
    return;
  }
  if (!state.players.some((player) => player.alive)) {
    state.status = "defeat";
    events.push(appendEvent(state, atMs, "raid-boss", "raid_defeat", `${state.boss.name} derrotou todo o grupo.`));
    return;
  }
  if (atMs - state.startedAtMs >= state.maxDurationMs) {
    state.status = "defeat";
    events.push(appendEvent(state, atMs, "system", "raid_defeat", "O tempo limite da Raid ARPG foi atingido."));
  }
}

function applyPlayerDamage(
  state: ArpgRaidState,
  player: ArpgRaidPlayerState,
  rawDamage: number,
  atMs: number,
  events: ArpgRaidEvent[],
) {
  if (!player.alive || atMs < player.dashingUntilMs) return;
  const armor = armorFor(player);
  const movingReduction = getArmorMovingDefenseBonus(armor, isMoving(player));
  const damage = Math.max(1, Math.round(rawDamage - armor.defenseBonus - movingReduction));
  player.hp = Math.max(0, player.hp - damage);
  player.contribution.damageTaken += damage;
  events.push(appendEvent(
    state,
    atMs,
    "raid-boss",
    "player_damaged",
    `${player.name} recebeu ${damage} de dano.`,
    { damage, targetIds: [player.id] },
  ));

  const retaliationDamage = getArmorRetaliationDamage(armor);
  if (retaliationDamage > 0 && distance(player.x, player.y, state.boss.x, state.boss.y) <= 125) {
    const applied = Math.min(retaliationDamage, state.boss.hp);
    state.boss.hp = Math.max(0, state.boss.hp - applied);
    player.contribution.damage += applied;
  }

  if (player.hp <= 0) {
    player.alive = false;
    events.push(appendEvent(
      state,
      atMs,
      player.id,
      "player_defeated",
      `${player.name} foi derrubado e agora observa a luta.`,
      { targetIds: [player.id] },
    ));
  }
}

function closestAlivePlayer(state: ArpgRaidState) {
  return state.players
    .filter((player) => player.alive)
    .sort((left, right) => (
      distance(left.x, left.y, state.boss.x, state.boss.y)
      - distance(right.x, right.y, state.boss.x, state.boss.y)
    ))[0] ?? null;
}

function bossAttack(state: ArpgRaidState, atMs: number, events: ArpgRaidEvent[]) {
  const alive = state.players.filter((player) => player.alive);
  if (!alive.length) return;
  const phase = state.boss.phase;
  if (phase === 1) {
    const target = closestAlivePlayer(state)!;
    applyPlayerDamage(state, target, 24, atMs, events);
    events.push(appendEvent(
      state,
      atMs,
      "raid-boss",
      "boss_attack",
      `${state.boss.name} mergulhou sobre ${target.name}.`,
      { targetIds: [target.id] },
    ));
    state.boss.nextAttackAtMs = atMs + 1_650;
    return;
  }

  const damage = phase === 2 ? 17 : 22;
  for (const player of alive) applyPlayerDamage(state, player, damage, atMs, events);
  events.push(appendEvent(
    state,
    atMs,
    "raid-boss",
    "boss_attack",
    phase === 2 ? `${state.boss.name} cobriu a arena com a Sombra do Sol.` : `${state.boss.name} desencadeou a Tempestade do Horizonte.`,
    { targetIds: alive.map((player) => player.id) },
  ));
  state.boss.nextAttackAtMs = atMs + (phase === 2 ? 1_400 : 1_100);
}

function advancePlayers(state: ArpgRaidState, fromMs: number, toMs: number) {
  const dtSeconds = (toMs - fromMs) / 1_000;
  for (const player of state.players) {
    if (!player.alive) continue;
    const armor = armorFor(player);
    let remaining = dtSeconds;
    let cursorMs = fromMs;

    if (player.dashingUntilMs > cursorMs) {
      const dashEnd = Math.min(toMs, player.dashingUntilMs);
      const dashSeconds = Math.max(0, dashEnd - cursorMs) / 1_000;
      player.x += player.dashX * DASH_SPEED * dashSeconds;
      player.y += player.dashY * DASH_SPEED * dashSeconds;
      remaining -= dashSeconds;
      cursorMs = dashEnd;
    }

    if (remaining > 0) {
      const movement = normalize(player.input.moveX, player.input.moveY);
      const speed = PLAYER_BASE_SPEED + armor.moveSpeedBonus;
      player.x += movement.x * speed * remaining;
      player.y += movement.y * speed * remaining;
    }

    player.x = Math.max(45, Math.min(WORLD_WIDTH - 45, player.x));
    player.y = Math.max(55, Math.min(WORLD_HEIGHT - 45, player.y));
  }
}

function advanceBoss(state: ArpgRaidState, fromMs: number, toMs: number) {
  const target = closestAlivePlayer(state);
  if (!target) return;
  const dx = target.x - state.boss.x;
  const dy = target.y - state.boss.y;
  const length = Math.hypot(dx, dy);
  if (length <= 145) return;
  const slowed = fromMs < state.boss.slowedUntilMs;
  const phaseSpeed = state.boss.speed + (state.boss.phase - 1) * 16;
  const speed = slowed ? phaseSpeed * 0.55 : phaseSpeed;
  const travel = Math.min(length - 145, speed * ((toMs - fromMs) / 1_000));
  state.boss.x += (dx / length) * travel;
  state.boss.y += (dy / length) * travel;
  state.boss.x = Math.max(70, Math.min(WORLD_WIDTH - 70, state.boss.x));
  state.boss.y = Math.max(70, Math.min(WORLD_HEIGHT - 70, state.boss.y));
}

export function createArpgRaidState(
  roomId: string,
  eventId: string,
  setups: readonly ArpgRaidPlayerSetup[],
  bossSetup: ArpgRaidBossSetup,
  nowMs: number,
): ArpgRaidState {
  if (setups.length < ARPG_RAID_MIN_PLAYERS || setups.length > ARPG_RAID_MAX_PLAYERS) {
    throw new ArpgRaidRuleError("Uma Raid ARPG precisa de 2 a 5 jogadores.");
  }
  if (new Set(setups.map((player) => player.id)).size !== setups.length) {
    throw new ArpgRaidRuleError("Cada participante da Raid ARPG precisa ser único.");
  }
  if (new Set(setups.map((player) => player.seat)).size !== setups.length
    || setups.some((player) => player.seat < 1 || player.seat > ARPG_RAID_MAX_PLAYERS)) {
    throw new ArpgRaidRuleError("Os assentos da Raid ARPG são inválidos.");
  }

  const bossDefinition = CREATURE_BY_ID.get(bossSetup.catalogId);
  if (!bossDefinition || bossDefinition.rarity !== "mythic") {
    throw new ArpgRaidRuleError("A Raid ARPG exige um boss de raridade Mítica.");
  }

  const players = setups
    .slice()
    .sort((left, right) => left.seat - right.seat)
    .map((setup): ArpgRaidPlayerState => {
      validateLoadout(setup);
      const avatar = AvatarConfigSchema.safeParse(setup.avatarConfig);
      if (!avatar.success) {
        throw new ArpgRaidRuleError(`${setup.name} possui uma configuração de avatar ARPG inválida.`);
      }
      const armor = ARPG_ARMORS.find((item) => item.id === setup.loadout.armorId)!;
      const spawn = SPAWNS[setup.seat - 1];
      return {
        id: setup.id,
        name: setup.name,
        seat: setup.seat,
        avatarConfig: { ...avatar.data },
        x: spawn.x,
        y: spawn.y,
        hp: PLAYER_BASE_HP + armor.maxHpBonus,
        maxHp: PLAYER_BASE_HP + armor.maxHpBonus,
        alive: true,
        loadout: structuredClone(setup.loadout),
        input: { moveX: 0, moveY: 0, aimX: 0, aimY: -1 },
        nextAttackAtMs: nowMs,
        nextDashAtMs: nowMs,
        dashingUntilMs: nowMs,
        dashX: 0,
        dashY: -1,
        abilityReadyAtMs: Object.fromEntries(setup.loadout.abilityIds.map((id) => [id, nowMs])),
        basicAttackCounter: 0,
        contribution: { actions: 0, damage: 0, healing: 0, damageTaken: 0 },
      };
    });

  const state: ArpgRaidState = {
    version: ARPG_RAID_STATE_VERSION,
    roomId,
    eventId,
    status: "active",
    startedAtMs: nowMs,
    serverTimeMs: nowMs,
    maxDurationMs: bossSetup.maxDurationMs ?? 5 * 60_000,
    players,
    boss: {
      catalogId: bossSetup.catalogId,
      name: bossDefinition.name,
      element: bossDefinition.element,
      x: WORLD_WIDTH / 2,
      y: 170,
      hp: bossSetup.maxHp,
      maxHp: bossSetup.maxHp,
      phase: 1,
      speed: bossSetup.speed,
      nextAttackAtMs: nowMs + 1_500,
      slowedUntilMs: nowMs,
    },
    processedActionIds: [],
    eventSequence: 0,
    log: [],
  };
  appendEvent(state, nowMs, "system", "raid_started", `Raid ARPG contra ${bossDefinition.name} iniciada com ${players.length} Cartógrafos.`);
  return state;
}

export function advanceArpgRaid(input: ArpgRaidState, requestedNowMs: number): ArpgRaidActionResult {
  const state = structuredClone(input);
  const events: ArpgRaidEvent[] = [];
  if (state.status !== "active") return { state, events };
  const targetMs = Math.max(state.serverTimeMs, Math.min(requestedNowMs, state.serverTimeMs + MAX_ADVANCE_MS));
  let cursor = state.serverTimeMs;

  while (cursor < targetMs && state.status === "active") {
    const stepEnd = Math.min(targetMs, cursor + SIMULATION_STEP_MS);
    advancePlayers(state, cursor, stepEnd);
    advanceBoss(state, cursor, stepEnd);
    if (stepEnd >= state.boss.nextAttackAtMs) bossAttack(state, stepEnd, events);
    cursor = stepEnd;
    refreshBossPhase(state, cursor, events);
    finishIfNeeded(state, cursor, events);
  }

  state.serverTimeMs = targetMs;
  return { state, events };
}

function aimTowardBoss(player: ArpgRaidPlayerState, state: ArpgRaidState) {
  const requested = normalize(player.input.aimX, player.input.aimY);
  if (Math.abs(requested.x) + Math.abs(requested.y) > 0.05) return requested;
  return normalize(state.boss.x - player.x, state.boss.y - player.y);
}

function bossInsideAim(player: ArpgRaidPlayerState, state: ArpgRaidState, maxRange: number, minDot = 0.55) {
  const dx = state.boss.x - player.x;
  const dy = state.boss.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length > maxRange + BOSS_RADIUS) return false;
  if (length < 0.001) return true;
  const aim = aimTowardBoss(player, state);
  const dot = aim.x * (dx / length) + aim.y * (dy / length);
  return dot >= minDot;
}

function damageBoss(
  state: ArpgRaidState,
  player: ArpgRaidPlayerState,
  damage: number,
  atMs: number,
  events: ArpgRaidEvent[],
  message: string,
) {
  const applied = Math.max(0, Math.min(state.boss.hp, Math.round(damage)));
  if (applied <= 0) return 0;
  state.boss.hp -= applied;
  player.contribution.damage += applied;
  events.push(appendEvent(state, atMs, player.id, "player_attack", message, {
    damage: applied,
    targetIds: ["raid-boss"],
  }));
  refreshBossPhase(state, atMs, events);
  finishIfNeeded(state, atMs, events);
  return applied;
}

function healPlayer(
  state: ArpgRaidState,
  source: ArpgRaidPlayerState,
  target: ArpgRaidPlayerState,
  amount: number,
  atMs: number,
  events: ArpgRaidEvent[],
) {
  if (!target.alive) return 0;
  const healed = Math.max(0, Math.min(amount, target.maxHp - target.hp));
  if (healed <= 0) return 0;
  target.hp += healed;
  source.contribution.healing += healed;
  events.push(appendEvent(state, atMs, source.id, "player_healed", `${target.name} recuperou ${healed} HP.`, {
    healing: healed,
    targetIds: [target.id],
  }));
  return healed;
}

function performAttack(state: ArpgRaidState, player: ArpgRaidPlayerState, atMs: number, events: ArpgRaidEvent[]) {
  if (atMs < player.nextAttackAtMs) throw new ArpgRaidRuleError("O ataque básico ainda está em recarga.");
  const weapon = weaponFor(player);
  if (!bossInsideAim(player, state, weapon.range, weapon.kind === "sword" ? 0.15 : 0.5)) {
    throw new ArpgRaidRuleError("O boss está fora do alcance ou da direção do ataque.");
  }
  player.basicAttackCounter += 1;
  const proc = getWeaponAttackProc(weapon, player.basicAttackCounter);
  player.nextAttackAtMs = atMs + getWeaponAttackIntervalMs(weapon, isMoving(player));
  player.contribution.actions += 1;
  const bossDefinition = CREATURE_BY_ID.get(state.boss.catalogId)!;
  let damage = Math.round(weapon.damage * elementMultiplier(weapon.element, bossDefinition.element));
  if (proc.cleaveMultiplier > 0) {
    damage += Math.max(1, Math.round(weapon.damage * proc.cleaveMultiplier));
  }
  if (proc.echoMultiplier > 0) {
    damage += Math.max(1, Math.round(weapon.damage * proc.echoMultiplier));
  }
  damageBoss(state, player, damage, atMs, events, `${player.name} atingiu ${state.boss.name} com ${weapon.name}.`);
  if (proc.restoreHp > 0) {
    healPlayer(state, player, player, proc.restoreHp, atMs, events);
  }
}

function performDash(state: ArpgRaidState, player: ArpgRaidPlayerState, atMs: number, events: ArpgRaidEvent[]) {
  if (atMs < player.nextDashAtMs) throw new ArpgRaidRuleError("O dash ainda está em recarga.");
  const armor = armorFor(player);
  const movement = normalize(player.input.moveX, player.input.moveY);
  const aim = aimTowardBoss(player, state);
  const vector = Math.abs(movement.x) + Math.abs(movement.y) > 0.05 ? movement : aim;
  player.dashX = vector.x;
  player.dashY = vector.y;
  player.dashingUntilMs = atMs + DASH_DURATION_MS;
  player.nextDashAtMs = atMs + getArmorDashCooldownMs(armor, DASH_COOLDOWN_MS);
  player.contribution.actions += 1;
  events.push(appendEvent(state, atMs, player.id, "player_dash", `${player.name} executou um dash.`));
}

function castAbility(
  state: ArpgRaidState,
  player: ArpgRaidPlayerState,
  slot: 0 | 1,
  atMs: number,
  events: ArpgRaidEvent[],
) {
  const cardId = player.loadout.abilityIds[slot];
  const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
  if (!card) throw new ArpgRaidRuleError("O ataque equipado não é válido.");
  const readyAt = player.abilityReadyAtMs[cardId] ?? 0;
  if (atMs < readyAt) throw new ArpgRaidRuleError("Esta carta-habilidade ainda está em recarga.");
  const armor = armorFor(player);
  const relic = ARPG_RELIC_BY_ID.get(player.loadout.relicId)!;
  player.abilityReadyAtMs[cardId] = atMs + getRelicAbilityCooldownMs(
    relic,
    getArmorAbilityCooldownMs(armor, card.cooldownMs),
  );
  player.contribution.actions += 1;

  if (card.behavior === "renewal") {
    healPlayer(state, player, player, card.restoreHp ?? 40, atMs, events);
  } else if (card.behavior === "self-area") {
    if (distance(player.x, player.y, state.boss.x, state.boss.y) <= (card.radius ?? 150) + BOSS_RADIUS) {
      damageBoss(state, player, card.damage, atMs, events, `${player.name} ativou ${card.name} contra ${state.boss.name}.`);
    }
  } else if (card.behavior === "targeted-control") {
    if (!bossInsideAim(player, state, 430, 0.25)) throw new ArpgRaidRuleError("O boss está fora da área da habilidade.");
    damageBoss(state, player, card.damage, atMs, events, `${player.name} controlou a arena com ${card.name}.`);
    state.boss.slowedUntilMs = Math.max(state.boss.slowedUntilMs, atMs + (card.durationMs ?? 1_400));
  } else {
    if (!bossInsideAim(player, state, 900, 0.4)) throw new ArpgRaidRuleError("O boss está fora da direção da habilidade.");
    damageBoss(state, player, card.damage, atMs, events, `${player.name} lançou ${card.name} em ${state.boss.name}.`);
  }
  events.push(appendEvent(state, atMs, player.id, "ability_cast", `${player.name} usou ${card.name}.`));
}

export function applyArpgRaidAction(
  input: ArpgRaidState,
  playerId: string,
  action: ArpgRaidAction,
  nowMs: number,
): ArpgRaidActionResult {
  if (input.processedActionIds.includes(action.actionId)) {
    return { state: structuredClone(input), events: [] };
  }
  const advanced = advanceArpgRaid(input, nowMs);
  const state = advanced.state;
  const events = [...advanced.events];
  if (state.status !== "active") throw new ArpgRaidRuleError("A Raid ARPG já terminou.");
  const player = playerFor(state, playerId);
  if (!player.alive) throw new ArpgRaidRuleError("Jogadores derrotados permanecem como espectadores.");
  const atMs = state.serverTimeMs;

  if (action.kind === "input") {
    const movement = normalize(action.moveX, action.moveY);
    const aim = normalize(action.aimX, action.aimY);
    player.input = { moveX: movement.x, moveY: movement.y, aimX: aim.x, aimY: aim.y };
  } else if (action.kind === "attack") {
    performAttack(state, player, atMs, events);
  } else if (action.kind === "dash") {
    performDash(state, player, atMs, events);
  } else {
    castAbility(state, player, action.slot, atMs, events);
  }

  state.processedActionIds.push(action.actionId);
  state.processedActionIds = state.processedActionIds.slice(-300);
  finishIfNeeded(state, atMs, events);
  return { state, events };
}

export function eligibleArpgRaidRewardPlayerIds(state: ArpgRaidState) {
  if (state.status !== "victory") return [];
  return state.players
    .filter((player) => player.contribution.actions > 0 && player.contribution.damage + player.contribution.healing > 0)
    .map((player) => player.id);
}
