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

import { GET, POST } from "./route";

const validState = {
  accountId: "81000000-0000-4000-8000-000000000008",
  cost: 80,
  coins: 500,
  legendFragments: 0,
  ownedCardIds: [],
  fragmentCosts: { common: 25, uncommon: 40, rare: 70, epic: 120, legendary: 225, mythic: 300 },
  pityMisses: 0,
  softPityStartsAtMisses: 9,
  hardPityAfterMisses: 19,
  rollsUntilGuaranteedEpic: 20,
  probabilities: { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 },
};

const validRoll = {
  coins: 420,
  itemId: "caipora-arrow",
  rarity: "common",
  tier: "common",
  duplicate: false,
  fragmentsAwarded: 0,
  legendFragments: 0,
  pityMisses: 1,
  rollsUntilGuaranteedEpic: 19,
  probabilities: { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 },
  replayed: false,
};

function request(body: unknown) {
  return new Request("http://localhost/api/arpg/powers/gacha", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/arpg/powers/gacha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: validState.accountId } }, error: null });
  });

  it("returns uncached server odds and balance for the signed-in player", async () => {
    mocks.rpc.mockResolvedValue({ data: validState, error: null });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ...validState, authority: "server" });
    expect(mocks.rpc).toHaveBeenCalledWith("get_arpg_power_gacha_state");
  });

  it("rejects guests before requesting private gacha state", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("delegates the idempotency key to the server roll", async () => {
    mocks.rpc.mockResolvedValue({ data: validRoll, error: null });
    const idempotencyKey = "81000000-0000-4000-8000-000000000001";
    const accountId = validState.accountId;

    const response = await POST(request({ accountId, idempotencyKey }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ...validRoll, authority: "server" });
    expect(mocks.rpc).toHaveBeenCalledWith("roll_arpg_power_gacha", {
      target_idempotency_key: idempotencyKey,
      target_user_id: accountId,
    });
  });

  it("rejects malformed idempotency keys without touching the database", async () => {
    const response = await POST(request({ accountId: validState.accountId, idempotencyKey: "not-a-uuid" }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a pending key bound to a different signed-in account", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "82000000-0000-4000-8000-000000000008" } }, error: null });
    const response = await POST(request({
      accountId: validState.accountId,
      idempotencyKey: "81000000-0000-4000-8000-000000000003",
    }));

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not expose database error details for an unavailable roll", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Moedas insuficientes para a roletagem" } });

    const response = await POST(request({
      accountId: validState.accountId,
      idempotencyKey: "81000000-0000-4000-8000-000000000002",
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Você precisa de 80 moedas para esta roletagem." });
  });
});
