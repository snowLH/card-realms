import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

import { GET, PATCH } from "./route";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const PLAYER_ID = "10000000-0000-4000-8000-000000000001";
const LEGACY_TEAM_ID = "10000000-0000-4000-8000-000000000002";

function legacySnapshot() {
  return {
    version: 1,
    profile: {
      id: PLAYER_ID,
      username: "player",
      displayName: "Player",
      avatarUrl: null,
      level: 1,
      xp: 0,
      coins: 500,
      gems: 0,
      equippedTitle: null,
      avatarConfig: DEFAULT_AVATAR_CONFIG,
    },
    world: {
      currentRegionId: "roots",
      unlockedRegionIds: ["roots"],
      openedTreasures: [],
    },
    collection: [],
    teams: [{
      id: LEGACY_TEAM_ID,
      name: "Equipe antiga",
      isActive: true,
      members: Array.from({ length: 6 }, (_, index) => ({
        slot: index + 1,
        playerCreatureId: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        catalogId: `legacy-creature-${index + 1}`,
        evolutionStage: 0,
      })),
    }],
    energy: { fire: 0, water: 0, nature: 0, storm: 0, spirit: 0 },
    inventory: [],
    exploration: [],
    missions: [],
    achievements: [],
    house: null,
    battleHistory: [],
  };
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/player/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/player/progress legacy team mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: PLAYER_ID } }, error: null });
    mocks.rpc.mockImplementation(async (name: string) => name === "get_my_player_snapshot"
      ? { data: legacySnapshot(), error: null }
      : { data: { currentRegionId: "roots" }, error: null });
    mocks.from.mockImplementation((table: string) => ({
      select: () => {
        if (table === "profiles") {
          return { single: async () => ({ data: { avatar_config: DEFAULT_AVATAR_CONFIG }, error: null }) };
        }
        if (table === "player_world_state") {
          return {
            single: async () => ({
              data: { current_area_id: null, visited_area_ids: [], map_positions: {} },
              error: null,
            }),
          };
        }
        if (table === "player_creatures") {
          return Promise.resolve({ data: [], error: null });
        }
        if (table === "missions") {
          return { eq: async () => ({ data: [], error: null }) };
        }
        throw new Error(`Tabela inesperada no teste: ${table}`);
      },
    }));
  });

  it.each([
    ["save_team", {
      action: "save_team",
      memberIds: Array.from({ length: 6 }, (_, index) =>
        `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
      name: "Equipe nova",
    }],
    ["activate_team", { action: "activate_team", teamId: LEGACY_TEAM_ID }],
  ])("rejects obsolete %s requests without mutating progress", async (_action, payload) => {
    const response = await PATCH(patchRequest(payload));

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "As operações de equipe foram desativadas." });
    expect(mocks.getClaims).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("still returns saved six-member legacy teams for existing progress reads", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authority).toBe("supabase");
    expect(body.snapshot.teams).toHaveLength(1);
    expect(body.snapshot.teams[0].id).toBe(LEGACY_TEAM_ID);
    expect(body.snapshot.teams[0].members).toHaveLength(6);
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_player_snapshot");
  });

  it("keeps other progress mutations available", async () => {
    const response = await PATCH(patchRequest({ action: "travel", regionId: "roots" }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("travel_to_region", { target_region_id: "roots" });
  });
});
