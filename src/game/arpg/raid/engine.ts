import { CREATURE_BY_ID } from "@/game/catalog";
import { ARPG_BASE_HP as PLAYER_BASE_HP, ARPG_BASE_SPEED as PLAYER_BASE_SPEED, ARPG_DASH_SPEED as DASH_SPEED, ARPG_DASH_DURATION_MS as DASH_DURATION_MS, ARPG_DASH_COOLDOWN_MS as DASH_COOLDOWN_MS } from "../domain/combat-config";
import { elementMultiplier } from "@/game/domain/elements";
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
  ARPG_SHARED_DUNGEON_MIN_DURATION_MS,
  activeArpgRaidDungeonRoom,
  activeArpgRaidDungeonWorld,
  entryPositionsForRoom,
  spawnArpgRaidDungeonWave,
} from "../coop-dungeon/shared-run";
import {
  ARPG_RAID_INPUT_STALE_MS,
  ARPG_RAID_MAX_PLAYERS,
  ARPG_RAID_MIN_PLAYERS,
  ARPG_RAID_PLAYER_MARGIN,
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
const MAX_ADVANCE_MS = 1_000;
const SIMULATION_STEP_MS = 50;
const BOSS_RADIUS = 58;
const DOWNED_DURATION_MS = 20_000;
const REVIVE_RANGE = 108;
const REVIVE_HP_RATIO = 0.35;
const STARTING_REVIVE_CHARGES = 2;
const DUNGEON_ENEMY_RADIUS = 24;
const CORRIDOR_LANE_HALF_WIDTH = 48;

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
  const currentDungeonRoom = activeArpgRaidDungeonRoom(state);
  const bossEncounter = !state.dungeon || currentDungeonRoom?.type === "boss";
  if (bossEncounter && state.boss.hp <= 0) {
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
  sourceId = "raid-boss",
  allowBossRetaliation = true,
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
    sourceId,
    "player_damaged",
    `${player.name} recebeu ${damage} de dano.`,
    { damage, targetIds: [player.id] },
  ));

  const retaliationDamage = allowBossRetaliation ? getArmorRetaliationDamage(armor) : 0;
  if (retaliationDamage > 0 && distance(player.x, player.y, state.boss.x, state.boss.y) <= 125) {
    const applied = Math.min(retaliationDamage, state.boss.hp);
    state.boss.hp = Math.max(0, state.boss.hp - applied);
    player.contribution.damage += applied;
  }

  if (player.hp <= 0) {
    player.alive = false;
    player.downedUntilMs = atMs + DOWNED_DURATION_MS;
    events.push(appendEvent(
      state,
      atMs,
      player.id,
      "player_defeated",
      `${player.name} foi derrubado. Um aliado pode reerguê-lo por 20 segundos.`,
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
  const world = activeArpgRaidDungeonWorld(state);
  const room = activeArpgRaidDungeonRoom(state);
  const roomWidth = room?.roomWidth ?? world.width;
  const corridorOpen = Boolean(room && room.type !== "boss" && room.state === "awaiting_exit" && room.corridorWidth > 0);
  for (const player of state.players) {
    if (!player.alive) continue;
    if (toMs - player.lastInputAtMs > ARPG_RAID_INPUT_STALE_MS
      && (Math.abs(player.input.moveX) > 0.001 || Math.abs(player.input.moveY) > 0.001)) {
      player.input = { ...player.input, moveX: 0, moveY: 0 };
    }
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

    player.x = Math.max(ARPG_RAID_PLAYER_MARGIN, Math.min(world.width - ARPG_RAID_PLAYER_MARGIN, player.x));
    player.y = Math.max(55, Math.min(world.height - 45, player.y));

    // The corridor is a real movement lane. Until the room is clear, its east wall
    // stays closed; after it opens, players must line up with the doorway to enter.
    if (!corridorOpen) {
      player.x = Math.min(player.x, roomWidth - ARPG_RAID_PLAYER_MARGIN);
    } else if (player.x > roomWidth - ARPG_RAID_PLAYER_MARGIN) {
      const centerY = world.height / 2;
      const corridorTop = centerY - CORRIDOR_LANE_HALF_WIDTH + 8;
      const corridorBottom = centerY + CORRIDOR_LANE_HALF_WIDTH - 8;
      if (player.y < corridorTop || player.y > corridorBottom) {
        player.x = Math.min(player.x, roomWidth - ARPG_RAID_PLAYER_MARGIN);
      } else {
        player.y = Math.max(corridorTop, Math.min(corridorBottom, player.y));
      }
    }
  }
}

function advanceBoss(state: ArpgRaidState, fromMs: number, toMs: number) {
  const room = activeArpgRaidDungeonRoom(state);
  if (state.dungeon && room?.type !== "boss") return;
  const world = activeArpgRaidDungeonWorld(state);
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
  state.boss.x = Math.max(70, Math.min(world.width - 70, state.boss.x));
  state.boss.y = Math.max(70, Math.min(world.height - 70, state.boss.y));
}

function nearestLivingDungeonEnemy(state: ArpgRaidState, player: ArpgRaidPlayerState) {
  const room = activeArpgRaidDungeonRoom(state);
  if (!room || room.type === "boss") return null;
  return room.enemies
    .filter((enemy) => enemy.alive && enemy.waveIndex === room.waveIndex)
    .sort((left, right) => (
      distance(player.x, player.y, left.x, left.y) - distance(player.x, player.y, right.x, right.y)
    ))[0] ?? null;
}

function advanceDungeonEnemies(state: ArpgRaidState, fromMs: number, toMs: number, events: ArpgRaidEvent[]) {
  const room = activeArpgRaidDungeonRoom(state);
  if (!state.dungeon || !room || room.type === "boss" || room.state !== "combat") return;
  const dtSeconds = (toMs - fromMs) / 1_000;
  const targets = state.players.filter((player) => player.alive);
  for (const enemy of room.enemies) {
    if (!enemy.alive || enemy.waveIndex !== room.waveIndex || targets.length === 0) continue;
    const target = targets.slice().sort((left, right) => (
      distance(enemy.x, enemy.y, left.x, left.y) - distance(enemy.x, enemy.y, right.x, right.y)
    ))[0];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const length = Math.hypot(dx, dy);
    if (length > 48) {
      const slowed = fromMs < enemy.slowedUntilMs;
      const travel = Math.min(length - 42, enemy.moveSpeed * (slowed ? 0.55 : 1) * dtSeconds);
      enemy.x += (dx / length) * travel;
      enemy.y += (dy / length) * travel;
    }
    enemy.x = Math.max(42, Math.min(room.roomWidth - 42, enemy.x));
    enemy.y = Math.max(48, Math.min(room.worldHeight - 42, enemy.y));
    if (length <= 58 && toMs >= enemy.nextAttackAtMs && target.alive) {
      applyPlayerDamage(state, target, enemy.contactDamage, toMs, events, enemy.id, false);
      events.push(appendEvent(
        state,
        toMs,
        enemy.id,
        "dungeon_enemy_attack",
        `${enemy.name} atacou ${target.name}.`,
        { targetIds: [target.id] },
      ));
      enemy.nextAttackAtMs = toMs + 1_350;
    }
  }
}

function enterNextDungeonRoom(state: ArpgRaidState, atMs: number, events: ArpgRaidEvent[]) {
  const dungeon = state.dungeon;
  const previous = activeArpgRaidDungeonRoom(state);
  if (!dungeon || !previous || previous.state !== "awaiting_exit" || previous.corridorWidth <= 0) return;
  const party = state.players.filter((player) => player.alive);
  if (party.length === 0) return;
  const corridorExitX = previous.roomWidth + previous.corridorWidth - ARPG_RAID_PLAYER_MARGIN;
  if (party.some((player) => player.x < corridorExitX)) return;

  previous.state = "cleared";
  events.push(appendEvent(state, atMs, "system", "dungeon_room_cleared", `${previous.label} concluída; o grupo atravessou o corredor.`, { targetIds: [previous.id] }));
  if (dungeon.roomIndex >= dungeon.rooms.length - 1) return;
  dungeon.roomIndex += 1;
  const next = activeArpgRaidDungeonRoom(state)!;
  const spawns = entryPositionsForRoom(next, state.players, dungeon.seed);
  for (const player of state.players) {
    const spawn = spawns[player.seat - 1] ?? { x: next.worldWidth / 2, y: next.worldHeight / 2 };
    player.x = spawn.x;
    player.y = spawn.y;
    player.input = { ...player.input, moveX: 0, moveY: 0 };
  }
  state.boss.x = next.roomWidth / 2;
  state.boss.y = next.worldHeight / 2 - 110;
  state.boss.nextAttackAtMs = atMs + 1_500;
  if (next.type === "boss") {
    events.push(appendEvent(state, atMs, "system", "dungeon_room_entered", `${next.label}: ${state.boss.name} surgiu no caminho.`, { targetIds: [next.id] }));
  } else {
    spawnArpgRaidDungeonWave(dungeon, next, 0, state.players.length, atMs);
    const entryMessage = next.state === "awaiting_exit"
      ? `${next.label}: passagem aberta; atravesse o corredor.`
      : `${next.label} iniciada.`;
    events.push(appendEvent(state, atMs, "system", "dungeon_room_entered", entryMessage, { targetIds: [next.id] }));
  }
}

function advanceDungeonProgress(state: ArpgRaidState, atMs: number, events: ArpgRaidEvent[]) {
  const room = activeArpgRaidDungeonRoom(state);
  if (!state.dungeon || !room || room.type === "boss") return;
  if (room.state === "awaiting_exit") {
    enterNextDungeonRoom(state, atMs, events);
    return;
  }
  if (room.state !== "combat" || room.enemies.some((enemy) => enemy.alive && enemy.waveIndex === room.waveIndex)) return;

  events.push(appendEvent(state, atMs, "system", "dungeon_wave_cleared", `O grupo venceu a onda ${room.waveIndex + 1}.`, { targetIds: [room.id] }));
  const nextWave = room.waveIndex + 1;
  if (nextWave < room.waves.length) {
    spawnArpgRaidDungeonWave(state.dungeon, room, nextWave, state.players.length, atMs);
    return;
  }
  room.state = "awaiting_exit";
  room.waveCompleteAtMs = atMs;
  room.nextRoomAtMs = null;
}

export function createArpgRaidState(
  roomId: string,
  eventId: string,
  setups: readonly ArpgRaidPlayerSetup[],
  bossSetup: ArpgRaidBossSetup,
  nowMs: number,
): ArpgRaidState {
  if (setups.length < ARPG_RAID_MIN_PLAYERS || setups.length > ARPG_RAID_MAX_PLAYERS) {
    throw new ArpgRaidRuleError("Uma expedição cooperativa precisa de 2 a 4 jogadores.");
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
      const armor = ARPG_ARMORS.find((item) => item.id === setup.loadout.armorId)!;
      const spawn = SPAWNS[setup.seat - 1];
      return {
        id: setup.id,
        name: setup.name,
        seat: setup.seat,
        x: spawn.x,
        y: spawn.y,
        hp: PLAYER_BASE_HP + armor.maxHpBonus,
        maxHp: PLAYER_BASE_HP + armor.maxHpBonus,
        alive: true,
        downedUntilMs: 0,
        loadout: structuredClone(setup.loadout),
        input: { moveX: 0, moveY: 0, aimX: 0, aimY: -1 },
        lastInputAtMs: nowMs,
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
    reviveCharges: STARTING_REVIVE_CHARGES,
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
  // Upgrade historical co-op snapshots that inherited the old boss-only timer.
  if (state.dungeon) state.maxDurationMs = Math.max(state.maxDurationMs, ARPG_SHARED_DUNGEON_MIN_DURATION_MS);
  for (const player of state.players) {
    player.maxHp = PLAYER_BASE_HP;
    player.hp = Math.min(player.hp, PLAYER_BASE_HP);
  }
  const events: ArpgRaidEvent[] = [];
  if (state.status !== "active") return { state, events };
  const targetMs = Math.max(state.serverTimeMs, Math.min(requestedNowMs, state.serverTimeMs + MAX_ADVANCE_MS));
  let cursor = state.serverTimeMs;

  while (cursor < targetMs && state.status === "active") {
    const stepEnd = Math.min(targetMs, cursor + SIMULATION_STEP_MS);
    for (const player of state.players) {
      if (!player.alive && player.downedUntilMs > 0 && stepEnd >= player.downedUntilMs) {
        player.downedUntilMs = 0;
        events.push(appendEvent(
          state,
          stepEnd,
          "system",
          "player_eliminated",
          `${player.name} não foi reerguido a tempo.`,
          { targetIds: [player.id] },
        ));
      }
    }
    advancePlayers(state, cursor, stepEnd);
    const room = activeArpgRaidDungeonRoom(state);
    if (!state.dungeon || room?.type === "boss") {
      advanceBoss(state, cursor, stepEnd);
      if (stepEnd >= state.boss.nextAttackAtMs) bossAttack(state, stepEnd, events);
    } else {
      advanceDungeonEnemies(state, cursor, stepEnd, events);
      advanceDungeonProgress(state, stepEnd, events);
    }
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
  const enemy = nearestLivingDungeonEnemy(state, player);
  if (enemy) return normalize(enemy.x - player.x, enemy.y - player.y);
  return normalize(state.boss.x - player.x, state.boss.y - player.y);
}

function dungeonEnemyInsideAim(
  player: ArpgRaidPlayerState,
  enemy: NonNullable<ReturnType<typeof nearestLivingDungeonEnemy>>,
  state: ArpgRaidState,
  maxRange: number,
  minDot = 0.4,
) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length > maxRange + DUNGEON_ENEMY_RADIUS) return false;
  if (length < 0.001) return true;
  const aim = aimTowardBoss(player, state);
  return aim.x * (dx / length) + aim.y * (dy / length) >= minDot;
}

function damageDungeonEnemy(
  state: ArpgRaidState,
  player: ArpgRaidPlayerState,
  enemy: NonNullable<ReturnType<typeof nearestLivingDungeonEnemy>>,
  rawDamage: number,
  atMs: number,
  events: ArpgRaidEvent[],
  message: string,
  slowForMs = 0,
) {
  if (!enemy.alive) return 0;
  const applied = Math.max(0, Math.min(enemy.hp, Math.round(rawDamage)));
  if (applied <= 0) return 0;
  enemy.hp -= applied;
  player.contribution.damage += applied;
  if (slowForMs > 0) enemy.slowedUntilMs = Math.max(enemy.slowedUntilMs, atMs + slowForMs);
  events.push(appendEvent(state, atMs, player.id, "player_attack", message, {
    damage: applied,
    targetIds: [enemy.id],
  }));
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
    events.push(appendEvent(state, atMs, player.id, "dungeon_enemy_defeated", `${enemy.name} foi derrotado.`, {
      targetIds: [enemy.id],
    }));
  }
  return applied;
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
  const room = activeArpgRaidDungeonRoom(state);
  if (state.dungeon && room && room.type !== "boss") {
    const candidates = room.enemies
      .filter((candidate) => candidate.alive && candidate.waveIndex === room.waveIndex)
      .sort((left, right) => distance(player.x, player.y, left.x, left.y) - distance(player.x, player.y, right.x, right.y));
    const enemy = candidates.find((candidate) => (
      dungeonEnemyInsideAim(player, candidate, state, weapon.range, weapon.kind === "sword" ? 0.15 : 0.35)
    )) ?? candidates.find((candidate) => distance(player.x, player.y, candidate.x, candidate.y) <= weapon.range + DUNGEON_ENEMY_RADIUS);
    if (!enemy) throw new ArpgRaidRuleError("Nenhum inimigo está no alcance ou na direção do ataque.");
    player.basicAttackCounter += 1;
    const proc = getWeaponAttackProc(weapon, player.basicAttackCounter);
    player.nextAttackAtMs = atMs + getWeaponAttackIntervalMs(weapon, isMoving(player));
    player.contribution.actions += 1;
    let damage = weapon.damage;
    if (proc.cleaveMultiplier > 0) damage += Math.max(1, Math.round(weapon.damage * proc.cleaveMultiplier));
    if (proc.echoMultiplier > 0) damage += Math.max(1, Math.round(weapon.damage * proc.echoMultiplier));
    damageDungeonEnemy(state, player, enemy, damage, atMs, events, `${player.name} atingiu ${enemy.name} com ${weapon.name}.`);
    if (proc.restoreHp > 0) healPlayer(state, player, player, proc.restoreHp, atMs, events);
    return;
  }
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

  const room = activeArpgRaidDungeonRoom(state);
  if (state.dungeon && room && room.type !== "boss") {
    const livingEnemies = room.enemies.filter((enemy) => enemy.alive && enemy.waveIndex === room.waveIndex);
    if (card.behavior === "renewal") {
      healPlayer(state, player, player, card.restoreHp ?? 40, atMs, events);
    } else if (card.behavior === "self-area") {
      for (const enemy of livingEnemies) {
        if (distance(player.x, player.y, enemy.x, enemy.y) <= (card.radius ?? 150) + DUNGEON_ENEMY_RADIUS) {
          damageDungeonEnemy(state, player, enemy, card.damage, atMs, events, `${player.name} atingiu ${enemy.name} com ${card.name}.`);
        }
      }
    } else {
      const range = card.behavior === "targeted-control" ? 430 : 900;
      const minDot = card.behavior === "targeted-control" ? 0.25 : 0.4;
      const target = livingEnemies
        .slice()
        .sort((left, right) => distance(player.x, player.y, left.x, left.y) - distance(player.x, player.y, right.x, right.y))
        .find((enemy) => dungeonEnemyInsideAim(player, enemy, state, range, minDot))
        ?? livingEnemies.find((enemy) => distance(player.x, player.y, enemy.x, enemy.y) <= range + DUNGEON_ENEMY_RADIUS);
      if (!target) throw new ArpgRaidRuleError("Nenhum inimigo está na direção da habilidade.");
      damageDungeonEnemy(
        state,
        player,
        target,
        card.damage,
        atMs,
        events,
        `${player.name} lançou ${card.name} em ${target.name}.`,
        card.behavior === "targeted-control" ? card.durationMs ?? 1_400 : 0,
      );
    }
  } else if (card.behavior === "renewal") {
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

function revivePlayer(
  state: ArpgRaidState,
  source: ArpgRaidPlayerState,
  targetPlayerId: string,
  atMs: number,
  events: ArpgRaidEvent[],
) {
  if (state.reviveCharges <= 0) throw new ArpgRaidRuleError("O grupo não tem mais reanimações disponíveis.");
  const target = playerFor(state, targetPlayerId);
  if (target.id === source.id) throw new ArpgRaidRuleError("Você não pode reerguer a si mesmo.");
  if (target.alive || target.downedUntilMs <= atMs) {
    throw new ArpgRaidRuleError("Esse aliado não está mais em condição de ser reerguido.");
  }
  if (distance(source.x, source.y, target.x, target.y) > REVIVE_RANGE) {
    throw new ArpgRaidRuleError("Chegue mais perto do aliado derrubado para reerguê-lo.");
  }

  state.reviveCharges -= 1;
  target.alive = true;
  target.downedUntilMs = 0;
  target.hp = Math.max(1, Math.round(target.maxHp * REVIVE_HP_RATIO));
  target.input = { ...target.input, moveX: 0, moveY: 0 };
  source.contribution.actions += 1;
  source.contribution.healing += target.hp;
  events.push(appendEvent(
    state,
    atMs,
    source.id,
    "player_revived",
    `${source.name} reergueu ${target.name} com ${target.hp} HP.`,
    { healing: target.hp, targetIds: [target.id] },
  ));
}

export function applyArpgRaidAction(
  input: ArpgRaidState,
  playerId: string,
  action: ArpgRaidAction,
  nowMs: number,
): ArpgRaidActionResult {
  if (input.processedActionIds.includes(action.actionId)) {
    return advanceArpgRaid(input, input.serverTimeMs);
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
    player.lastInputAtMs = atMs;
  } else if (action.kind === "attack") {
    performAttack(state, player, atMs, events);
  } else if (action.kind === "dash") {
    performDash(state, player, atMs, events);
  } else if (action.kind === "ability") {
    castAbility(state, player, action.slot, atMs, events);
  } else {
    revivePlayer(state, player, action.targetPlayerId, atMs, events);
  }

  advanceDungeonProgress(state, atMs, events);
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
