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

const teamId = "00000000-0000-4000-8000-000000000001";
const memberId = "00000000-0000-4000-8000-000000000002";

function request(body: unknown) {
  return new Request("http://localhost/api/player/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/player/progress retired team mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "player-1" } }, error: null });
  });

  it.each([
    ["activate_team", { action: "activate_team", teamId }],
    ["save_team", { action: "save_team", memberIds: [memberId] }],
  ])("returns 410 for %s without calling a database RPC", async (_action, payload) => {
    const response = await PATCH(request(payload));

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "Equipes de criaturas foram desativadas; escolha uma Lenda e configure seus dois poderes.",
    });
    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("still requires authentication before reporting retired mutations", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const response = await PATCH(request({ action: "activate_team", teamId }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Autenticação necessária." });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
