import { describe, expect, it } from "vitest";
import { restoreBossProgress, EMPTY_BOSS_PROGRESS, BossProgressSchema } from "./boss-unlocks";
import { createBossEncounter, advanceBossEncounter, damageBossEncounter } from "./boss-encounter-controller";
import { bossById } from "./registry";
import { DEFAULT_LOCAL_PROGRESS, loadLocalProgress, saveLocalProgress, LOCAL_PROGRESS_KEY } from "../../save/local-progress";
describe("persistent restored legends", () => {
  it("unlocks only after purification and is idempotent across requests and reloads", () => {
    const boss = createBossEncounter("king-arthur", 0, ["solo"], 100, { x: 976, y: 144 });
    const players = [{ id: "solo", x: 976, y: 850, alive: true }], arena = { width: 1952, height: 992 };
    expect(() => restoreBossProgress(EMPTY_BOSS_PROGRESS, boss)).toThrow();
    advanceBossEncounter(boss, 7000, players, arena); damageBossEncounter(boss, 100, 7100);
    expect(() => restoreBossProgress(EMPTY_BOSS_PROGRESS, boss)).toThrow();
    advanceBossEncounter(boss, 14800, players, arena);
    const progress = restoreBossProgress(EMPTY_BOSS_PROGRESS, boss);
    expect(progress.unlockedLegendIds).toEqual(["king-arthur"]);
    expect(restoreBossProgress(progress, boss)).toEqual(progress);
    const store = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => { store.set(key, value); }, getItem: (key: string) => store.get(key) ?? null };
    saveLocalProgress(storage, { ...DEFAULT_LOCAL_PROGRESS, ...progress });
    expect(loadLocalProgress(storage).purifiedBossIds).toEqual(["king-arthur"]);
    expect(loadLocalProgress(storage, "other-account").unlockedLegendIds).toEqual([]);
  });
  it.each([
    ["ancestral-curupira", "curupira"],
    ["deep-iara", "iara"],
    ["king-arthur", "king-arthur"],
  ] as const)("restores %s through the same purification-to-unlock contract", (bossId, legendId) => {
    const definition = bossById(bossId);
    const boss = createBossEncounter(bossId, 0, ["solo"], 100, { x: 976, y: 144 });
    const players = [{ id: "solo", x: 976, y: 850, alive: true }];
    const arena = { width: 1952, height: 992 };
    advanceBossEncounter(boss, definition.intro.durationMs, players, arena);
    damageBossEncounter(boss, 100, definition.intro.durationMs + 100);
    const restoredAt = definition.intro.durationMs + 100
      + definition.purification.defeatedMs
      + definition.purification.durationMs;
    advanceBossEncounter(boss, restoredAt, players, arena);
    expect(boss.state).toBe("RESTORED");
    const progress = restoreBossProgress(EMPTY_BOSS_PROGRESS, boss);
    expect(progress.purifiedBossIds).toContain(bossId);
    expect(progress.unlockedLegendIds).toContain(legendId);
  });

  it("migrates old v4 and v1 saves without granting bosses or losing currency", () => {
    const { purifiedBossIds, unlockedLegendIds, seenBossIntroIds, ...old } = DEFAULT_LOCAL_PROGRESS;
    void purifiedBossIds; void unlockedLegendIds; void seenBossIntroIds;
    for (const key of [LOCAL_PROGRESS_KEY, "card-realms:demo-progress:v1"]) {
      const parsed = loadLocalProgress({ getItem: (requested) => requested === key ? JSON.stringify({ ...old, coins: 777 }) : null });
      expect(parsed.coins).toBe(777); expect(parsed.purifiedBossIds).toEqual([]);
      expect(parsed.unlockedLegendIds).toEqual([]); expect(parsed.seenBossIntroIds).toEqual([]);
    }
    expect(BossProgressSchema.parse({ seenBossIntroIds: ["king-arthur", "king-arthur"] }).seenBossIntroIds).toEqual(["king-arthur"]);
  });
});
