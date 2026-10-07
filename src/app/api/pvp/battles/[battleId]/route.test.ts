import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPvpRealtimeDuel } from "@/game/pvp/realtime";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { PvpBattleAccessError } from "@/server/pvp/battles";

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  isSupabaseAdminConfigured: vi.fn(),
  getClaims: vi.fn(),
  loadBattle: vi.fn(),
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

import { GET } from "./route";

const PLAYER_ONE = "10000000-0000-4000-8000-000000000001";
const PLAYER_TWO = "20000000-0000-4000-8000-000000000002";
const BATTLE_ID = "30000000-0000-4000-8000-000000000003";

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

function context() {
  return { params: Promise.resolve({ battleId: BATTLE_ID }) };
}

describe("GET /api/pvp/battles/[battleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.isSupabaseAdminConfigured.mockReturnValue(true);
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: PLAYER_ONE } }, error: null });
    mocks.loadBattle.mockResolvedValue({
      battle: { id: BATTLE_ID, version: 9, state: duel() },
    });
  });

  it("returns participant-visible live state with its persisted version", async () => {
    const response = await GET(new Request(`http://localhost/api/pvp/battles/${BATTLE_ID}`), context());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.version).toBe(9);
    expect(payload.authority).toBe("server");
    expect(payload.state.players.map((player: { id: string }) => player.id)).toEqual([PLAYER_ONE, PLAYER_TWO]);
    expect(payload.state.players.every((player: { abilityIds: string[] }) => player.abilityIds.length === 2)).toBe(true);
    expect(payload.state.processedActionIds).toEqual([]);
    expect(JSON.stringify(payload)).not.toMatch(/energyDeck|energyHand|creatures/);
  });

  it("requires a signed-in participant", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await GET(new Request(`http://localhost/api/pvp/battles/${BATTLE_ID}`), context());

    expect(response.status).toBe(401);
    expect(mocks.loadBattle).not.toHaveBeenCalled();
  });

  it("returns not found for an account outside the duel", async () => {
    mocks.loadBattle.mockRejectedValue(new PvpBattleAccessError());

    const response = await GET(new Request(`http://localhost/api/pvp/battles/${BATTLE_ID}`), context());

    expect(response.status).toBe(404);
  });
});
