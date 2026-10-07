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

import { POST } from "@/server/http-handlers/arpg-power-purchase";

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

  it("rejects the retired individual-power shop before authenticating", async () => {
    const response = await POST(request("caipora-arrow"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Carta de poder desconhecida." });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("keeps a Legend's signature attack bundle out of the old power-card shop", async () => {
    const response = await POST(request("iara-enchanting-song"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Os poderes acompanham a Lenda; compras avulsas estão desativadas.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("never calls the retired purchase RPC for any current signature power", async () => {
    const responses = await Promise.all([
      POST(request("iara-enchanting-song")),
      POST(request("iara-living-spring")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([409, 409]);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("rejects old cards even when no account is signed in", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await POST(request("caipora-arrow"));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });
});
