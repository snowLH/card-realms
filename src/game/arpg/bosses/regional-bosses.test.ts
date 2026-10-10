import { describe, expect, it } from "vitest";
import { createBossEncounter, advanceBossEncounter, damageBossEncounter } from "./boss-encounter-controller";
import { CORRUPTED_LEGEND_BOSSES } from "./registry";
import { isRegionalForgottenLegend, regionalBossArtFrame } from "./regional-art";

describe("regional forgotten legends", () => {
  it("uses the monumental arena and restoration reward contract for every final boss", () => {
    expect(CORRUPTED_LEGEND_BOSSES.map((boss) => boss.id)).toEqual([
      "ancestral-curupira", "deep-iara", "king-arthur",
    ]);
    for (const boss of CORRUPTED_LEGEND_BOSSES) {
      expect(boss.arena.widthTiles).toBe(61);
      expect(boss.arena.heightTiles).toBe(31);
      expect(boss.playableLegendId).toBeTruthy();
      expect(boss.purification.durationMs).toBeGreaterThanOrEqual(6000);
    }
  });

  it.each(["ancestral-curupira", "deep-iara"] as const)(
    "keeps %s alive through defeat, purification and restored presentation frames",
    (bossId) => {
      const boss = CORRUPTED_LEGEND_BOSSES.find((entry) => entry.id === bossId)!;
      const encounter = createBossEncounter(bossId, 0, ["solo"], 100, { x: 976, y: 144 });
      const players = [{ id: "solo", x: 976, y: 820, alive: true }];
      const arena = { width: 1952, height: 992 };

      expect(isRegionalForgottenLegend(bossId)).toBe(true);
      advanceBossEncounter(encounter, boss.intro.durationMs, players, arena);
      damageBossEncounter(encounter, 100, boss.intro.durationMs + 100);
      expect(encounter.state).toBe("DEFEATED");
      expect(regionalBossArtFrame(encounter)?.frame).toBe(18);

      const restoredAt = boss.intro.durationMs + 100
        + boss.purification.defeatedMs
        + boss.purification.durationMs;
      advanceBossEncounter(encounter, restoredAt, players, arena);
      expect(encounter.state).toBe("RESTORED");
      expect(regionalBossArtFrame(encounter)?.restored).toBe(true);
    },
  );
});
