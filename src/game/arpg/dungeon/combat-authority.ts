import { z } from "zod";
import { ARPG_BASE_SPEED as PLAYER_BASE_SPEED, ARPG_DASH_SPEED as PLAYER_DASH_SPEED, ARPG_DASH_DURATION_MS as PLAYER_DASH_DURATION_MS, ARPG_DASH_COOLDOWN_MS as PLAYER_DASH_COOLDOWN_MS } from "../domain/combat-config";
import { ARPG_ABILITY_CARD_BY_ID } from "../content/ability-cards";
import { ARPG_DUNGEON_CONFIGS } from "../content/dungeons";
import { ARPG_ARMOR_BY_ID, ARPG_WEAPON_BY_ID, getArmorAbilityCooldownMs, getArmorDashCooldownMs, getArmorMovingDefenseBonus, getWeaponAttackIntervalMs, getWeaponAttackProc, normalizeArmorlessHealth } from "../content/equipment";
import { ARPG_RELIC_BY_ID, getRelicAbilityCooldownMs } from "../content/relics";
import type { ArpgArmorDefinition, ArpgLoadout } from "../domain/types";
import { getRunShardReward } from "./special-rooms";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_OBSTACLE_TILE, ROOM_WALL_TILE } from "./room-tilemap";
import { populateArpgDungeonContent } from "./content";
import { getCurupiraBossPattern, getCurupiraBossPhase, type CurupiraBossPhase } from "./boss-patterns";
import type { DungeonGraph, DungeonRoom } from "./types";

const MAX_ENEMIES_PER_ROOM = 24;
const MAX_PROJECTILES_PER_ROOM = 128;
const MAX_HAZARDS_PER_ROOM = 48;
const MAX_PROCESSED_ACTIONS = 120;
const SIMULATION_STEP_MS = 50;
const MAX_ADVANCE_MS = 2_000;
const PLAYER_RADIUS = 18;

const EncounterEnemySchema = z.strictObject({
  id: z.string().min(1).max(80),
  definitionId: z.string().min(1).max(80),
  waveIndex: z.number().int().min(0).max(4),
  x: z.number().finite().min(0).max(4_096),
  y: z.number().finite().min(0).max(4_096),
  hp: z.number().int().min(0).max(100_000),
  maxHp: z.number().int().min(1).max(100_000),
  alive: z.boolean(),
  rootedUntilMs: z.number().int().nonnegative(),
  nextContactAtMs: z.number().int().nonnegative(),
  nextShotAtMs: z.number().int().nonnegative(),
  shotCount: z.number().int().nonnegative().max(100_000),
  bossPhase: z.number().int().min(1).max(3).default(1),
  bossPatternIndex: z.number().int().nonnegative().max(100_000).default(0),
  nextPatternAtMs: z.number().int().nonnegative().default(0),
  bossPattern: z.string().min(1).max(40).nullable().default(null),
});
const CombatProjectileSchema = z.strictObject({
  id: z.string().min(1).max(120),
  x: z.number().finite().min(0).max(4_096),
  y: z.number().finite().min(0).max(4_096),
  velocityX: z.number().finite().min(-1_000).max(1_000),
  velocityY: z.number().finite().min(-1_000).max(1_000),
  damage: z.number().int().min(1).max(500),
  radius: z.number().finite().min(2).max(48),
  remainingDistance: z.number().finite().min(0).max(2_000),
});
const CombatHazardSchema = z.strictObject({
  id: z.string().min(1).max(140),
  pattern: z.string().min(1).max(40),
  shape: z.enum(["circle", "rect"]),
  x: z.number().finite().min(0).max(4_096),
  y: z.number().finite().min(0).max(4_096),
  radius: z.number().finite().min(0).max(700),
  width: z.number().finite().min(0).max(1_200),
  height: z.number().finite().min(0).max(1_200),
  angle: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2),
  damage: z.number().int().min(1).max(500),
  createdAtMs: z.number().int().nonnegative(),
  detonateAtMs: z.number().int().nonnegative(),
  activeUntilMs: z.number().int().nonnegative().default(0),
});

export const ArpgDungeonCombatStateSchema = z.strictObject({
  version: z.literal(1),
  roomId: z.string().min(1).max(40),
  status: z.enum(["combat", "wave_complete", "victory", "defeat"]),
  waveIndex: z.number().int().min(0).max(4),
  waveCount: z.number().int().min(1).max(5),
  serverTimeMs: z.number().int().nonnegative(),
  waveCompleteAtMs: z.number().int().nonnegative().nullable(),
  playerX: z.number().finite().min(0).max(4_096),
  playerY: z.number().finite().min(0).max(4_096),
  playerHp: z.number().int().min(0).max(500),
  maxHp: z.number().int().min(1).max(500),
  weaponId: z.string().min(1).max(80),
  armorId: z.string().min(1).max(80),
  attackCount: z.number().int().nonnegative(),
  nextAttackAtMs: z.number().int().nonnegative(),
  nextDamageAtMs: z.number().int().nonnegative(),
  // Legacy checkpoint fields are accepted for resume compatibility and ignored.
  nextSupportAtMs: z.number().int().nonnegative().optional(),
  nextSupportSwapAtMs: z.number().int().nonnegative().optional(),
  activeSupportIndex: z.union([z.literal(0), z.literal(1)]).optional(),
  nextAbilityAtMs: z.record(z.string(), z.number().int().nonnegative()),
  runMoveSpeedBonus: z.number().min(0).max(16),
  runBasicDamageMultiplier: z.number().min(1).max(1.15),
  xpMultiplier: z.number().min(0.5).max(1.2),
  baseXpEarned: z.number().int().nonnegative(),
  baseRunShards: z.number().int().nonnegative(),
  xpEarned: z.number().int().nonnegative(),
  runShards: z.number().int().nonnegative(),
  dashUntilMs: z.number().int().nonnegative(),
  nextDashAtMs: z.number().int().nonnegative().default(0),
  processedActionIds: z.array(z.string().min(1).max(100)).max(MAX_PROCESSED_ACTIONS),
  enemies: z.array(EncounterEnemySchema).max(MAX_ENEMIES_PER_ROOM),
  projectiles: z.array(CombatProjectileSchema).max(MAX_PROJECTILES_PER_ROOM),
  hazards: z.array(CombatHazardSchema).max(MAX_HAZARDS_PER_ROOM).default([]),
}).superRefine((state, context) => {
  if (state.playerHp > state.maxHp) context.addIssue({ code: "custom", path: ["playerHp"], message: "HP excede o máximo." });
  if (state.enemies.some((enemy) => enemy.hp > enemy.maxHp || enemy.alive !== (enemy.hp > 0))) {
    context.addIssue({ code: "custom", path: ["enemies"], message: "Estado de inimigos inconsistente." });
  }
  if (state.waveIndex >= state.waveCount) context.addIssue({ code: "custom", path: ["waveIndex"], message: "Onda inválida." });
}).transform(({ nextSupportAtMs, nextSupportSwapAtMs, activeSupportIndex, ...state }) => {
  void nextSupportAtMs;
  void nextSupportSwapAtMs;
  void activeSupportIndex;
  return normalizeArmorlessHealth(state);
});

