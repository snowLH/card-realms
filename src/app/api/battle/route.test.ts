import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoBattle } from "@/game/engine";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  assertTokenUnused: vi.fn(),
  consumeToken: vi.fn(),
  verifyBattleState: vi.fn(),
  signBattleState: vi.fn(() => "signed-battle-token"),
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: mocks.isSupabaseConfigured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/game-token", () => ({
  assertTokenUnused: mocks.assertTokenUnused,
  consumeToken: mocks.consumeToken,
  signBattleState: mocks.signBattleState,
  verifyBattleState: mocks.verifyBattleState,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/battle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/battle legacy combat retirement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(false);
  });

  it("returns 410 for old battle start requests without creating a new match", async () => {
    const response = await POST(request({ action: "start", obsoletePayload: true }));
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.error).toContain("combates clássicos foram desativados");
    expect(payload.error).toContain("CONFLITO/PvP");
    expect(mocks.signBattleState).not.toHaveBeenCalled();
    expect(mocks.verifyBattleState).not.toHaveBeenCalled();
  });

  it("still lets a player close an in-progress historical battle with its signed token", async () => {
    const historicalBattle = createDemoBattle(
      "historical-battle",
      () => 0.5,
      { ...DEFAULT_AVATAR_CONFIG },
      ["curupira-root-snare", "curupira-ember-arrow"],
    );
    mocks.verifyBattleState.mockReturnValue(historicalBattle);

    const response = await POST(request({
      action: "concede",
      token: "historical-signed-battle-token",
      actionId: "close-historical-battle",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state.status).toBe("finished");
    expect(payload.state.winnerId).not.toBe("player-one");
    expect(mocks.consumeToken).toHaveBeenCalledWith("historical-signed-battle-token");
  });
});
