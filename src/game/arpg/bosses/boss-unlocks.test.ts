import { describe, expect, it } from "vitest";
import { restoreBossProgress, EMPTY_BOSS_PROGRESS, BossProgressSchema } from "./boss-unlocks";
import { createBossEncounter, advanceBossEncounter, damageBossEncounter } from "./boss-encounter-controller";
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