export type ArpgDungeonCombatState = z.infer<typeof ArpgDungeonCombatStateSchema>;

export type ArpgDungeonCombatCommand = {
  actionId: string;
  kind: "sync" | "basic_attack" | "ability" | "dash";
  playerX: number;
  playerY: number;
  aimX: number;
  aimY: number;
  abilitySlot?: 0 | 1;
};

type CombatHazard = ArpgDungeonCombatState["hazards"][number];
type CombatHazardSpec = Omit<CombatHazard, "id" | "createdAtMs" | "detonateAtMs" | "activeUntilMs"> & {
  delayMs: number;
  activeDurationMs?: number;
};

export class ArpgDungeonCombatRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArpgDungeonCombatRuleError";
  }
}

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

function getCombatRoom(graph: DungeonGraph, roomId: string) {
  const contentGraph = {
    ...graph,
    rooms: Object.fromEntries(Object.entries(graph.rooms).map(([id, room]) => [id, { ...room, waves: [] }])) as Record<string, DungeonRoom>,
  };
  populateArpgDungeonContent(contentGraph);
  const room = contentGraph.rooms[roomId];
  const config = ARPG_DUNGEON_CONFIGS[graph.regionId as keyof typeof ARPG_DUNGEON_CONFIGS];
  if (!room || !config || !["combat", "elite", "boss"].includes(room.type) || room.waves.length === 0) {
    throw new ArpgDungeonCombatRuleError("A sala não possui um encontro de combate válido.");
  }
  return { room, config };
}

function roomTiles(graph: DungeonGraph, room: DungeonRoom) {
  return buildRoomTileData(room.templateId, room.connections, graph.seed);
}

function clampPointToRoom(tiles: ReturnType<typeof roomTiles>, x: number, y: number) {
  const margin = PLAYER_RADIUS;
  return {
    x: Math.max(margin, Math.min(tiles.width * 32 - margin, x)),
    y: Math.max(margin, Math.min(tiles.height * 32 - margin, y)),
  };
}

function isWalkable(tiles: ReturnType<typeof roomTiles>, x: number, y: number) {
  const tile = tiles.data[Math.floor(y / 32)]?.[Math.floor(x / 32)];
  return tile !== undefined && tile !== ROOM_WALL_TILE && tile !== ROOM_OBSTACLE_TILE;
}

