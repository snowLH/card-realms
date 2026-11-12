import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { LOCAL_PLAYER_BOOTSTRAP } from "@/game/player";
import { loadAuthenticatedPlayerBootstrap, playerBootstrapKey } from "./progress";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(failedTable?: string) {
  const snapshot = {
    version: 1, profile: { id, username: "traveler", displayName: "Viajante", avatarUrl: null, level: 1, xp: 10, coins: 900, gems: 0, equippedTitle: null },
    world: { currentRegionId: "roots", unlockedRegionIds: ["roots"], openedTreasures: [] },
    collection: [], teams: [], energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
    inventory: [{ itemKey: "legend-king-arthur", quantity: 1, metadata: {} }], exploration: [], missions: [], achievements: [], house: null, battleHistory: [],
  };
  const rows: Record<string, unknown> = {
    profiles: { avatar_config: { ...DEFAULT_AVATAR_CONFIG, legendId: "king-arthur" } },
    player_world_state: { current_area_id: "roots-gate", visited_area_ids: ["roots-gate"], map_positions: { roots: { x: 4, y: 20 } } },
    player_creatures: [], missions: [],
    player_arpg_loadouts: { weapon_id: "wooden-sword", armor_id: "traveler-cloak", relic_id: "none", ability_ids: ["arthur-camelot-cut", "arthur-round-table-oath"] },
    player_boss_progress: { purified_boss_ids: ["king-arthur"], unlocked_legend_ids: ["king-arthur"], seen_boss_intro_ids: ["king-arthur"] },
  };
  const client = { rpc: vi.fn().mockResolvedValue({ data: snapshot, error: null }), from: vi.fn((table: string) => {
    const result = Promise.resolve({ data: rows[table], error: table === failedTable ? { code: "42P01" } : null });
    const query = { select: () => query, eq: () => query, single: () => result, maybeSingle: () => result, then: result.then.bind(result) };
    return query;
  }) } as unknown as SupabaseClient;
  return { client, snapshot };
}
afterEach(() => vi.restoreAllMocks());
describe("complete authoritative cloud bootstrap", () => {
  it("loads economy, ownership, selected legend, world, boss restoration and loadout together", async () => {
    const { client } = fixture();
    const bootstrap = await loadAuthenticatedPlayerBootstrap(client, { id, email: "traveler@example.com" });
    expect(bootstrap.source).toBe("supabase");
    expect(bootstrap.snapshot).toMatchObject({
      profile: { coins: 900, xp: 10, avatarConfig: { legendId: "king-arthur" } },
      bossProgress: { purifiedBossIds: ["king-arthur"], unlockedLegendIds: ["king-arthur"] },
      arpgLoadout: { abilityIds: ["arthur-camelot-cut", "arthur-round-table-oath"] },
      world: { visitedAreaIds: ["roots-gate"] },
    });
  });
  it.each(["profiles", "player_world_state", "player_arpg_loadouts", "player_boss_progress"])("keeps account identity and refuses a partial %s snapshot", async (table) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fixture(table);
    const bootstrap = await loadAuthenticatedPlayerBootstrap(client, { id, email: null });
    expect(bootstrap).toMatchObject({ source: "supabase-unavailable", identity: { id }, snapshot: null });
  });
  it("remounts game state on identity or server-confirmed progress changes, not identical refreshes", async () => {
    const { client } = fixture();
    const first = await loadAuthenticatedPlayerBootstrap(client, { id, email: null });
    const identical = await loadAuthenticatedPlayerBootstrap(client, { id, email: null });
    expect(playerBootstrapKey(first)).toBe(playerBootstrapKey(identical));
    expect(playerBootstrapKey(first)).not.toBe(playerBootstrapKey({ ...first, identity: { id: "other-account", email: null } }));
    const changed = structuredClone(first); changed.snapshot!.profile.coins += 1;
    expect(playerBootstrapKey(first)).not.toBe(playerBootstrapKey(changed));
    expect(playerBootstrapKey(first)).not.toBe(playerBootstrapKey(LOCAL_PLAYER_BOOTSTRAP));
  });
});
