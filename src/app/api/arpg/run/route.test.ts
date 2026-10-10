import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, getClaimsMock, loadoutQueryMock, ownershipQueryMock, loadoutFromMock } = vi.hoisted(() => {
  const mocks = {
    rpcMock: vi.fn(),
    getClaimsMock: vi.fn(),
    loadoutQueryMock: vi.fn(),
    ownershipQueryMock: vi.fn(),
    loadoutFromMock: vi.fn(),
  };
  mocks.loadoutFromMock.mockImplementation((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => table === "player_arpg_loadouts"
        ? { maybeSingle: mocks.loadoutQueryMock }
        : { in: vi.fn((column: string, values: string[]) => mocks.ownershipQueryMock(column, values)) }),
    })),
  }));
  return mocks;
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: loadoutFromMock }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => true,
}));

import { GET, POST } from "./route";
import { verifyArpgRunToken } from "@/lib/arpg-run-token";
import { connectedRoomIds } from "@/game/arpg/dungeon/graph";
import { buildRoomTileData, createSafeRoomSpawnPoints } from "@/game/arpg/dungeon/room-tilemap";
import { createBreakableObjectPlacements } from "@/game/arpg/dungeon/breakable-objects";
import { populateArpgDungeonContent } from "@/game/arpg/dungeon/content";
import { getArpgCombatRewardDeltas } from "@/game/arpg/dungeon/run-checkpoint";
import { ARPG_RELIC_BY_ID, getRelicXpMultiplier } from "@/game/arpg/content/relics";
import { createArpgDungeonCombatState, type ArpgDungeonCombatState } from "@/game/arpg/dungeon/combat-authority";

const PLAYER_ID = "10000000-0000-4000-8000-000000000001";

function post(body: unknown) {
  return POST(new Request("http://localhost/api/arpg/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

async function beginPersistedRun(body: unknown = { action: "start", expeditionId: "mata-encantada" }) {
  rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name !== "begin_or_resume_arpg_run") return { data: null, error: null };
    return {
      data: {
        runId: args.target_run_id,
        expeditionId: args.target_expedition_id,
        dungeonSeed: args.target_dungeon_seed,
        startRoomId: args.target_start_room_id,
        bossRoomId: args.target_boss_room_id,
        lootItemIds: args.target_loot_item_ids,
        token: args.target_signed_token,
        checkpoint: args.target_checkpoint,
        revision: 0,
        resumed: false,
      },
      error: null,
    };
  });
  const response = await post(body);
  expect(response.status).toBe(200);
  return await response.json() as {
    token: string;
    runId: string;
    runSeed: string;
    checkpoint: Record<string, unknown>;
    loadout?: {
      weaponId: string;
      armorId: string;
      relicId: string;
      abilityIds: [string, string];
    };
    revision: number;
    persistent: boolean;
  };
}

function activeRunPayload(
  run: Awaited<ReturnType<typeof beginPersistedRun>>,
  checkpoint: Record<string, unknown> = run.checkpoint,
) {
  return {
    runId: run.runId,
    expeditionId: "mata-encantada",
    dungeonSeed: run.runSeed,
    checkpoint,
    status: "active",
    updatedAt: "2026-10-03T10:00:00.000Z",
    expiresAt: "2026-10-10T10:00:00.000Z",
  };
}

function combatEntryPosition(
  graph: Awaited<ReturnType<typeof import("@/game/arpg/dungeon/generator").generateDungeon>>,
  roomId: string,
  clearedRoomIds: string[],
) {
  const room = graph.rooms[roomId]!;
  const parentRoomId = clearedRoomIds.at(-1);
  const entryDirection = (Object.entries(room.connections) as Array<["north" | "south" | "east" | "west", string | undefined]>)
    .find(([, neighborId]) => neighborId === parentRoomId)?.[0];
  if (!entryDirection) throw new Error("A sala de combate não tem conexão de entrada no caminho escolhido.");
  const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
  const width = tiles.width * 32;
  const height = tiles.height * 32;
  if (entryDirection === "north") return { x: width / 2, y: 28 };
  if (entryDirection === "south") return { x: width / 2, y: height - 28 };
  if (entryDirection === "west") return { x: 28, y: height / 2 };
  return { x: width - 28, y: height / 2 };
}