function isWalkableSegment(tiles: ReturnType<typeof roomTiles>, from: { x: number; y: number }, to: { x: number; y: number }) {
  const distancePx = distance(from.x, from.y, to.x, to.y);
  const steps = Math.max(1, Math.ceil(distancePx / 10));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    if (!isWalkable(tiles, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return false;
  }
  return true;
}

function enemyId(roomId: string, waveIndex: number, index: number) {
  return `${roomId}:${waveIndex}:${index}`;
}

function initializeEnemies(graph: DungeonGraph, room: DungeonRoom, nowMs: number) {
  const result: ArpgDungeonCombatState["enemies"] = [];
  const tiles = roomTiles(graph, room);
  room.waves.forEach((wave, index) => {
    const points = createSafeRoomSpawnPoints(tiles, wave.length);
    wave.forEach((definitionId, enemyIndex) => {
      const definition = ARPG_DUNGEON_CONFIGS[graph.regionId as keyof typeof ARPG_DUNGEON_CONFIGS].enemies[definitionId];
      const point = points[enemyIndex];
      if (!definition || !point) throw new ArpgDungeonCombatRuleError("A composição do encontro não pôde ser reconstruída.");
      result.push({
        id: enemyId(room.id, index, enemyIndex),
        definitionId,
        waveIndex: index,
        x: point.x,
        y: point.y,
        hp: definition.maxHp,
        maxHp: definition.maxHp,
        alive: true,
        rootedUntilMs: 0,
        nextContactAtMs: 0,
        nextShotAtMs: nowMs + 1_050 + enemyIndex * 170,
        shotCount: 0,
        bossPhase: 1,
        bossPatternIndex: 0,
        nextPatternAtMs: definition.id === "boss" ? nowMs + 1_050 : 0,
        bossPattern: null,
      });
    });
  });
  if (result.length > MAX_ENEMIES_PER_ROOM) throw new ArpgDungeonCombatRuleError("O encontro excede o limite de inimigos simuláveis.");
  return result;
}

export function createArpgDungeonCombatState(options: {
  graph: DungeonGraph;
  roomId: string;
  loadout: ArpgLoadout;
  playerHp: number;
  maxHp: number;
  playerX: number;
  playerY: number;
  runMoveSpeedBonus: number;
  runBasicDamageMultiplier: number;
  xpMultiplier: number;
  baseXpEarned: number;
  baseRunShards: number;
  nowMs: number;
}): ArpgDungeonCombatState {
  const { graph, roomId, loadout } = options;
  const { room } = getCombatRoom(graph, roomId);
  const tiles = roomTiles(graph, room);
  if (!isWalkable(tiles, options.playerX, options.playerY)) {
    throw new ArpgDungeonCombatRuleError("A posição inicial do combate não é caminhável.");
  }
  const state: ArpgDungeonCombatState = {
    version: 1,
    roomId,
    status: "combat",
    waveIndex: 0,
    waveCount: room.waves.length,
    serverTimeMs: options.nowMs,
    waveCompleteAtMs: null,
    playerX: options.playerX,
    playerY: options.playerY,
    playerHp: Math.max(0, Math.min(options.maxHp, options.playerHp)),
    maxHp: options.maxHp,
    weaponId: loadout.weaponId,
    armorId: loadout.armorId,
    attackCount: 0,
    nextAttackAtMs: options.nowMs,
    nextDamageAtMs: options.nowMs,
    nextAbilityAtMs: {},
    runMoveSpeedBonus: options.runMoveSpeedBonus,
    runBasicDamageMultiplier: options.runBasicDamageMultiplier,
    xpMultiplier: options.xpMultiplier,
    baseXpEarned: options.baseXpEarned,
    baseRunShards: options.baseRunShards,
    xpEarned: 0,
    runShards: 0,
    dashUntilMs: 0,
    nextDashAtMs: options.nowMs,
    processedActionIds: [],
    enemies: initializeEnemies(graph, room, options.nowMs),
    projectiles: [],
    hazards: [],
  };
  return ArpgDungeonCombatStateSchema.parse(state);
}

export function isValidArpgCombatEntryPosition(
  graph: DungeonGraph,
  roomId: string,
  previouslyClearedRoomIds: readonly string[],
  playerX: number,
  playerY: number,
) {
  const room = graph.rooms[roomId];
  if (!room || !Number.isFinite(playerX) || !Number.isFinite(playerY)) return false;
  const tiles = roomTiles(graph, room);
  const roomWidth = tiles.width * 32;
  const roomHeight = tiles.height * 32;
  const cleared = new Set(previouslyClearedRoomIds);
  const entryPoints = (Object.entries(room.connections) as Array<[keyof typeof room.connections, string | undefined]>)
    .filter(([, neighborId]) => neighborId && cleared.has(neighborId))
    .map(([direction]) => {
      if (direction === "north") return { x: roomWidth / 2, y: 28 };
      if (direction === "south") return { x: roomWidth / 2, y: roomHeight - 28 };
      if (direction === "west") return { x: 28, y: roomHeight / 2 };
      return { x: roomWidth - 28, y: roomHeight / 2 };
    });
  return entryPoints.some((entry) => (
    distance(entry.x, entry.y, playerX, playerY) <= 72
    && isWalkable(tiles, playerX, playerY)
  ));
}

function setWaveState(state: ArpgDungeonCombatState, room: DungeonRoom, atMs: number) {
  if (state.status === "defeat" || state.status === "victory") return;
  const currentWaveEnemies = state.enemies.filter((enemy) => enemy.waveIndex === state.waveIndex);
  if (currentWaveEnemies.some((enemy) => enemy.alive)) return;
  if (state.waveIndex + 1 >= state.waveCount) {
    state.status = "victory";
    state.waveCompleteAtMs = atMs;
    return;
  }
  if (state.status !== "wave_complete") {
    state.status = "wave_complete";
    state.waveCompleteAtMs = atMs;
  }
  if (state.waveCompleteAtMs !== null && atMs - state.waveCompleteAtMs >= 520) {
    state.waveIndex += 1;
    state.status = "combat";
    state.waveCompleteAtMs = null;
  }
  void room;
}

function addBossHazard(
  state: ArpgDungeonCombatState,
  enemy: ArpgDungeonCombatState["enemies"][number],
  atMs: number,
  suffix: string,
  spec: CombatHazardSpec,
) {
  if (state.hazards.length >= MAX_HAZARDS_PER_ROOM) {
    state.hazards.sort((left, right) => left.detonateAtMs - right.detonateAtMs);
    state.hazards.shift();
  }
  const { delayMs, activeDurationMs = 0, ...hazard } = spec;
  state.hazards.push({
    ...hazard,
    id: `${enemy.id}:pattern:${enemy.bossPatternIndex}:${suffix}`,
    createdAtMs: atMs,
    detonateAtMs: atMs + delayMs,
    activeUntilMs: atMs + delayMs + activeDurationMs,
  });
}

function addBossCircleHazard(
  state: ArpgDungeonCombatState,
  enemy: ArpgDungeonCombatState["enemies"][number],
  atMs: number,
  pattern: string,
  x: number,
  y: number,
  radius: number,
  damage: number,
  delayMs: number,
  suffix = "circle",
) {
  addBossHazard(state, enemy, atMs, suffix, {
    pattern,
    shape: "circle",
    x,
    y,
    radius,
    width: 0,
    height: 0,
    angle: 0,
    damage,
    delayMs,
  });
}

function addBossRectHazard(
  state: ArpgDungeonCombatState,
  enemy: ArpgDungeonCombatState["enemies"][number],
  atMs: number,
  pattern: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  damage: number,
  delayMs: number,
  suffix: string,
  activeDurationMs = 0,
) {
  addBossHazard(state, enemy, atMs, suffix, {
    pattern,
    shape: "rect",
    x,
    y,
    radius: 0,
    width,
    height,
    angle,
    damage,
    delayMs,
    activeDurationMs,
  });
}

function fireBossVolley(
  state: ArpgDungeonCombatState,
  enemy: ArpgDungeonCombatState["enemies"][number],
  playerX: number,
  playerY: number,
  count: number,
  spread: number,
  damage: number,
  speed = 330,
) {
  const baseAngle = Math.atan2(playerY - enemy.y, playerX - enemy.x);
  const center = (count - 1) / 2;
  for (let index = 0; index < count && state.projectiles.length < MAX_PROJECTILES_PER_ROOM; index += 1) {
    const angle = baseAngle + (index - center) * spread;
    enemy.shotCount += 1;
    state.projectiles.push({
      id: `${enemy.id}:boss-shot:${enemy.shotCount}`,
      x: enemy.x,
      y: enemy.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      damage,
      radius: 10,
      remainingDistance: 760,
    });
  }
}

function teleportBossToDeterministicPoint(
  enemy: ArpgDungeonCombatState["enemies"][number],
  state: ArpgDungeonCombatState,
  tiles: ReturnType<typeof roomTiles>,
) {
  const baseAngle = ((enemy.bossPatternIndex * 0.61803398875) % 1) * Math.PI * 2;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = baseAngle + attempt * Math.PI / 4;
    const candidate = {
      x: state.playerX + Math.cos(angle) * 260,
      y: state.playerY + Math.sin(angle) * 260,
    };
    if (
      distance(candidate.x, candidate.y, state.playerX, state.playerY) >= 210
      && isWalkable(tiles, candidate.x, candidate.y)
    ) {
      enemy.x = candidate.x;
      enemy.y = candidate.y;
      return;
    }
  }
}

