import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  }),
}));

import { PATCH } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/arpg/loadout", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validLoadout = {
  weaponId: "forest-bow",
  secondaryWeaponId: "iron-sword",
  armorId: "leather-armor",
  relicId: "cartographer-compass",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};

describe("PATCH /api/arpg/loadout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "player-1" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: validLoadout, error: null });
  });

  it("saves only two attacks through the authenticated RPC", async () => {
    const response = await PATCH(request(validLoadout));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_arpg_loadout", {
      target_weapon_id: "forest-bow",
      target_secondary_weapon_id: "iron-sword",
      target_armor_id: "leather-armor",
      target_relic_id: "cartographer-compass",
      target_ability_ids: ["ancestral-roots", "boitata-flame"],
    });
  });

  it("rejects supporter fields and four-card loadout writes", async () => {
    const response = await PATCH(request({
      ...validLoadout,
      supportIds: ["support-saci", "support-iara"],
      abilityIds: ["ancestral-roots", "boitata-flame", "saci-whirlwind", "iara-song"],
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await PATCH(request(validLoadout));

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