async function getCombatRoomCheckpoints(
  run: Awaited<ReturnType<typeof beginPersistedRun>>,
  roomType?: "combat" | "elite" | "boss",
) {
  const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
  const graph = generateDungeon({ seed: run.runSeed, regionId: "mata-encantada" });
  const room = Object.values(graph.rooms).find((current) => (
    roomType ? current.type === roomType : current.type === "combat" || current.type === "elite" || current.type === "boss"
  ))!;
  const parents = new Map<string, string | null>([[graph.startRoomId, null]]);
  const queue = [graph.startRoomId];
  while (queue.length > 0 && !parents.has(room.id)) {
    const currentId = queue.shift()!;
    for (const nextId of connectedRoomIds(graph.rooms[currentId])) {
      if (parents.has(nextId)) continue;
      parents.set(nextId, currentId);
      queue.push(nextId);
    }
  }
  const path: string[] = [];
  for (let currentId: string | null = room.id; currentId; currentId = parents.get(currentId) ?? null) {
    path.unshift(currentId);
  }
  const entered = {
    ...run.checkpoint,
    currentRoomId: room.id,
    visitedRoomIds: path,
    clearedRoomIds: path.slice(0, -1),
  };
  return {
    graph,
    roomId: room.id,
    entered,
    cleared: { ...entered, clearedRoomIds: path },
  };
}

function createVictoryState(
  run: Awaited<ReturnType<typeof beginPersistedRun>>,
  graph: Awaited<ReturnType<typeof import("@/game/arpg/dungeon/generator").generateDungeon>>,
  roomId: string,
  checkpoint: Record<string, unknown>,
) {
  populateArpgDungeonContent(graph);
  const room = graph.rooms[roomId]!;
  const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
  const spawn = createSafeRoomSpawnPoints(tiles, 1)[0]!;
  const loadout = verifyArpgRunToken(run.token).initialLoadout!;
  const relic = ARPG_RELIC_BY_ID.get(loadout.relicId)!;
  const xpMultiplier = getRelicXpMultiplier(relic);
  const state = createArpgDungeonCombatState({
    graph,
    roomId,
    loadout: {
      ...loadout,
      weaponId: checkpoint.weaponId as string,
      armorId: checkpoint.armorId as string,
    },
    playerHp: checkpoint.playerHp as number,
    maxHp: checkpoint.maxHp as number,
    playerX: spawn.x,
    playerY: spawn.y,
    runMoveSpeedBonus: checkpoint.runMoveSpeedBonus as number,
    runBasicDamageMultiplier: checkpoint.runBasicDamageMultiplier as number,
    xpMultiplier,
    baseXpEarned: checkpoint.xpEarned as number,
    baseRunShards: checkpoint.runShards as number,
    nowMs: 1_000,
  });
  const rewards = getArpgCombatRewardDeltas(graph, roomId, xpMultiplier)!;
  return {
    rewards,
    state: {
      ...state,
      status: "victory" as const,
      waveIndex: state.waveCount - 1,
      xpEarned: rewards.xp,
      runShards: rewards.runShards,
      enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0, alive: false })),
    },
  };
}