function launchBossPattern(
  state: ArpgDungeonCombatState,
  graph: DungeonGraph,
  room: DungeonRoom,
  enemy: ArpgDungeonCombatState["enemies"][number],
  atMs: number,
) {
  const hpRatio = enemy.hp / enemy.maxHp;
  const tiles = roomTiles(graph, room);
  const previousPhase = enemy.bossPhase as CurupiraBossPhase;
  let patternIndex = enemy.bossPatternIndex;
  const phase = graph.regionId === "mata-encantada"
    ? getCurupiraBossPhase(previousPhase, patternIndex, hpRatio)
    : hpRatio < 0.33 ? 3 : hpRatio < 0.66 ? 2 : 1;
  if (phase !== previousPhase) {
    enemy.bossPhase = phase;
    patternIndex = 0;
  }

  const dx = state.playerX - enemy.x;
  const dy = state.playerY - enemy.y;
  const aimAngle = Math.atan2(dy, dx);
  const perpendicularX = -Math.sin(aimAngle);
  const perpendicularY = Math.cos(aimAngle);
  const targetX = state.playerX;
  const targetY = state.playerY;
  let pattern: string;
  let intervalMs: number;

  if (graph.regionId === "mata-encantada") {
    const curupiraPattern = getCurupiraBossPattern(phase, patternIndex);
    pattern = curupiraPattern;
    if (curupiraPattern === "bow-volley") {
      fireBossVolley(state, enemy, targetX, targetY, 3, 0.14, 13);
      intervalMs = 2_050;
    } else if (curupiraPattern === "roots-burst") {
      fireBossVolley(state, enemy, targetX, targetY, 3, 0.14, 13);
      addBossCircleHazard(state, enemy, atMs, pattern, targetX, targetY, 86, 13, 760);
      intervalMs = 2_150;
    } else if (curupiraPattern === "decoy-ambush") {
      teleportBossToDeterministicPoint(enemy, state, tiles);
      addBossCircleHazard(state, enemy, atMs, pattern, targetX, targetY, 86, 16, 680);
      intervalMs = 1_900;
    } else if (curupiraPattern === "decoy-volley") {
      fireBossVolley(state, enemy, targetX, targetY, 4, 0.18, 13);
      intervalMs = 1_950;
    } else if (curupiraPattern === "root-arena") {
      const centerX = tiles.width * 16;
      const centerY = tiles.height * 16;
      const barriers = [
        { x: centerX - 140, y: centerY + 62, width: 150, height: 24, angle: 0 },
        { x: centerX + 142, y: centerY - 62, width: 24, height: 146, angle: 0 },
      ];
      barriers.forEach((barrier, index) => {
        if (distance(barrier.x, barrier.y, state.playerX, state.playerY) < 104) return;
        if (distance(barrier.x, barrier.y, enemy.x, enemy.y) < 104) return;
        addBossRectHazard(state, enemy, atMs, pattern, barrier.x, barrier.y, barrier.width, barrier.height, barrier.angle, 16, 380, `root-${index}`, 1_720);
      });
      fireBossVolley(state, enemy, targetX, targetY, 4, 0.2, 13);
      intervalMs = 2_050;
    } else {
      teleportBossToDeterministicPoint(enemy, state, tiles);
      fireBossVolley(state, enemy, targetX, targetY, 5, 0.2, 13);
      addBossCircleHazard(state, enemy, atMs, pattern, targetX, targetY, 88, 18, 680);
      intervalMs = 1_750;
    }
  } else if (graph.regionId === "arquipelago-das-mares") {
    if (phase === 1) {
      pattern = "tide-volley";
      fireBossVolley(state, enemy, targetX, targetY, 3, 0.14, 14, 345);
      intervalMs = 2_200;
    } else if (phase === 2) {
      pattern = "undertow-sweep";
      addBossRectHazard(state, enemy, atMs, pattern,
        (enemy.x + targetX) / 2, (enemy.y + targetY) / 2, 250, 62, aimAngle, 18, 700, "sweep");
      intervalMs = 2_000;
    } else {
      pattern = "deep-current";
      teleportBossToDeterministicPoint(enemy, state, tiles);
      fireBossVolley(state, enemy, targetX, targetY, 5, 0.25, 14, 350);
      addBossCircleHazard(state, enemy, atMs, pattern, targetX, targetY, 76, 17, 640, "center");
      const sideTarget = clampPointToRoom(tiles,
        targetX + perpendicularX * 100, targetY + perpendicularY * 100);
      addBossCircleHazard(state, enemy, atMs, pattern,
        sideTarget.x, sideTarget.y, 62, 14, 640, "side");
      intervalMs = 1_650;
    }
  } else {
    if (phase === 1) {
      pattern = "frost-shards";
      fireBossVolley(state, enemy, targetX, targetY, 3, 0.12, 14, 360);
      intervalMs = 2_200;
    } else if (phase === 2) {
      pattern = "ice-lanes";
      [-1, 0, 1].forEach((offset) => {
        const laneCenter = clampPointToRoom(tiles,
          targetX + perpendicularX * offset * 76,
          targetY + perpendicularY * offset * 76);
        addBossRectHazard(state, enemy, atMs, pattern,
          laneCenter.x,
          laneCenter.y,
          220, 34, aimAngle, 15, 650, `lane-${offset + 1}`);
      });
      intervalMs = 2_000;
    } else {
      pattern = "whiteout-charge";
      teleportBossToDeterministicPoint(enemy, state, tiles);
      fireBossVolley(state, enemy, targetX, targetY, 5, 0.2, 15, 390);
      addBossRectHazard(state, enemy, atMs, pattern,
        (enemy.x + targetX) / 2, (enemy.y + targetY) / 2, 290, 64, aimAngle, 20, 720, "charge");
      intervalMs = 1_650;
    }
  }

  enemy.bossPattern = pattern;
  enemy.bossPatternIndex = patternIndex + 1;
  enemy.nextPatternAtMs = atMs + intervalMs;
}

