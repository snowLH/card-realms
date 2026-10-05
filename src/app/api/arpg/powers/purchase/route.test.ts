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

import { POST } from "./route";

function request(cardId: string) {
  return new Request("http://localhost/api/arpg/powers/purchase", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId }),
  });
}

describe("POST /api/arpg/powers/purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "player-1" } }, error: null });
  });

  it("delegates an eligible purchase to the authenticated RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: { coins: 420, ownedAbilityIds: ["ancestral-roots", "boitata-flame", "caipora-arrow"] },
      error: null,
    });

    const response = await POST(request("caipora-arrow"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      coins: 420,
      ownedAbilityIds: ["ancestral-roots", "boitata-flame", "caipora-arrow"],
      authority: "server",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("purchase_arpg_power_card", {
      target_card_id: "caipora-arrow",
    });
  });

  it("lets the lobby purchase the former Raid-exclusive mythic card", async () => {
    mocks.rpc.mockResolvedValue({
      data: { coins: 0, ownedAbilityIds: ["ancestral-roots", "boitata-flame", "roc-horizon-storm"] },
      error: null,
    });

    const response = await POST(request("roc-horizon-storm"));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("purchase_arpg_power_card", {
      target_card_id: "roc-horizon-storm",
    });
    expect(await response.json()).toMatchObject({
      coins: 0,
      ownedAbilityIds: ["ancestral-roots", "boitata-flame", "roc-horizon-storm"],
      authority: "server",
    });
  });

  it("requires a signed-in account", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await POST(request("caipora-arrow"));

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
