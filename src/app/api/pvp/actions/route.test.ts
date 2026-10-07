import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPvpRealtimeDuel } from "@/game/pvp/realtime";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { PvpBattleAccessError } from "@/server/pvp/battles";

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  isSupabaseAdminConfigured: vi.fn(),
  getClaims: vi.fn(),
  loadBattle: vi.fn(),
  actionMaybeSingle: vi.fn(),
  battleMaybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
  isSupabaseAdminConfigured: mocks.isSupabaseAdminConfigured,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims } }),
}));
vi.mock("@/server/pvp/battles", () => ({
  loadAuthoritativePvpBattle: mocks.loadBattle,
  PvpBattleAccessError: class PvpBattleAccessError extends Error {},
  PvpBattleHistoricalError: class PvpBattleHistoricalError extends Error {},
}));

import { POST } from "./route";

const PLAYER_ONE = "10000000-0000-4000-8000-000000000001";
const PLAYER_TWO = "20000000-0000-4000-8000-000000000002";
const BATTLE_ID = "30000000-0000-4000-8000-000000000003";
const ACTION_ID = "40000000-0000-4000-8000-000000000004";

function duel() {
  return createPvpRealtimeDuel(BATTLE_ID, [
    {
      id: PLAYER_ONE,
      name: "Curupira",
      avatarConfig: { ...DEFAULT_AVATAR_CONFIG, legendId: "curupira" },
      abilityIds: ["curupira-root-snare", "curupira-ember-arrow"],
    },
    {
      id: PLAYER_TWO,
      name: "Iara",
      avatarConfig: { ...DEFAULT_AVATAR_CONFIG, legendId: "iara", favoriteLegendId: "iara" },
      abilityIds: ["iara-enchanting-song", "iara-living-spring"],
    },
  ], 1_000);
}

function request(body: unknown) {
  return new Request("http://localhost/api/pvp/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    action: "attack",
    battleId: BATTLE_ID,
    expectedVersion: 1,
    actionId: ACTION_ID,
    ...overrides,
  };
}

function admin() {
  const actionQuery = {
    select: vi.fn(() => actionQuery),
    eq: vi.fn(() => actionQuery),
    maybeSingle: mocks.actionMaybeSingle,
  };
  const battleQuery = {
    select: vi.fn(() => battleQuery),
    eq: vi.fn(() => battleQuery),
    maybeSingle: mocks.battleMaybeSingle,
  };
  return {
    from: vi.fn((table: string) => table === "battle_actions" ? actionQuery : battleQuery),
    rpc: mocks.rpc,
  };
}

describe("POST /api/pvp/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.isSupabaseAdminConfigured.mockReturnValue(true);
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: PLAYER_ONE } }, error: null });
    mocks.actionMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.battleMaybeSingle.mockResolvedValue({ data: { version: 2 }, error: null });
    mocks.rpc.mockResolvedValue({ data: { state: duel(), events: [], version: 2 }, error: null });
    mocks.loadBattle.mockImplementation(async () => ({
      admin: admin(),
      battle: { id: BATTLE_ID, version: 1, state: duel() },
    }));
  });

  it("requires an authenticated participant before committing a server-authoritative command", async () => {
    const response = await POST(request(action()));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.version).toBe(2);
    expect(payload.authority).toBe("server");
    expect(payload.state.processedActionIds).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledWith("commit_pvp_action", expect.objectContaining({
      target_battle_id: BATTLE_ID,
      acting_user_id: PLAYER_ONE,
      expected_version: 1,
      target_client_action_id: ACTION_ID,
      target_action_type: "attack",
    }));
  });

  it("rejects unauthenticated commands without loading battle state", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await POST(request(action()));

    expect(response.status).toBe(401);
    expect(mocks.loadBattle).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns the current version on a stale compare-and-swap request", async () => {
    mocks.loadBattle.mockImplementation(async () => ({
      admin: admin(),
      battle: { id: BATTLE_ID, version: 4, state: duel() },
    }));

    const response = await POST(request(action()));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ conflict: true, currentVersion: 4 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refreshes the current version when the atomic RPC wins a race", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    mocks.battleMaybeSingle.mockResolvedValue({ data: { version: 5 }, error: null });

    const response = await POST(request(action()));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ conflict: true, currentVersion: 5 });
  });

  it("returns the stored participant projection for a repeated idempotency key", async () => {
    const prior = duel();
    mocks.actionMaybeSingle.mockResolvedValue({
      data: { action_type: "attack", payload: action(), result: { state: prior, events: [], version: 2 } },
      error: null,
    });

    const response = await POST(request(action()));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.version).toBe(2);
    expect(payload.state.players.map((player: { id: string }) => player.id)).toEqual([PLAYER_ONE, PLAYER_TWO]);
    expect(payload.state.processedActionIds).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not expose a battle to a nonparticipant", async () => {
    mocks.loadBattle.mockRejectedValue(new PvpBattleAccessError());

    const response = await POST(request(action()));

    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