function isPlayerInsideHazard(x: number, y: number, hazard: CombatHazard, bodyRadius = PLAYER_RADIUS) {
  if (hazard.shape === "circle") return distance(x, y, hazard.x, hazard.y) <= hazard.radius + bodyRadius;
  const dx = x - hazard.x;
  const dy = y - hazard.y;
  const localX = dx * Math.cos(hazard.angle) + dy * Math.sin(hazard.angle);
  const localY = -dx * Math.sin(hazard.angle) + dy * Math.cos(hazard.angle);
  return Math.abs(localX) <= hazard.width / 2 + bodyRadius
    && Math.abs(localY) <= hazard.height / 2 + bodyRadius;
}

function isPlayerBlockedByRootBarrier(
  from: { x: number; y: number },
  to: { x: number; y: number },
  hazard: CombatHazard,
  bodyRadius = PLAYER_RADIUS,
) {
  if (isPlayerInsideHazard(from.x, from.y, hazard, bodyRadius)) {
    return distance(to.x, to.y, hazard.x, hazard.y) <= distance(from.x, from.y, hazard.x, hazard.y);
  }
  const distancePx = distance(from.x, from.y, to.x, to.y);
  const steps = Math.max(1, Math.ceil(distancePx / 10));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    if (isPlayerInsideHazard(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, hazard, bodyRadius)) return true;
  }
  return false;
}

function resolveBossHazards(
  state: ArpgDungeonCombatState,
  armor: ArpgArmorDefinition,
  moving: boolean,
  atMs: number,
  pendingDashAtFinalStep: boolean,
) {
  state.hazards = state.hazards.filter((hazard) => {
    if (atMs < hazard.detonateAtMs) return true;
    if (hazard.pattern === "root-arena" && atMs < hazard.activeUntilMs) return true;
    if (
      state.status === "combat"
      && isPlayerInsideHazard(state.playerX, state.playerY, hazard)
      && atMs >= state.nextDamageAtMs
      && atMs >= state.dashUntilMs
      && !pendingDashAtFinalStep
    ) {
      const damage = Math.max(1, hazard.damage - armor.defenseBonus - getArmorMovingDefenseBonus(armor, moving));
      state.playerHp = Math.max(0, state.playerHp - damage);
      state.nextDamageAtMs = atMs + 260;
      if (state.playerHp <= 0) state.status = "defeat";
    }
    return false;
  });
}

