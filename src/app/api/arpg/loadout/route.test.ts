import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
      })),
    })),
  }),
}));

import { PATCH } from "@/server/http-handlers/arpg-loadout";

function request(body: unknown) {
  return new Request("http://localhost/api/arpg/loadout", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validLoadout = {
  weaponId: "forest-bow",
  armorId: "leather-armor",
  relicId: "cartographer-compass",
  abilityIds: ["curupira-root-snare", "curupira-ember-arrow"],
};

describe("PATCH /api/arpg/loadout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "player-1" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: validLoadout, error: null });
    mocks.maybeSingle.mockResolvedValue({
      data: { avatar_config: DEFAULT_AVATAR_CONFIG },
      error: null,
    });
  });

  it("saves only two attacks through the authenticated RPC", async () => {
    const response = await PATCH(request(validLoadout));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_arpg_loadout", {
      target_weapon_id: "forest-bow",
      target_armor_id: "leather-armor",
      target_relic_id: "cartographer-compass",
      target_ability_ids: ["curupira-root-snare", "curupira-ember-arrow"],
    });
  });

  it("rejects supporter fields and four-card loadout writes", async () => {
    const response = await PATCH(request({
      ...validLoadout,
      supportIds: ["support-saci", "support-iara"],
      abilityIds: ["curupira-root-snare", "curupira-ember-arrow", "iara-enchanting-song", "iara-living-spring"],
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
