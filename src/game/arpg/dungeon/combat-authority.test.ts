import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { ARPG_DUNGEON_CONFIGS } from "../content/dungeons";
import { generateDungeon } from "./generator";
import { populateArpgDungeonContent } from "./content";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_OBSTACLE_TILE, ROOM_WALL_TILE } from "./room-tilemap";
import {
  applyArpgDungeonCombatCommand,
  ArpgDungeonCombatStateSchema,
  createArpgDungeonCombatState,
  type ArpgDungeonCombatState,
} from "./combat-authority";

const LOADOUT = {
  ...DEFAULT_ARPG_LOADOUT,
  weaponId: "iron-sword",
  secondaryWeaponId: "forest-bow",
  armorId: "leather-armor",
};

function combatFixture() {
  const graph = generateDungeon({ seed: "server-combat-authority-test-seed", regionId: "mata-encantada" });
  populateArpgDungeonContent(graph);
  const room = Object.values(graph.rooms).find((candidate) => candidate.type === "combat")!;
  const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
  const enemyPoint = createSafeRoomSpawnPoints(tiles, room.waves[0]!.length)[0]!;
  return { graph, room, enemyPoint };
}

function startState() {
  const fixture = combatFixture();
  const state = createArpgDungeonCombatState({
    graph: fixture.graph,
    roomId: fixture.room.id,
    loadout: LOADOUT,
    playerHp: 132,
    maxHp: 132,
    playerX: fixture.enemyPoint.x,
    playerY: fixture.enemyPoint.y,
    runMoveSpeedBonus: 0,
    runBasicDamageMultiplier: 1,
    xpMultiplier: 1,
    baseXpEarned: 0,
    baseRunShards: 0,
    nowMs: 1_000,
  });
  return { ...fixture, state };
}

function startBossState(regionId: "mata-encantada" | "arquipelago-das-mares" | "montanhas-runicas" = "mata-encantada") {
  const graph = generateDungeon({ seed: `server-boss-pattern-${regionId}`, regionId });
  populateArpgDungeonContent(graph);
  const room = Object.values(graph.rooms).find((candidate) => candidate.type === "boss")!;
  const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
  const playerPoint = createSafeRoomSpawnPoints(tiles, room.waves[0]!.length)[0]!;
  const created = createArpgDungeonCombatState({
    graph,
    roomId: room.id,
    loadout: LOADOUT,
    playerHp: 132,
    maxHp: 132,
    playerX: playerPoint.x,
    playerY: playerPoint.y,
    runMoveSpeedBonus: 0,
    runBasicDamageMultiplier: 1,
    xpMultiplier: 1,
    baseXpEarned: 0,
    baseRunShards: 0,
    nowMs: 1_000,
  });
  const boss = created.enemies.find((enemy) => enemy.definitionId === "boss")!;
  const state = {
    ...created,
    waveIndex: boss.waveIndex,
    enemies: [{ ...boss, nextContactAtMs: 100_000 }],
  } satisfies ArpgDungeonCombatState;
  return { graph, room, tiles, state };
}

function findDodgePosition(
  tiles: ReturnType<typeof buildRoomTileData>,
  origin: { x: number; y: number },
  awayFrom: { x: number; y: number },
  distancePx: number,
) {
  const distances = [...new Set([distancePx, distancePx - 10, distancePx - 18, distancePx + 10, distancePx + 22])];
  for (const candidateDistance of distances) {
    for (let index = 0; index < 256; index += 1) {
      const angle = index * Math.PI * 2 / 256;
      const target = {
        x: origin.x + Math.cos(angle) * candidateDistance,
        y: origin.y + Math.sin(angle) * candidateDistance,
      };
      const steps = Math.ceil(candidateDistance / 10);
      const clear = Array.from({ length: steps + 1 }, (_, step) => {
        const t = step / steps;
        const x = Math.floor((origin.x + (target.x - origin.x) * t) / 32);
        const y = Math.floor((origin.y + (target.y - origin.y) * t) / 32);
        const tile = tiles.data[y]?.[x];
        return tile !== undefined && tile !== ROOM_WALL_TILE && tile !== ROOM_OBSTACLE_TILE;
      }).every(Boolean);
      if (clear && Math.hypot(target.x - awayFrom.x, target.y - awayFrom.y) > Math.hypot(origin.x - awayFrom.x, origin.y - awayFrom.y) + 24) {
        return target;
      }
    }
  }
  throw new Error("Não foi encontrado um corredor livre para esquivar do aviso.");
}