function advanceState(
  state: ArpgDungeonCombatState,
  graph: DungeonGraph,
  room: DungeonRoom,
  config: (typeof ARPG_DUNGEON_CONFIGS)[keyof typeof ARPG_DUNGEON_CONFIGS],
  loadout: ArpgLoadout,
  targetTimeMs: number,
  targetPlayerPosition?: { x: number; y: number },
  pendingDashAtFinalStep = false,
) {
  const armor = ARPG_ARMOR_BY_ID.get(state.armorId)!;
  const previousTimeMs = state.serverTimeMs;
  const boundedTimeMs = Math.min(targetTimeMs, previousTimeMs + MAX_ADVANCE_MS);
  const tiles = roomTiles(graph, room);
  const initialPosition = { x: state.playerX, y: state.playerY };
  const requestedPosition = targetPlayerPosition ?? initialPosition;
  const dtMs = Math.max(0, boundedTimeMs - previousTimeMs);
  const maxTravel = (PLAYER_BASE_SPEED + armor.moveSpeedBonus + state.runMoveSpeedBonus) * dtMs / 1000;
  if (targetPlayerPosition) {
    if (
      distance(initialPosition.x, initialPosition.y, requestedPosition.x, requestedPosition.y) > maxTravel
      || !isWalkableSegment(tiles, initialPosition, requestedPosition)
    ) throw new ArpgDungeonCombatRuleError("O movimento informado excede a velocidade ou atravessa um obstáculo.");
  }

  const steps = Math.ceil(dtMs / SIMULATION_STEP_MS);
  for (let step = 1; step <= steps; step += 1) {
    const t = dtMs <= 0 ? 1 : Math.min(1, step * SIMULATION_STEP_MS / dtMs);
    const stepStartMs = previousTimeMs + (step - 1) * SIMULATION_STEP_MS;
    const atMs = Math.min(boundedTimeMs, previousTimeMs + step * SIMULATION_STEP_MS);
    if (targetPlayerPosition) {
      const nextPosition = {
        x: initialPosition.x + (requestedPosition.x - initialPosition.x) * t,
        y: initialPosition.y + (requestedPosition.y - initialPosition.y) * t,
      };
      const previousStepPosition = { x: state.playerX, y: state.playerY };
      const blockedByRootBarrier = state.hazards.some((hazard) => (
        hazard.pattern === "root-arena"
        && atMs >= hazard.detonateAtMs
        && atMs < hazard.activeUntilMs
        && isPlayerBlockedByRootBarrier(previousStepPosition, nextPosition, hazard)
      ));
      if (!blockedByRootBarrier) {
        state.playerX = nextPosition.x;
        state.playerY = nextPosition.y;
      }
    }
    const stepDurationMs = atMs - stepStartMs;
    setWaveState(state, room, atMs);
    if (state.status === "combat") {
      for (const enemy of state.enemies) {
        if (!enemy.alive || enemy.waveIndex !== state.waveIndex || atMs < enemy.rootedUntilMs) continue;
        const definition = config.enemies[enemy.definitionId];
        if (!definition) continue;
        const dx = state.playerX - enemy.x;
        const dy = state.playerY - enemy.y;
        const range = Math.hypot(dx, dy);
        let direction = { x: 0, y: 0 };
        const role = definition.combatRole ?? "melee";
        if (role === "melee" || role === "charger" || range > 390) {
          direction = range > 0.001 ? { x: dx / range, y: dy / range } : direction;
        } else if (role === "ranged" && range < 230) {
          direction = range > 0.001 ? { x: -dx / range, y: -dy / range } : direction;
        } else if (role === "caster" && range < 210) {
          direction = range > 0.001 ? { x: -dx / range, y: -dy / range } : direction;
        } else if (role === "elite" && range < 250) {
          direction = range > 0.001 ? { x: -dx / range, y: -dy / range } : direction;
        }
        if (direction.x !== 0 || direction.y !== 0) {
          const speed = definition.moveSpeed * (definition.id === "boss" && enemy.hp / enemy.maxHp < 0.33 ? 1.28 : 1);
          const distanceStep = speed * stepDurationMs / 1000;
          const next = { x: enemy.x + direction.x * distanceStep, y: enemy.y + direction.y * distanceStep };
          const blockedByRootBarrier = state.hazards.some((hazard) => (
            hazard.pattern === "root-arena"
            && atMs >= hazard.detonateAtMs
            && atMs < hazard.activeUntilMs
            && isPlayerBlockedByRootBarrier(enemy, next, hazard, definition.radius)
          ));
          if (isWalkable(tiles, next.x, next.y) && !blockedByRootBarrier) {
            enemy.x = next.x;
            enemy.y = next.y;
          }
        }
        const contactRange = Math.max(36, definition.radius + PLAYER_RADIUS);
        const nowInContact = distance(enemy.x, enemy.y, state.playerX, state.playerY) <= contactRange;
        const contactInterval = definition.id === "boss" ? 980 : 650;
        const moving = distance(initialPosition.x, initialPosition.y, requestedPosition.x, requestedPosition.y) > 4;
        if (
          nowInContact
          && atMs >= enemy.nextContactAtMs
          && atMs >= state.nextDamageAtMs
          && atMs >= state.dashUntilMs
          && !(pendingDashAtFinalStep && atMs === boundedTimeMs)
        ) {
          const damage = Math.max(1, definition.contactDamage - armor.defenseBonus - getArmorMovingDefenseBonus(armor, moving));
          state.playerHp = Math.max(0, state.playerHp - damage);
          state.nextDamageAtMs = atMs + 260;
          enemy.nextContactAtMs = atMs + contactInterval;
          const retaliation = armor.effect?.id === "ahuizotl-retaliation" ? 10 : 0;
          if (retaliation > 0) damageInRadius(state, config, state.playerX, state.playerY, 96, retaliation, atMs);
          if (state.playerHp <= 0) state.status = "defeat";
        }

        const projectileRole = role === "ranged" || role === "caster" || role === "elite" || definition.id === "boss";
        const attackRange = definition.id === "boss" ? 760 : role === "caster" ? 620 : role === "elite" ? 560 : 680;
        if (definition.id === "boss" && range <= attackRange && atMs >= enemy.nextPatternAtMs) {
          launchBossPattern(state, graph, room, enemy, atMs);
        } else if (
          projectileRole
          && definition.id !== "boss"
          && range <= attackRange
          && atMs >= enemy.nextShotAtMs
          && state.projectiles.length < MAX_PROJECTILES_PER_ROOM
        ) {
          const interval = role === "caster" ? 1_520
            : role === "elite" ? 1_340
              : 1_180;
          const volleySize = role === "elite" ? 2 : 1;
          const spread = role === "elite" ? 0.1 : 0;
          const dx = state.playerX - enemy.x;
          const dy = state.playerY - enemy.y;
          const angle = Math.atan2(dy, dx);
          const speed = role === "caster" ? 310 : role === "elite" ? 340 : 365;
          const damage = Math.max(1, Math.round(definition.contactDamage * (role === "elite" ? 0.72 : 0.62)));
          for (let index = 0; index < volleySize && state.projectiles.length < MAX_PROJECTILES_PER_ROOM; index += 1) {
            const offset = volleySize === 1 ? 0 : (index / (volleySize - 1) - 0.5) * spread;
            const projectileAngle = angle + offset;
            enemy.shotCount += 1;
            state.projectiles.push({
              id: `${enemy.id}:shot:${enemy.shotCount}`,
              x: enemy.x,
              y: enemy.y,
              velocityX: Math.cos(projectileAngle) * speed,
              velocityY: Math.sin(projectileAngle) * speed,
              damage,
              radius: 8,
              remainingDistance: 680,
            });
          }
          enemy.nextShotAtMs = atMs + interval;
        }
      }
    }

    state.projectiles = state.projectiles.filter((projectile) => {
      const velocity = Math.hypot(projectile.velocityX, projectile.velocityY);
      const distanceStep = velocity * stepDurationMs / 1000;
      const nextX = projectile.x + projectile.velocityX * stepDurationMs / 1000;
      const nextY = projectile.y + projectile.velocityY * stepDurationMs / 1000;
      if (distanceStep <= 0 || !isWalkable(tiles, nextX, nextY)) return false;
      if (
        distance(nextX, nextY, state.playerX, state.playerY) <= projectile.radius + PLAYER_RADIUS
        && atMs >= state.nextDamageAtMs
        && atMs >= state.dashUntilMs
        && !(pendingDashAtFinalStep && atMs === boundedTimeMs)
      ) {
        const moving = targetPlayerPosition
          ? distance(initialPosition.x, initialPosition.y, requestedPosition.x, requestedPosition.y) > 4
          : false;
        const damage = Math.max(1, projectile.damage - armor.defenseBonus - getArmorMovingDefenseBonus(armor, moving));
        state.playerHp = Math.max(0, state.playerHp - damage);
        state.nextDamageAtMs = atMs + 260;
        if (state.playerHp <= 0) state.status = "defeat";
        return false;
      }
      projectile.x = nextX;
      projectile.y = nextY;
      projectile.remainingDistance -= distanceStep;
      return projectile.remainingDistance > 0;
    });
    const moving = distance(initialPosition.x, initialPosition.y, requestedPosition.x, requestedPosition.y) > 4;
    resolveBossHazards(state, armor, moving, atMs, pendingDashAtFinalStep && atMs === boundedTimeMs);
    setWaveState(state, room, atMs);
    if (state.status === "defeat" || state.status === "victory") break;
  }
  state.serverTimeMs = boundedTimeMs;
  void loadout;
}

