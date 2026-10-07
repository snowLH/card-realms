import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const mocks = vi.hoisted(() => ({
  challengeSingle: vi.fn(),
  profilesIn: vi.fn(),
  loadoutsIn: vi.fn(),
  rpc: vi.fn(),
  validateOwnership: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: mocks.challengeSingle,
        in: table === "profiles" ? mocks.profilesIn : mocks.loadoutsIn,
      };
      return query;
    },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/server/arpg/ability-ownership", () => ({
  validateArpgAbilityOwnership: mocks.validateOwnership,
}));

import { acceptPvpChallenge } from "./setup";

const REQUESTER_ID = "10000000-0000-4000-8000-000000000001";
const ADDRESSEE_ID = "20000000-0000-4000-8000-000000000002";
const BATTLE_ID = "30000000-0000-4000-8000-000000000003";
const CHALLENGE_ID = "40000000-0000-4000-8000-000000000004";

describe("acceptPvpChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.challengeSingle.mockResolvedValue({
      data: {
        id: CHALLENGE_ID,
        requester_id: REQUESTER_ID,
        addressee_id: ADDRESSEE_ID,
        status: "pending",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });
    mocks.profilesIn.mockResolvedValue({
      data: [
        { id: REQUESTER_ID, display_name: "Curupira", avatar_config: { ...DEFAULT_AVATAR_CONFIG } },
        { id: ADDRESSEE_ID, display_name: "Iara", avatar_config: { ...DEFAULT_AVATAR_CONFIG, legendId: "iara", favoriteLegendId: "iara" } },
      ],
      error: null,
    });
    mocks.loadoutsIn.mockResolvedValue({
      data: [
        { user_id: REQUESTER_ID, ability_ids: ["curupira-root-snare", "curupira-ember-arrow"] },
        { user_id: ADDRESSEE_ID, ability_ids: ["iara-enchanting-song", "iara-living-spring"] },
      ],
      error: null,
    });
    mocks.validateOwnership.mockResolvedValue({ valid: true });
    mocks.rpc.mockResolvedValue({ data: { challengeId: CHALLENGE_ID, battleId: BATTLE_ID, version: 1 }, error: null });
  });

  it("creates and atomically starts an avatar duel with two owned powers per player", async () => {
    const result = await acceptPvpChallenge(CHALLENGE_ID, ADDRESSEE_ID);
    const [rpcName, args] = mocks.rpc.mock.calls[0] as [string, Record<string, unknown>];
    const state = args.submitted_state as {
      kind: string;
      id: string;
      players: Array<{ id: string; abilityIds: string[] }>;
    };

    expect(result).toEqual({ challengeId: CHALLENGE_ID, battleId: BATTLE_ID, version: 1 });
    expect(rpcName).toBe("start_pvp_challenge");
    expect(args).toMatchObject({
      target_challenge_id: CHALLENGE_ID,
      acting_user_id: ADDRESSEE_ID,
      target_battle_id: expect.any(String),
    });
    expect(state.kind).toBe("pvp_realtime");
    expect(state.id).toBe(args.target_battle_id);
    expect(state.players.map((player) => [player.id, player.abilityIds.length])).toEqual([
      [REQUESTER_ID, 2],
      [ADDRESSEE_ID, 2],
    ]);
  });

  it("only lets the addressed player accept the challenge", async () => {
    await expect(acceptPvpChallenge(CHALLENGE_ID, REQUESTER_ID)).rejects.toThrow("Somente o jogador desafiado pode aceitar");

    expect(mocks.profilesIn).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a player whose saved pair does not match the active Legend", async () => {
    mocks.loadoutsIn.mockResolvedValueOnce({
      data: [
        { user_id: REQUESTER_ID, ability_ids: ["curupira-root-snare", "curupira-ember-arrow"] },
        { user_id: ADDRESSEE_ID, ability_ids: ["curupira-root-snare", "curupira-ember-arrow"] },
      ],
      error: null,
    });

    await expect(acceptPvpChallenge(CHALLENGE_ID, ADDRESSEE_ID))
      .rejects.toThrow("Cada jogador precisa dos dois poderes próprios da Lenda ativa");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
