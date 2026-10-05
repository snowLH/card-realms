import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSide } from "@/game/engine";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  validateOwnership: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: mocks.isSupabaseConfigured }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/server/arpg/ability-ownership", () => ({
  validateArpgAbilityOwnership: mocks.validateOwnership,
}));
vi.mock("@/lib/game-token", () => ({
  assertTokenUnused: vi.fn(),
  consumeToken: vi.fn(),
  signBattleState: vi.fn(() => "signed-battle-token"),
  verifyBattleState: vi.fn(),
}));

import { POST } from "./route";

const guestSetup = {
  avatarConfig: { ...DEFAULT_AVATAR_CONFIG, hair: "waves" as const, accent: "emerald" as const },
  abilityIds: ["iara-song", "saci-whirlwind"],
};
const encounter = { kind: "wild" as const, regionId: "roots", creatureId: "boitata" };

function request(body: unknown) {
  return new Request("http://localhost/api/battle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function snapshotFixture() {
  return {
    version: 1,
    profile: {
      id: "00000000-0000-4000-8000-000000000001",
      username: "cartografo",
      displayName: "Cartógrafo",
      avatarUrl: null,
      avatarConfig: { ...DEFAULT_AVATAR_CONFIG, hair: "mohawk" as const, accent: "crimson" as const },
      level: 1,
      xp: 0,
      coins: 500,
      gems: 0,
      equippedTitle: null,
    },
    world: { currentRegionId: "roots", unlockedRegionIds: ["roots"], openedTreasures: [] },
    collection: [],
    teams: [],
    energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
    inventory: [],
    arpgLoadout: {
      weaponId: "forest-bow",
      armorId: "leather-armor",
      relicId: "cartographer-compass",
      abilityIds: ["ancestral-roots", "boitata-flame"],
    },
    exploration: [],
    missions: [],
    achievements: [],
    house: null,
    battleHistory: [],
  };
}

describe("POST /api/battle guest setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(false);
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.validateOwnership.mockResolvedValue({ valid: true });
  });

  it("places the local guest avatar and two chosen powers in the signed battle state", async () => {
    const response = await POST(request({ action: "start", encounter, guestSetup }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.token).toBe("signed-battle-token");
    const player = getSide(payload.state, "player-one");
    expect(player.avatarConfig).toEqual(guestSetup.avatarConfig);
    expect(player.abilityIds).toEqual(guestSetup.abilityIds);
  });

  it("uses the authenticated snapshot instead of client supplied guest settings", async () => {
    const snapshot = snapshotFixture();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: snapshot.profile.id } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: snapshot, error: null });

    const response = await POST(request({ action: "start", encounter, guestSetup }));
    const payload = await response.json();
    const player = getSide(payload.state, "player-one");

    expect(response.status).toBe(200);
    expect(mocks.validateOwnership).toHaveBeenCalledWith({}, snapshot.profile.id, {
      abilityIds: snapshot.arpgLoadout.abilityIds,
    });
    expect(player.avatarConfig).toEqual(snapshot.profile.avatarConfig);
    expect(player.abilityIds).toEqual(snapshot.arpgLoadout.abilityIds);
    expect(player.avatarConfig).not.toEqual(guestSetup.avatarConfig);
  });
});
