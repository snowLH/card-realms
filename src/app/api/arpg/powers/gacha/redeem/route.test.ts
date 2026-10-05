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

const accountId = "81000000-0000-4000-8000-000000000008";
const idempotencyKey = "81000000-0000-4000-8000-000000000001";
const validResult = {
  itemId: "caipora-arrow",
  rarity: "common",
  tier: "common",
  fragmentsSpent: 25,
  legendFragments: 5,
  ownedCardIds: ["caipora-arrow"],
  replayed: false,
};

function request(body: unknown) {
  return new Request("http://localhost/api/arpg/powers/gacha/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/arpg/powers/gacha/redeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: accountId } }, error: null });
  });

  it("delegates an authenticated card redemption with account and idempotency keys", async () => {
    mocks.rpc.mockResolvedValue({ data: validResult, error: null });

    const response = await POST(request({ accountId, cardId: "caipora-arrow", idempotencyKey }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ...validResult, authority: "server" });
    expect(mocks.rpc).toHaveBeenCalledWith("redeem_arpg_power_gacha_card", {
      target_user_id: accountId,
      target_card_id: "caipora-arrow",
      target_idempotency_key: idempotencyKey,
    });
  });

  it("rejects non-pool cards before contacting the database", async () => {
    const response = await POST(request({ accountId, cardId: "ancestral-roots", idempotencyKey }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns a safe insufficient-fragments message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Fragmentos insuficientes" } });

    const response = await POST(request({ accountId, cardId: "caipora-arrow", idempotencyKey }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Você ainda não tem fragmentos suficientes para este poder." });
  });

  it("rejects a request bound to another account", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "account mismatch" } });

    const response = await POST(request({ accountId, cardId: "caipora-arrow", idempotencyKey }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "A sessão mudou. Atualize o Arquivo antes de resgatar." });
  });

  it("rejects malformed keys without touching the database", async () => {
    const response = await POST(request({ accountId, cardId: "caipora-arrow", idempotencyKey: "bad" }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