function applyDamage(state: ArpgDungeonCombatState, config: (typeof ARPG_DUNGEON_CONFIGS)[keyof typeof ARPG_DUNGEON_CONFIGS], enemy: ArpgDungeonCombatState["enemies"][number], damage: number) {
  if (!enemy.alive) return;
  const applied = Math.max(0, Math.min(enemy.hp, Math.round(damage)));
  enemy.hp -= applied;
  if (enemy.hp > 0) return;
  enemy.hp = 0;
  enemy.alive = false;
  const definition = config.enemies[enemy.definitionId];
  if (definition) {
    state.xpEarned += Math.round(definition.rewardXp * state.xpMultiplier);
    state.runShards += getRunShardReward(definition.rewardXp);
  }
}

function damageInRadius(state: ArpgDungeonCombatState, config: (typeof ARPG_DUNGEON_CONFIGS)[keyof typeof ARPG_DUNGEON_CONFIGS], x: number, y: number, radius: number, damage: number, rootedUntilMs = 0) {
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.waveIndex !== state.waveIndex) continue;
    const definition = config.enemies[enemy.definitionId];
    if (!definition || distance(x, y, enemy.x, enemy.y) > radius + definition.radius) continue;
    applyDamage(state, config, enemy, damage);
    if (enemy.alive && rootedUntilMs > 0) enemy.rootedUntilMs = rootedUntilMs;
  }
}

function damageInLine(state: ArpgDungeonCombatState, config: (typeof ARPG_DUNGEON_CONFIGS)[keyof typeof ARPG_DUNGEON_CONFIGS], aimX: number, aimY: number, range: number, damage: number, piercing: boolean) {
  const hits = state.enemies
    .filter((enemy) => enemy.alive && enemy.waveIndex === state.waveIndex)
    .map((enemy) => {
      const dx = enemy.x - state.playerX;
      const dy = enemy.y - state.playerY;
      const along = dx * aimX + dy * aimY;
      const across = Math.abs(dx * aimY - dy * aimX);
      const definition = config.enemies[enemy.definitionId];
      return { enemy, along, across, radius: definition?.radius ?? 14 };
    })
    .filter((entry) => entry.along >= 0 && entry.along <= range && entry.across <= entry.radius + 12)
    .sort((left, right) => left.along - right.along);
  const targets = piercing ? hits : hits.slice(0, 1);
  for (const target of targets) applyDamage(state, config, target.enemy, damage);
}

function performBasicAttack(state: ArpgDungeonCombatState, config: (typeof ARPG_DUNGEON_CONFIGS)[keyof typeof ARPG_DUNGEON_CONFIGS], loadout: ArpgLoadout, aimX: number, aimY: number, moving: boolean) {
  const weapon = ARPG_WEAPON_BY_ID.get(state.weaponId);
  if (!weapon) throw new ArpgDungeonCombatRuleError("A arma da run não é válida.");
  if (state.serverTimeMs < state.nextAttackAtMs) throw new ArpgDungeonCombatRuleError("O ataque básico ainda está em recarga.");
  state.attackCount += 1;
  const proc = getWeaponAttackProc(weapon, state.attackCount);
  state.nextAttackAtMs = state.serverTimeMs + getWeaponAttackIntervalMs(weapon, moving);
  const damage = Math.max(1, Math.round(weapon.damage * state.runBasicDamageMultiplier));
  if (weapon.kind === "sword") {
    const centerX = state.playerX + aimX * 42;
    const centerY = state.playerY + aimY * 42;
    damageInRadius(state, config, centerX, centerY, weapon.range, damage);
    if (proc.cleaveMultiplier > 0) damageInRadius(state, config, centerX, centerY, Math.round(weapon.range * 1.25), Math.max(1, Math.round(damage * proc.cleaveMultiplier)));
  } else {
    damageInLine(state, config, aimX, aimY, weapon.range, damage, proc.piercing);
    if (proc.echoMultiplier > 0) damageInLine(state, config, normalize(aimX - aimY * 0.12, aimY + aimX * 0.12).x, normalize(aimX - aimY * 0.12, aimY + aimX * 0.12).y, weapon.range, Math.max(1, Math.round(damage * proc.echoMultiplier)), false);
  }
  if (proc.restoreHp > 0) state.playerHp = Math.min(state.maxHp, state.playerHp + proc.restoreHp);
  void loadout;
}