describe("/api/arpg/run durable run endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GAME_ACTION_SECRET = "durable-run-route-test-secret";
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: PLAYER_ID } }, error: null });
    loadoutQueryMock.mockResolvedValue({ data: null, error: null });
    ownershipQueryMock.mockResolvedValue({
      data: [
        "curupira-root-snare", "curupira-ember-arrow",
        "iara-enchanting-song", "iara-living-spring",
        "iara-song-staff", "iara-shell-charm",
      ].map((item_key) => ({ item_key, quantity: 1 })),
      error: null,
    });
  });

  it("starts a signed persistent run with a reproducible checkpoint", async () => {
    const run = await beginPersistedRun();

    expect(run.persistent).toBe(true);
    expect(run.runSeed).toContain("mata-encantada:encounters-v3:");
    expect(run.checkpoint.currentRoomId).toBe("room-0");
    expect(rpcMock).toHaveBeenCalledWith("begin_or_resume_arpg_run", expect.objectContaining({
      target_player_id: PLAYER_ID,
      target_run_id: run.runId,
      target_dungeon_seed: run.runSeed,
    }));
  });

  it("rejects a third equipped attack slot at the encounter boundary", async () => {
    const response = await post({
      action: "encounter",
      token: "x".repeat(32),
      expectedRevision: 0,
      roomId: "room-1",
      command: {
        actionId: "third-attack",
        kind: "ability",
        playerX: 100,
        playerY: 100,
        aimX: 1,
        aimY: 0,
        abilitySlot: 2,
      },
    });

    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("freezes the database-owned Arsenal loadout into the signed run token and start checkpoint", async () => {
    const savedLoadout = {
      weaponId: "iara-song-staff",
      armorId: "leather-armor",
      relicId: "iara-shell-charm",
      abilityIds: ["iara-enchanting-song", "iara-living-spring"],
    };
    loadoutQueryMock.mockResolvedValue({
      data: {
        weapon_id: savedLoadout.weaponId,
        armor_id: savedLoadout.armorId,
        relic_id: savedLoadout.relicId,
        ability_ids: savedLoadout.abilityIds,
      },
      error: null,
    });

    const run = await beginPersistedRun({
      action: "start",
      expeditionId: "mata-encantada",
      loadout: { weaponId: "iron-sword" },
    });

    const expectedLoadout = {
      weaponId: savedLoadout.weaponId,
      armorId: savedLoadout.armorId,
      relicId: savedLoadout.relicId,
      abilityIds: ["iara-enchanting-song", "iara-living-spring"],
    };
    expect(run.loadout).toEqual(expectedLoadout);
    expect(run.loadout).not.toHaveProperty("supportIds");
    expect(run.checkpoint).toMatchObject({
      weaponId: savedLoadout.weaponId,
      armorId: savedLoadout.armorId,
      maxHp: 120,
    });
    expect(verifyArpgRunToken(run.token).initialLoadout).toEqual(expectedLoadout);
  });

  it("rejects an invalid database loadout instead of signing it into a run", async () => {
    loadoutQueryMock.mockResolvedValue({
      data: {
        weapon_id: "invented-weapon",
        armor_id: "leather-armor",
        relic_id: "cartographer-compass",
        ability_ids: ["curupira-root-snare", "curupira-ember-arrow"],
      },
      error: null,
    });
    const response = await post({ action: "start", expeditionId: "mata-encantada" });

    expect(response.status).toBe(409);
    expect(rpcMock).not.toHaveBeenCalledWith("begin_or_resume_arpg_run", expect.anything());
  });

  it.each([
    {
      description: "a mixed pair from different legends",
      abilityIds: ["curupira-root-snare", "iara-living-spring"],
    },
    {
      description: "a legacy generic pair",
      abilityIds: ["ancestral-roots", "boitata-flame"],
    },
  ])("rejects $description before creating a run", async ({ abilityIds }) => {
    loadoutQueryMock.mockResolvedValue({
      data: {
        weapon_id: "forest-bow",
        armor_id: "leather-armor",
        relic_id: "cartographer-compass",
        ability_ids: abilityIds,
      },
      error: null,
    });
    ownershipQueryMock.mockResolvedValue({
      data: abilityIds.map((item_key) => ({ item_key, quantity: 1 })),
      error: null,
    });

    const response = await post({ action: "start", expeditionId: "mata-encantada" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("exatamente seus dois poderes de assinatura"),
    });
    expect(ownershipQueryMock).toHaveBeenCalledWith("item_key", expect.arrayContaining(abilityIds));
    expect(rpcMock).not.toHaveBeenCalledWith("begin_or_resume_arpg_run", expect.anything());
  });

  it("requires the account inventory to own both powers before creating a persistent run", async () => {
    ownershipQueryMock.mockResolvedValue({
      data: [{ item_key: "curupira-root-snare", quantity: 1 }],
      error: null,
    });

    const response = await post({ action: "start", expeditionId: "mata-encantada" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("não possui") });
    expect(rpcMock).not.toHaveBeenCalledWith("begin_or_resume_arpg_run", expect.anything());
  });

  it("fails closed when the server cannot read inventory ownership", async () => {
    ownershipQueryMock.mockResolvedValue({ data: null, error: { code: "XX000" } });

    const response = await post({ action: "start", expeditionId: "mata-encantada" });

    expect(response.status).toBe(500);
    expect(rpcMock).not.toHaveBeenCalledWith("begin_or_resume_arpg_run", expect.anything());
  });

  it("resumes with the original signed loadout after the Arsenal changes", async () => {
    const originalLoadout = {
      weaponId: "iara-song-staff",
      armorId: "leather-armor",
      relicId: "iara-shell-charm",
      abilityIds: ["iara-enchanting-song", "iara-living-spring"] as [string, string],
    };
    loadoutQueryMock.mockResolvedValue({
      data: {
        weapon_id: originalLoadout.weaponId,
        armor_id: originalLoadout.armorId,
        relic_id: originalLoadout.relicId,
        ability_ids: originalLoadout.abilityIds,
      },
      error: null,
    });
    const run = await beginPersistedRun();
    const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
    const graph = generateDungeon({ seed: run.runSeed, regionId: "mata-encantada" });
    loadoutQueryMock.mockResolvedValue({
      data: {
        weapon_id: "forest-bow",
        armor_id: "leather-armor",
        relic_id: "cartographer-compass",
        ability_ids: ["curupira-root-snare", "curupira-ember-arrow"],
      },
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: {
        runId: run.runId,
        expeditionId: "mata-encantada",
        dungeonSeed: run.runSeed,
        startRoomId: graph.startRoomId,
        bossRoomId: graph.bossRoomId,
        lootItemIds: verifyArpgRunToken(run.token).lootItemIds,
        token: run.token,
        checkpoint: run.checkpoint,
        revision: 1,
        resumed: true,
      },
      error: null,
    });

    const response = await post({ action: "start", expeditionId: "mata-encantada" });
    const resumed = await response.json();

    expect(response.status).toBe(200);
    expect(resumed.resumed).toBe(true);
    const expectedLoadout = {
      weaponId: originalLoadout.weaponId,
      armorId: originalLoadout.armorId,
      relicId: originalLoadout.relicId,
      abilityIds: ["iara-enchanting-song", "iara-living-spring"],
    };
    expect(resumed.loadout).toEqual(expectedLoadout);
    expect(verifyArpgRunToken(resumed.token).initialLoadout).toEqual(expectedLoadout);
  });

  it("rejects a resumed snapshot if the account no longer owns one of its powers", async () => {
    const originalLoadout = {
      weaponId: "iara-song-staff",
      armorId: "leather-armor",
      relicId: "iara-shell-charm",
      abilityIds: ["iara-enchanting-song", "iara-living-spring"] as [string, string],
    };
    loadoutQueryMock.mockResolvedValue({ data: null, error: null });
    const existingRun = await beginPersistedRun();
    const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
    const graph = generateDungeon({ seed: existingRun.runSeed, regionId: "mata-encantada" });
    const { token } = await import("@/lib/arpg-run-token").then(({ createArpgRunToken }) => createArpgRunToken(
      PLAYER_ID,
      "mata-encantada",
      verifyArpgRunToken(existingRun.token).lootItemIds,
      originalLoadout,
    ));
    rpcMock.mockResolvedValue({
      data: {
        runId: existingRun.runId,
        expeditionId: "mata-encantada",
        dungeonSeed: existingRun.runSeed,
        startRoomId: graph.startRoomId,
        bossRoomId: graph.bossRoomId,
        lootItemIds: verifyArpgRunToken(existingRun.token).lootItemIds,
        token,
        checkpoint: existingRun.checkpoint,
        revision: 1,
        resumed: true,
      },
      error: null,
    });
    ownershipQueryMock
      .mockResolvedValueOnce({
        data: ["curupira-root-snare", "curupira-ember-arrow"].map((item_key) => ({ item_key, quantity: 1 })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          "iara-song-staff", "iara-shell-charm", "iara-enchanting-song",
        ].map((item_key) => ({ item_key, quantity: 1 })),
        error: null,
      });

    const response = await post({ action: "start", expeditionId: "mata-encantada" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("run salva") });
  });

  it("rejects a checkpoint that jumps directly to the boss room", async () => {
    const run = await beginPersistedRun();
    const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
    const graph = generateDungeon({ seed: run.runSeed, regionId: "mata-encantada" });
    const invalidCheckpoint = { ...run.checkpoint, currentRoomId: graph.bossRoomId };
    rpcMock.mockImplementation(async (name: string) => name === "get_active_arpg_run"
      ? { data: activeRunPayload(run), error: null }
      : { data: null, error: null });
    const callsBefore = rpcMock.mock.calls.length;

    const response = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: run.revision,
      checkpoint: invalidCheckpoint,
    });

    expect(response.status).toBe(409);
    expect(rpcMock).toHaveBeenCalledTimes(callsBefore);
    expect(rpcMock).not.toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.anything());
  });

  it("rejects a graph-valid boss victory forged in a single checkpoint", async () => {
    const run = await beginPersistedRun();
    const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
    const graph = generateDungeon({ seed: run.runSeed, regionId: "mata-encantada" });
    rpcMock.mockImplementation(async (name: string) => name === "get_active_arpg_run"
      ? { data: activeRunPayload(run), error: null }
      : { data: null, error: null });

    const response = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: run.revision,
      checkpoint: {
        ...run.checkpoint,
        currentRoomId: graph.bossRoomId,
        clearedRoomIds: Object.keys(graph.rooms),
        exitPortalAvailable: true,
      },
    });

    expect(response.status).toBe(409);
    expect(rpcMock).not.toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.anything());
  });

  it("serializes checkpoints by revision and refuses extraction without a boss combat proof", async () => {
    const run = await beginPersistedRun();
    const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
    const graph = generateDungeon({ seed: run.runSeed, regionId: "mata-encantada" });
    const firstRoomId = Object.values(graph.rooms)
      .find((room) => Object.values(room.connections).includes(graph.startRoomId))!.id;
    const nextCheckpoint = {
      ...run.checkpoint,
      currentRoomId: firstRoomId,
      visitedRoomIds: [graph.startRoomId, firstRoomId],
      clearedRoomIds: run.checkpoint.clearedRoomIds,
    };
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "get_active_arpg_run") {
        return { data: activeRunPayload(run), error: null };
      }
      if (name === "save_arpg_run_checkpoint") {
        return { data: { conflict: false, revision: 1, checkpoint: nextCheckpoint }, error: null };
      }
      if (name === "finish_arpg_run") {
        return {
          data: {
            coins: 60,
            xp: 120,
            victory: true,
            items: [],
            runLootItems: [],
            persisted: true,
            replayed: false,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const checkpoint = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: 0,
      checkpoint: nextCheckpoint,
    });
    expect(checkpoint.status).toBe(200);
    expect(await checkpoint.json()).toMatchObject({ persisted: true, revision: 1 });

    const finished = await post({ action: "complete", token: run.token, victory: true });
    expect(finished.status).toBe(409);
    expect(rpcMock).not.toHaveBeenCalledWith("finish_arpg_run", expect.anything());
  });

  it("accepts a room clear backed by a stored server victory and its exact rewards", async () => {
    const run = await beginPersistedRun();
    const { graph, roomId, entered, cleared } = await getCombatRoomCheckpoints(run);
    const { state, rewards } = createVictoryState(run, graph, roomId, entered);
    const serverCheckpoint = {
      ...entered,
      playerHp: state.playerHp,
      xpEarned: state.baseXpEarned + rewards.xp,
      runShards: state.baseRunShards + rewards.runShards,
      serverCombatState: state,
    };
    const clearedCheckpoint = {
      ...cleared,
      playerHp: serverCheckpoint.playerHp,
      xpEarned: serverCheckpoint.xpEarned,
      runShards: serverCheckpoint.runShards,
    };
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "get_active_arpg_run") {
        return { data: activeRunPayload(run, serverCheckpoint), error: null };
      }
      if (name === "save_arpg_run_checkpoint") {
        return { data: { conflict: false, revision: 2, checkpoint: { ...clearedCheckpoint, serverCombatState: state } }, error: null };
      }
      return { data: null, error: null };
    });

    const response = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: 1,
      checkpoint: clearedCheckpoint,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ persisted: true, revision: 2 });
    expect(rpcMock).toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.objectContaining({
      target_expected_revision: 1,
      target_checkpoint: expect.objectContaining({
        currentRoomId: roomId,
        serverCombatState: expect.objectContaining({ roomId, status: "victory" }),
      }),
    }));
  });

  it("finishes a boss run only from its persisted server victory and portal checkpoint", async () => {
    const run = await beginPersistedRun();
    const { generateDungeon } = await import("@/game/arpg/dungeon/generator");
    const graph = generateDungeon({ seed: run.runSeed, regionId: "mata-encantada" });
    const { state, rewards } = createVictoryState(run, graph, graph.bossRoomId, run.checkpoint);
    const bossCheckpoint = {
      ...run.checkpoint,
      currentRoomId: graph.bossRoomId,
      visitedRoomIds: Object.keys(graph.rooms),
      clearedRoomIds: Object.keys(graph.rooms),
      playerHp: state.playerHp,
      xpEarned: state.baseXpEarned + rewards.xp,
      runShards: state.baseRunShards + rewards.runShards,
      rewardRoomId: null,
      exitPortalAvailable: true,
      serverCombatState: state,
    };
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "get_arpg_run_for_completion") {
        return { data: activeRunPayload(run, bossCheckpoint), error: null };
      }
      if (name === "finish_arpg_run") {
        return {
          data: { coins: 60, xp: 120, victory: true, items: [], persisted: true, replayed: false },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await post({ action: "complete", token: run.token, victory: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ persisted: true, reward: { victory: true } });
    expect(rpcMock).toHaveBeenCalledWith("finish_arpg_run", expect.objectContaining({
      target_player_id: PLAYER_ID,
      target_run_id: run.runId,
      target_victory: true,
    }));
  });

  it("rejects a combat clear without server combat proof even when plenty of time elapsed", async () => {
    const run = await beginPersistedRun();
    const { entered, cleared } = await getCombatRoomCheckpoints(run);
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "get_active_arpg_run") {
        return {
          data: {
            ...activeRunPayload(run),
            checkpoint: entered,
            updatedAt: new Date(Date.now() - 60_000).toISOString(),
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: 1,
      checkpoint: cleared,
    });

    expect(response.status).toBe(409);
    expect(rpcMock).not.toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.anything());
  });

  it("rejects a client checkpoint that attempts to inject the server combat state", async () => {
    const run = await beginPersistedRun();
    const response = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: 0,
      checkpoint: { ...run.checkpoint, serverCombatState: {} },
    });

    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.anything());
  });

  it("initializes and persists a seeded encounter from the physical room entrance", async () => {
    const run = await beginPersistedRun();
    const { graph, roomId, entered } = await getCombatRoomCheckpoints(run);
    const entry = combatEntryPosition(graph, roomId, entered.clearedRoomIds);
    let savedCheckpoint: Record<string, unknown> = entered;
    let revision = 4;
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_active_arpg_run") {
        return { data: { ...activeRunPayload(run, savedCheckpoint), revision }, error: null };
      }
      if (name === "save_arpg_run_checkpoint") {
        savedCheckpoint = args.target_checkpoint as Record<string, unknown>;
        revision += 1;
        return { data: { conflict: false, revision, checkpoint: savedCheckpoint }, error: null };
      }
      return { data: null, error: null };
    });

    const response = await post({
      action: "encounter",
      token: run.token,
      expectedRevision: revision,
      roomId,
      command: {
        actionId: "start-encounter",
        kind: "sync",
        playerX: entry.x,
        playerY: entry.y,
        aimX: 1,
        aimY: 0,
      },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ authoritative: true, revision: 5, state: { roomId, status: "combat" } });
    expect(savedCheckpoint.serverCombatState).toMatchObject({ roomId, playerX: entry.x, playerY: entry.y });
    const startedState = payload.state as ArpgDungeonCombatState;
    expect(rpcMock).toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.objectContaining({
      target_player_id: PLAYER_ID,
      target_expected_revision: 4,
    }));

    const breakable = createBreakableObjectPlacements(graph.seed, graph.rooms[roomId]!, graph.regionId)[0]!;
    const clientCheckpoint = Object.fromEntries(
      Object.entries(savedCheckpoint).filter(([key]) => key !== "serverCombatState"),
    );
    const brokenCheckpoint = await post({
      action: "checkpoint",
      token: run.token,
      expectedRevision: 5,
      checkpoint: {
        ...clientCheckpoint,
        brokenBreakableIds: [breakable.id],
        runShards: (savedCheckpoint.runShards as number) + 1,
      },
    });
    expect(brokenCheckpoint.status).toBe(200);
    expect(savedCheckpoint).toMatchObject({
      brokenBreakableIds: [breakable.id],
      runShards: 1,
      serverCombatState: { baseRunShards: 1 },
    });

    const entryDirection = (Object.entries(graph.rooms[roomId]!.connections) as Array<["north" | "south" | "east" | "west", string | undefined]>)
      .find(([, neighborId]) => neighborId === entered.clearedRoomIds.at(-1))?.[0];
    const moved = { ...entry };
    if (entryDirection === "north") moved.y += 40;
    else if (entryDirection === "south") moved.y -= 40;
    else if (entryDirection === "west") moved.x += 40;
    else if (entryDirection === "east") moved.x -= 40;
    else throw new Error("Não foi possível determinar a direção da entrada da sala.");

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(startedState.serverTimeMs + 500);
    try {
      const resumed = await post({
        action: "encounter",
        token: run.token,
        expectedRevision: 6,
        roomId,
        command: {
          actionId: "resume-sync",
          kind: "sync",
          playerX: moved.x,
          playerY: moved.y,
          aimX: 1,
          aimY: 0,
        },
      });
      expect(resumed.status).toBe(200);
      expect(await resumed.json()).toMatchObject({
        revision: 7,
        state: { playerX: moved.x, playerY: moved.y, baseRunShards: 1 },
      });
      expect(savedCheckpoint.runShards).toBe(1);

      const teleport = await post({
        action: "encounter",
        token: run.token,
        expectedRevision: 7,
        roomId,
        command: {
          actionId: "resume-teleport",
          kind: "sync",
          playerX: moved.x + 1_000,
          playerY: moved.y,
          aimX: 1,
          aimY: 0,
        },
      });
      expect(teleport.status).toBe(409);
      expect(await teleport.json()).toMatchObject({ error: "O movimento informado excede a velocidade ou atravessa um obstáculo." });
      expect(savedCheckpoint.serverCombatState).toMatchObject({ playerX: moved.x, playerY: moved.y });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("persists an authoritative Curupira telegraph through the authenticated encounter route", async () => {
    const run = await beginPersistedRun();
    const { graph, roomId, entered } = await getCombatRoomCheckpoints(run, "boss");
    const entry = combatEntryPosition(graph, roomId, entered.clearedRoomIds);
    let savedCheckpoint: Record<string, unknown> = entered;
    let revision = 7;
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_active_arpg_run") {
        return { data: { ...activeRunPayload(run, savedCheckpoint), revision }, error: null };
      }
      if (name === "save_arpg_run_checkpoint") {
        savedCheckpoint = args.target_checkpoint as Record<string, unknown>;
        revision += 1;
        return { data: { conflict: false, revision, checkpoint: savedCheckpoint }, error: null };
      }
      return { data: null, error: null };
    });

    const started = await post({
      action: "encounter",
      token: run.token,
      expectedRevision: revision,
      roomId,
      command: {
        actionId: "boss-entry",
        kind: "sync",
        playerX: entry.x,
        playerY: entry.y,
        aimX: 1,
        aimY: 0,
      },
    });
    expect(started.status).toBe(200);
    const firstPayload = await started.json() as { revision: number; state: ArpgDungeonCombatState };
    expect(firstPayload.state.enemies.some((enemy) => enemy.definitionId === "boss")).toBe(true);

    const storedState = savedCheckpoint.serverCombatState as ArpgDungeonCombatState;
    savedCheckpoint = {
      ...savedCheckpoint,
      serverCombatState: {
        ...storedState,
        bossEncounter: undefined, // Resume a historical pre-cinematic encounter.
        enemies: storedState.enemies.map((enemy) => enemy.definitionId === "boss"
          ? {
            ...enemy,
            // Keep the deterministic boss telegraph inside its authoritative
            // attack radius. The generated boss spawn may be farther than the
            // ranged threshold from the physical doorway used to enter a room.
            x: entry.x,
            y: entry.y,
            bossPhase: 1,
            bossPatternIndex: 0,
            nextPatternAtMs: storedState.serverTimeMs + 50,
          }
          : enemy),
      },
    };
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(storedState.serverTimeMs + 150);
    const attacked = await post({
      action: "encounter",
      token: run.token,
      expectedRevision: firstPayload.revision,
      roomId,
      command: {
        actionId: "boss-telegraph",
        kind: "sync",
        playerX: entry.x,
        playerY: entry.y,
        aimX: 1,
        aimY: 0,
      },
    });
    nowSpy.mockRestore();

    expect(attacked.status).toBe(200);
    const secondPayload = await attacked.json() as { revision: number; state: ArpgDungeonCombatState };
    expect(secondPayload.state.enemies.find((enemy) => enemy.definitionId === "boss")?.bossPattern).toBe("roots-burst");
    expect(secondPayload.state.hazards).toMatchObject([
      expect.objectContaining({ pattern: "roots-burst", shape: "circle", damage: 13 }),
    ]);
    expect(savedCheckpoint.serverCombatState).toMatchObject({
      roomId,
      hazards: [expect.objectContaining({ pattern: "roots-burst" })],
    });
    expect(rpcMock).toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.objectContaining({
      target_expected_revision: firstPayload.revision,
      target_checkpoint: expect.objectContaining({
        serverCombatState: expect.objectContaining({
          roomId,
          hazards: [expect.objectContaining({ pattern: "roots-burst" })],
        }),
      }),
    }));
  });

  it("rejects starting an encounter from anywhere other than a connected doorway", async () => {
    const run = await beginPersistedRun();
    const { roomId, entered } = await getCombatRoomCheckpoints(run);
    rpcMock.mockImplementation(async (name: string) => name === "get_active_arpg_run"
      ? { data: activeRunPayload(run, entered), error: null }
      : { data: null, error: null });
    const callsBefore = rpcMock.mock.calls.length;

    const response = await post({
      action: "encounter",
      token: run.token,
      expectedRevision: 1,
      roomId,
      command: { actionId: "forged-entry", kind: "sync", playerX: 300, playerY: 300, aimX: 1, aimY: 0 },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "O combate precisa começar na entrada física da sala." });
    expect(rpcMock).not.toHaveBeenCalledWith("save_arpg_run_checkpoint", expect.anything());
    expect(rpcMock.mock.calls.length).toBe(callsBefore + 1);
  });

  it("returns only the authenticated player's active run summary", async () => {
    const run = await beginPersistedRun();
    const startArgs = rpcMock.mock.calls.find(([name]) => name === "begin_or_resume_arpg_run")?.[1] as Record<string, unknown>;
    rpcMock.mockResolvedValue({
      data: {
        runId: run.runId,
        expeditionId: "mata-encantada",
        dungeonSeed: run.runSeed,
        checkpoint: run.checkpoint,
        updatedAt: "2026-10-03T10:00:00.000Z",
        expiresAt: "2026-10-10T10:00:00.000Z",
      },
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      persistent: true,
      activeRun: { runId: run.runId, expeditionId: "mata-encantada", currentRoom: 1 },
    });
    expect(rpcMock).toHaveBeenLastCalledWith("get_active_arpg_run", { target_player_id: PLAYER_ID });
    expect(startArgs.target_player_id).toBe(PLAYER_ID);
  });
});