function command(state: ArpgDungeonCombatState, options: Partial<{
  actionId: string;
  kind: "sync" | "basic_attack" | "ability" | "dash" | "swap_weapon";
  playerX: number;
  playerY: number;
  aimX: number;
  aimY: number;
  abilitySlot: 0 | 1;
}> = {}) {
  return {
    actionId: options.actionId ?? "basic-1",
    kind: options.kind ?? "basic_attack",
    playerX: options.playerX ?? state.playerX,
    playerY: options.playerY ?? state.playerY,
    aimX: options.aimX ?? 1,
    aimY: options.aimY ?? 0,
    ...(options.abilitySlot === undefined ? {} : { abilitySlot: options.abilitySlot }),
  } as const;
}

describe("server-authoritative ARPG dungeon combat", () => {
  it("swaps only the two server-validated weapons and preserves both equipped powers", () => {
    const { graph, state } = startState();
    const swapped = applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state, { actionId: "swap-weapon", kind: "swap_weapon" }),
      nowMs: state.serverTimeMs,
    });

    expect(swapped).toMatchObject({ weaponId: "forest-bow", secondaryWeaponId: "iron-sword" });
    expect(LOADOUT.abilityIds).toEqual(DEFAULT_ARPG_LOADOUT.abilityIds);
    expect(() => applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: { ...LOADOUT, secondaryWeaponId: "ritual-staff" },
      command: command(state, { actionId: "forged-weapon-pair", kind: "swap_weapon" }),
      nowMs: state.serverTimeMs,
    })).toThrow("As armas do encontro não correspondem ao loadout validado.");
  });

  it("descarta campos de supporter de checkpoints legados ao normalizar", () => {
    const { state } = startState();
    const parsed = ArpgDungeonCombatStateSchema.parse({
      ...state,
      nextSupportAtMs: 9_000,
      nextSupportSwapAtMs: 9_500,
      activeSupportIndex: 1,
    });
    expect(parsed).not.toHaveProperty("nextSupportAtMs");
    expect(parsed).not.toHaveProperty("nextSupportSwapAtMs");
    expect(parsed).not.toHaveProperty("activeSupportIndex");
  });

  beforeEach(() => {
    process.env.GAME_ACTION_SECRET = "server-combat-authority-test-secret";
  });

  it("rebuilds seeded enemies and applies server weapon damage", () => {
    const { graph, room, state } = startState();
    const target = state.enemies.find((enemy) => enemy.waveIndex === 0)!;
    const maxHp = ARPG_DUNGEON_CONFIGS[graph.regionId as keyof typeof ARPG_DUNGEON_CONFIGS].enemies[target.definitionId]!.maxHp;
    expect(target.maxHp).toBe(maxHp);

    const next = applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state),
      nowMs: state.serverTimeMs,
    });

    expect(next.roomId).toBe(room.id);
    expect(next.enemies.find((enemy) => enemy.id === target.id)!.hp).toBe(Math.max(0, target.hp - 24));
    expect(next.attackCount).toBe(1);
    expect(next.processedActionIds).toEqual(["basic-1"]);
  });

  it("rejects a fabricated teleport before allowing an attack", () => {
    const { graph, state } = startState();
    const farPoint = { x: state.playerX + 220, y: state.playerY };

    expect(() => applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state, { playerX: farPoint.x, playerY: farPoint.y }),
      nowMs: state.serverTimeMs + 100,
    })).toThrow("O movimento informado excede a velocidade ou atravessa um obstáculo.");
  });

  it("does not grant extra movement or enemy time when commands arrive in the same server tick", () => {
    const { graph, state } = startState();

    expect(() => applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state, { kind: "sync", playerX: state.playerX + 1 }),
      nowMs: state.serverTimeMs,
    })).toThrow("O movimento informado excede a velocidade ou atravessa um obstáculo.");

    const stationary = applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state, { kind: "sync" }),
      nowMs: state.serverTimeMs,
    });
    expect(stationary.enemies.map(({ x, y }) => [x, y])).toEqual(state.enemies.map(({ x, y }) => [x, y]));
  });

  it("enforces weapon cooldowns and makes retried action ids idempotent", () => {
    const { graph, state } = startState();
    const first = applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state),
      nowMs: state.serverTimeMs,
    });

    expect(() => applyArpgDungeonCombatCommand({
      state: first,
      graph,
      loadout: LOADOUT,
      command: command(first, { actionId: "basic-2" }),
      nowMs: first.serverTimeMs + 100,
    })).toThrow("O ataque básico ainda está em recarga.");

    const replay = applyArpgDungeonCombatCommand({
      state: first,
      graph,
      loadout: LOADOUT,
      command: command(first),
      nowMs: first.serverTimeMs + 500,
    });
    expect(replay).toEqual(first);
  });

  it("resolves a bounded server dash and enforces its cooldown", () => {
    const { graph, room, state } = startState();
    const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
    const destination = findDodgePosition(
      tiles,
      { x: state.playerX, y: state.playerY },
      { x: state.playerX + 100, y: state.playerY },
      104,
    );
    const direction = {
      x: destination.x - state.playerX,
      y: destination.y - state.playerY,
    };
    const length = Math.hypot(direction.x, direction.y);
    direction.x /= length;
    direction.y /= length;

    const dashed = applyArpgDungeonCombatCommand({
      state,
      graph,
      loadout: LOADOUT,
      command: command(state, {
        kind: "dash",
        playerX: destination.x,
        playerY: destination.y,
        aimX: direction.x,
        aimY: direction.y,
      }),
      nowMs: state.serverTimeMs + 50,
    });

    const dashDistance = Math.hypot(dashed.playerX - state.playerX, dashed.playerY - state.playerY);
    expect(dashDistance).toBeGreaterThan(0);
    expect(dashDistance).toBeLessThanOrEqual(610 * 170 / 1_000 + 0.01);
    expect(dashed.dashUntilMs).toBe(dashed.serverTimeMs + 170);
    expect(dashed.nextDashAtMs).toBe(dashed.serverTimeMs + 820);
    expect(() => applyArpgDungeonCombatCommand({
      state: dashed,
      graph,
      loadout: LOADOUT,
      command: command(dashed, { actionId: "dash-retry", kind: "dash" }),
      nowMs: dashed.serverTimeMs + 100,
    })).toThrow("A esquiva ainda está em recarga.");

    const synced = applyArpgDungeonCombatCommand({
      state: dashed,
      graph,
      loadout: LOADOUT,
      command: command(dashed, { actionId: "sync-after-dash", kind: "sync" }),
      nowMs: dashed.serverTimeMs + 50,
    });
    expect(synced.playerX).toBeCloseTo(dashed.playerX);
    expect(synced.playerY).toBeCloseTo(dashed.playerY);
  });

  it("awards XP and run shards only when the server sim kills an enemy", () => {
    const { graph, state } = startState();
    const target = state.enemies.find((enemy) => enemy.waveIndex === 0)!;
    const roomConfig = ARPG_DUNGEON_CONFIGS[graph.regionId as keyof typeof ARPG_DUNGEON_CONFIGS];
    const enemyDefinition = roomConfig.enemies[target.definitionId]!;
    const oneEnemyState = {
      ...state,
      waveCount: 1,
      enemies: [{ ...target, hp: 1, maxHp: 1 }],
    } satisfies ArpgDungeonCombatState;

    const next = applyArpgDungeonCombatCommand({
      state: oneEnemyState,
      graph,
      loadout: LOADOUT,
      command: command(oneEnemyState),
      nowMs: oneEnemyState.serverTimeMs,
    });

    expect(next.status).toBe("victory");
    expect(next.enemies[0]).toMatchObject({ hp: 0, alive: false });
    expect(next.xpEarned).toBe(enemyDefinition.rewardXp);
    expect(next.runShards).toBeGreaterThan(0);
  });

  it("simulates ranged enemy projectiles and applies their damage on the server", () => {
    const { graph, state } = startState();
    const config = ARPG_DUNGEON_CONFIGS[graph.regionId as keyof typeof ARPG_DUNGEON_CONFIGS];
    const shooterDefinition = Object.values(config.enemies).find((enemy) => enemy.combatRole === "ranged")!;
    const shooter = {
      ...state.enemies[0]!,
      definitionId: shooterDefinition.id,
      x: state.playerX + 180,
      y: state.playerY,
      hp: shooterDefinition.maxHp,
      maxHp: shooterDefinition.maxHp,
      nextShotAtMs: state.serverTimeMs + 300,
      shotCount: 0,
    };
    const encounter = { ...state, waveCount: 1, enemies: [shooter] } satisfies ArpgDungeonCombatState;

    const next = applyArpgDungeonCombatCommand({
      state: encounter,
      graph,
      loadout: LOADOUT,
      command: command(encounter, { kind: "sync" }),
      nowMs: encounter.serverTimeMs + 1_800,
    });

    expect(next.enemies[0]!.shotCount).toBeGreaterThan(0);
    expect(next.playerHp).toBeLessThan(state.playerHp);
  });

  it("persists a Curupira root telegraph and applies its damage only when the player stays in its marked area", () => {
    const { graph, state } = startBossState();
    const armed = applyArpgDungeonCombatCommand({
      state: {
        ...state,
        enemies: [{ ...state.enemies[0]!, nextPatternAtMs: state.serverTimeMs + 50 }],
      },
      graph,
      loadout: LOADOUT,
      command: command(state, { kind: "sync" }),
      nowMs: state.serverTimeMs + 150,
    });
    const telegraph = armed.hazards[0]!;
    const armedWithoutVolley = { ...armed, projectiles: [] };

    expect(telegraph).toMatchObject({ pattern: "roots-burst", shape: "circle", radius: 86, damage: 13 });

    const stayed = applyArpgDungeonCombatCommand({
      state: armedWithoutVolley,
      graph,
      loadout: LOADOUT,
      command: command(armedWithoutVolley, { actionId: "root-stay", kind: "sync" }),
      nowMs: telegraph.detonateAtMs + 50,
    });
    expect(stayed.playerHp).toBeLessThan(armed.playerHp);
    expect(stayed.hazards).toEqual([]);
  });

  it("lets the player leave a Curupira telegraph before its server detonation", () => {
    const { graph, tiles, state } = startBossState();
    const armed = applyArpgDungeonCombatCommand({
      state: {
        ...state,
        enemies: [{ ...state.enemies[0]!, nextPatternAtMs: state.serverTimeMs + 50 }],
      },
      graph,
      loadout: LOADOUT,
      command: command(state, { kind: "sync" }),
      nowMs: state.serverTimeMs + 150,
    });
    const telegraph = armed.hazards[0]!;
    const target = findDodgePosition(
      tiles,
      { x: armed.playerX, y: armed.playerY },
      { x: armed.enemies[0]!.x, y: armed.enemies[0]!.y },
      125,
    );
    const armedWithoutVolley = { ...armed, projectiles: [] };
    const dodged = applyArpgDungeonCombatCommand({
      state: armedWithoutVolley,
      graph,
      loadout: LOADOUT,
      command: command(armedWithoutVolley, { actionId: "root-dodge", kind: "sync", playerX: target.x, playerY: target.y }),
      nowMs: telegraph.detonateAtMs + 50,
    });

    expect(dodged.playerHp).toBe(armed.playerHp);
    expect(dodged.playerX).toBe(target.x);
    expect(dodged.hazards).toEqual([]);
  });

  it("lets a server dash avoid a boss hazard that detonates on the dash input timestamp", () => {
    const { graph, state } = startBossState();
    const armed = applyArpgDungeonCombatCommand({
      state: {
        ...state,
        enemies: [{ ...state.enemies[0]!, nextPatternAtMs: state.serverTimeMs + 50 }],
      },
      graph,
      loadout: LOADOUT,
      command: command(state, { kind: "sync" }),
      nowMs: state.serverTimeMs + 150,
    });
    const telegraph = armed.hazards[0]!;
    const armedWithoutVolley = { ...armed, projectiles: [] };
    const dashed = applyArpgDungeonCombatCommand({
      state: armedWithoutVolley,
      graph,
      loadout: LOADOUT,
      command: command(armedWithoutVolley, { actionId: "root-dash", kind: "dash" }),
      nowMs: telegraph.detonateAtMs,
    });

    expect(dashed.playerHp).toBe(armedWithoutVolley.playerHp);
    expect(dashed.dashUntilMs).toBe(dashed.serverTimeMs + 170);
    expect(dashed.hazards).toEqual([]);
  });

  it("keeps active Curupira roots as server collision barriers during player movement", () => {
    const { graph, tiles, state } = startBossState();
    const origin = { x: state.playerX, y: state.playerY };
    const target = findDodgePosition(tiles, origin, state.enemies[0]!, 65);
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const barrier = {
      id: "test-root-barrier",
      pattern: "root-arena",
      shape: "rect" as const,
      x: (origin.x + target.x) / 2,
      y: (origin.y + target.y) / 2,
      radius: 0,
      width: 18,
      height: 130,
      angle: angle + Math.PI / 2,
      damage: 16,
      createdAtMs: state.serverTimeMs,
      detonateAtMs: state.serverTimeMs,
      activeUntilMs: state.serverTimeMs + 1_000,
    };
    const encounter = { ...state, hazards: [barrier] } satisfies ArpgDungeonCombatState;
    const blocked = applyArpgDungeonCombatCommand({
      state: encounter,
      graph,
      loadout: LOADOUT,
      command: command(encounter, { kind: "sync", playerX: target.x, playerY: target.y }),
      nowMs: encounter.serverTimeMs + 300,
    });

    expect({ x: blocked.playerX, y: blocked.playerY }).toEqual(origin);
    expect(blocked.hazards).toHaveLength(1);
  });

  it("keeps Curupira root-arena walls active after their telegraph detonates", () => {
    const { graph, state } = startBossState();
    const boss = state.enemies[0]!;
    const encounter = {
      ...state,
      enemies: [{
        ...boss,
        hp: Math.floor(boss.maxHp * 0.2),
        bossPhase: 3,
        nextPatternAtMs: state.serverTimeMs + 50,
      }],
    } satisfies ArpgDungeonCombatState;
    const warned = applyArpgDungeonCombatCommand({
      state: encounter,
      graph,
      loadout: LOADOUT,
      command: command(encounter, { kind: "sync" }),
      nowMs: encounter.serverTimeMs + 100,
    });
    const rootWarning = warned.hazards.find((hazard) => hazard.pattern === "root-arena")!;
    const active = applyArpgDungeonCombatCommand({
      state: { ...warned, projectiles: [] },
      graph,
      loadout: LOADOUT,
      command: command(warned, { actionId: "root-arena-active", kind: "sync" }),
      nowMs: rootWarning.detonateAtMs + 100,
    });

    expect(rootWarning.activeUntilMs).toBeGreaterThan(rootWarning.detonateAtMs);
    expect(active.hazards.some((hazard) => hazard.pattern === "root-arena" && hazard.activeUntilMs > active.serverTimeMs)).toBe(true);
  });

  it("advances a low-health Curupira into its phase-three root arena", () => {
    const { graph, state } = startBossState();
    const boss = state.enemies[0]!;
    const encounter = {
      ...state,
      enemies: [{
        ...boss,
        hp: Math.floor(boss.maxHp * 0.2),
        bossPhase: 2,
        bossPatternIndex: 1,
        nextPatternAtMs: state.serverTimeMs + 50,
      }],
    } satisfies ArpgDungeonCombatState;
    const next = applyArpgDungeonCombatCommand({
      state: encounter,
      graph,
      loadout: LOADOUT,
      command: command(encounter, { kind: "sync" }),
      nowMs: encounter.serverTimeMs + 100,
    });

    expect(next.enemies[0]).toMatchObject({ bossPhase: 3, bossPattern: "root-arena", bossPatternIndex: 1 });
    expect(next.hazards.some((hazard) => hazard.pattern === "root-arena" && hazard.activeUntilMs > hazard.detonateAtMs)).toBe(true);
  });

  it.each([
    ["arquipelago-das-mares", "undertow-sweep"],
    ["montanhas-runicas", "ice-lanes"],
  ] as const)("uses the %s boss's phase-two attack pattern on the server", (regionId, expectedPattern) => {
    const { graph, state } = startBossState(regionId);
    const boss = state.enemies[0]!;
    const encounter = {
      ...state,
      enemies: [{ ...boss, hp: Math.floor(boss.maxHp / 2), bossPhase: 2, nextPatternAtMs: state.serverTimeMs + 50 }],
    } satisfies ArpgDungeonCombatState;
    const next = applyArpgDungeonCombatCommand({
      state: encounter,
      graph,
      loadout: LOADOUT,
      command: command(encounter, { kind: "sync" }),
      nowMs: encounter.serverTimeMs + 150,
    });

    expect(next.enemies[0]!.bossPattern).toBe(expectedPattern);
    expect(next.hazards.length).toBeGreaterThan(0);
    expect(next.hazards.every((hazard) => hazard.shape === "rect")).toBe(true);
  });

  it("advances Curupira through its guarded phase transition and starts its decoy ambush", () => {
    const { graph, state } = startBossState();
    const boss = state.enemies[0]!;
    const encounter = {
      ...state,
      enemies: [{
        ...boss,
        hp: Math.floor(boss.maxHp / 2),
        bossPatternIndex: 1,
        nextPatternAtMs: state.serverTimeMs + 50,
      }],
    } satisfies ArpgDungeonCombatState;
    const next = applyArpgDungeonCombatCommand({
      state: encounter,
      graph,
      loadout: LOADOUT,
      command: command(encounter, { kind: "sync" }),
      nowMs: encounter.serverTimeMs + 150,
    });

    expect(next.enemies[0]).toMatchObject({ bossPhase: 2, bossPattern: "decoy-ambush", bossPatternIndex: 1 });
    expect(next.hazards[0]).toMatchObject({ pattern: "decoy-ambush", shape: "circle" });
  });
});