function performAbility(state: ArpgDungeonCombatState, config: (typeof ARPG_DUNGEON_CONFIGS)[keyof typeof ARPG_DUNGEON_CONFIGS], loadout: ArpgLoadout, slot: 0 | 1, aimX: number, aimY: number) {
  if (slot !== 0 && slot !== 1) throw new ArpgDungeonCombatRuleError("O slot de ataque informado é inválido.");
  const cardId = loadout.abilityIds[slot];
  const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
  if (!card) throw new ArpgDungeonCombatRuleError("A carta-habilidade da run não é válida.");
  const armor = ARPG_ARMOR_BY_ID.get(state.armorId)!;
  if (state.serverTimeMs < (state.nextAbilityAtMs[card.id] ?? 0)) throw new ArpgDungeonCombatRuleError("Esta carta-habilidade ainda está em recarga.");
  const relic = ARPG_RELIC_BY_ID.get(loadout.relicId);
  if (!relic) throw new ArpgDungeonCombatRuleError("A relíquia da run não é válida.");
  state.nextAbilityAtMs[card.id] = state.serverTimeMs + getRelicAbilityCooldownMs(
    relic,
    getArmorAbilityCooldownMs(armor, card.cooldownMs),
  );
  if (card.behavior === "renewal") {
    state.playerHp = Math.min(state.maxHp, state.playerHp + (card.restoreHp ?? 40));
  } else if (card.behavior === "self-area") {
    damageInRadius(state, config, state.playerX, state.playerY, card.radius ?? 140, card.damage, card.kind === "control" ? state.serverTimeMs + (card.durationMs ?? 1_400) : 0);
  } else if (card.behavior === "targeted-control") {
    damageInRadius(state, config, state.playerX + aimX * 150, state.playerY + aimY * 150, card.radius ?? 150, card.damage, state.serverTimeMs + (card.durationMs ?? 1_600));
  } else {
    damageInLine(state, config, aimX, aimY, card.projectileSpeed ? card.projectileSpeed * 1.2 : 680, card.damage, card.behavior === "piercing-projectile");
  }
}

function movePlayerByDash(
  state: ArpgDungeonCombatState,
  tiles: ReturnType<typeof roomTiles>,
  direction: { x: number; y: number },
) {
  const start = { x: state.playerX, y: state.playerY };
  const dashDistance = PLAYER_DASH_SPEED * PLAYER_DASH_DURATION_MS / 1_000;
  const target = clampPointToRoom(
    tiles,
    start.x + direction.x * dashDistance,
    start.y + direction.y * dashDistance,
  );
  const distancePx = distance(start.x, start.y, target.x, target.y);
  const steps = Math.max(1, Math.ceil(distancePx / 8));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const next = {
      x: start.x + (target.x - start.x) * t,
      y: start.y + (target.y - start.y) * t,
    };
    const blockedByRootBarrier = state.hazards.some((hazard) => (
      hazard.pattern === "root-arena"
      && state.serverTimeMs >= hazard.detonateAtMs
      && state.serverTimeMs < hazard.activeUntilMs
      && isPlayerBlockedByRootBarrier(start, next, hazard)
    ));
    if (!isWalkable(tiles, next.x, next.y) || blockedByRootBarrier) break;
    state.playerX = next.x;
    state.playerY = next.y;
  }
}

export function applyArpgDungeonCombatCommand(options: {
  state: ArpgDungeonCombatState;
  graph: DungeonGraph;
  loadout: ArpgLoadout;
  command: ArpgDungeonCombatCommand;
  nowMs: number;
}): ArpgDungeonCombatState {
  const { graph, command } = options;
  const current = ArpgDungeonCombatStateSchema.parse(options.state);
  if (current.processedActionIds.includes(command.actionId)) return current;
  const { room, config } = getCombatRoom(graph, current.roomId);
  if (current.status === "victory" || current.status === "defeat") throw new ArpgDungeonCombatRuleError("Este encontro já terminou.");
  if (current.weaponId !== options.loadout.weaponId) throw new ArpgDungeonCombatRuleError("A arma do encontro não corresponde ao loadout validado.");
  if (current.armorId !== options.loadout.armorId) throw new ArpgDungeonCombatRuleError("A armadura do encontro não corresponde ao loadout validado.");
  const nextServerTimeMs = Math.min(options.nowMs, current.serverTimeMs + MAX_ADVANCE_MS);
  if (command.kind === "dash" && nextServerTimeMs < current.nextDashAtMs) {
    throw new ArpgDungeonCombatRuleError("A esquiva ainda está em recarga.");
  }
  const aim = normalize(command.aimX, command.aimY);
  const previousPosition = { x: current.playerX, y: current.playerY };
  advanceState(
    current,
    graph,
    room,
    config,
    options.loadout,
    options.nowMs,
    command.kind === "dash" ? undefined : { x: command.playerX, y: command.playerY },
    command.kind === "dash",
  );
  const moving = distance(previousPosition.x, previousPosition.y, current.playerX, current.playerY) > 4;

  if (current.status === "combat") {
    if (command.kind === "basic_attack") {
      performBasicAttack(current, config, options.loadout, aim.x, aim.y, moving);
    } else if (command.kind === "ability") {
      if (command.abilitySlot !== 0 && command.abilitySlot !== 1) {
        throw new ArpgDungeonCombatRuleError("O slot de ataque informado é inválido.");
      }
      performAbility(current, config, options.loadout, command.abilitySlot, aim.x, aim.y);
    } else if (command.kind === "dash") {
      movePlayerByDash(current, roomTiles(graph, room), aim);
      const armor = ARPG_ARMOR_BY_ID.get(current.armorId)!;
      current.dashUntilMs = current.serverTimeMs + PLAYER_DASH_DURATION_MS;
      current.nextDashAtMs = current.serverTimeMs + getArmorDashCooldownMs(armor, PLAYER_DASH_COOLDOWN_MS);
    }
  }

  if (current.status === "combat") setWaveState(current, room, current.serverTimeMs);
  current.processedActionIds.push(command.actionId);
  current.processedActionIds = current.processedActionIds.slice(-MAX_PROCESSED_ACTIONS);
  return ArpgDungeonCombatStateSchema.parse(current);
}
