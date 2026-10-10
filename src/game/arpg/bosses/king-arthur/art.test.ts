import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ForgottenLegendActor } from "@/components/arpg/boss-encounter-view";
import { advanceBossEncounter, createBossEncounter, damageBossEncounter, confirmBossRestoration } from "../boss-encounter-controller";
import { ARTHUR_CHARACTER_ART, arthurArtFrame } from "./art";

const players = [{ id: "solo", x: 976, y: 700, alive: true }];
const arena = { width: 1952, height: 992 };
const create = (seen = false) => createBossEncounter("king-arthur", 0, ["solo"], 2400, { x: 976, y: 144 }, seen);

describe("Arthur shared Naturalist v5 presentation", () => {
  it("keeps all eight awakening poses in both full and shortened intros", () => {
    const times = [0, 3200, 3500, 4000, 4300, 4800, 5200, 5700];
    for (const seen of [false, true]) {
      const encounter = create(seen);
      for (const [frame, fullTime] of times.entries()) {
        const time = seen ? Math.ceil(fullTime / 7000 * 1800) : fullTime;
        expect(arthurArtFrame(encounter, time)).toEqual({ ...ARTHUR_CHARACTER_ART.corrupted, frame });
      }
    }
  });
  it("keeps the boss kneeling alive at HP zero and throughout purification", () => {
    const encounter = create();
    advanceBossEncounter(encounter, 7000, players, arena);
    damageBossEncounter(encounter, 9999, 7100);
    expect(arthurArtFrame(encounter, 7100).frame).toBe(18);
    advanceBossEncounter(encounter, 8300, players, arena);
    expect(arthurArtFrame(encounter).frame).toBe(19);
    for (const [time, frame] of [[9700, 20], [10975, 21], [12250, 22], [13525, 23]]) {
      advanceBossEncounter(encounter, time, players, arena);
      expect(arthurArtFrame(encounter)).toEqual({ ...ARTHUR_CHARACTER_ART.corrupted, frame });
    }
    advanceBossEncounter(encounter, 14800, players, arena);
    expect(encounter.state).toBe("RESTORED");
    expect(arthurArtFrame(encounter).path).toBe(ARTHUR_CHARACTER_ART.restored.path);
    confirmBossRestoration(encounter, encounter.bossId, true, 14800);
    expect(arthurArtFrame(encounter).frame).toBeLessThan(4);
  });
  it("renders the same atlas and pose in co-op after serialization/reconnect", () => {
    const encounter = create();
    advanceBossEncounter(encounter, 4000, players, arena);
    const reconnected = JSON.parse(JSON.stringify(encounter));
    expect(arthurArtFrame(reconnected)).toEqual(arthurArtFrame(encounter));
    const markup = renderToStaticMarkup(createElement(ForgottenLegendActor, { encounter: reconnected }));
    expect(markup).toContain('href="' + ARTHUR_CHARACTER_ART.corrupted.path + '"');
    expect(markup).toContain('viewBox="768 0 256 256"');
    expect(markup).not.toContain("<rect");
  });
});
