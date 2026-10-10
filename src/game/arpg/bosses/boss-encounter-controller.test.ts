import { describe, expect, it } from "vitest";
import { createBossEncounter, transitionBoss, advanceBossEncounter, damageBossEncounter, confirmBossRestoration, BossEncounterSchema } from "./boss-encounter-controller";
import { CinematicInputLock } from "./cinematic-input-lock";
const arena = { width: 1952, height: 992 };
const players = [{ id: "solo", x: 976, y: 700, alive: true }];
export function combatArthur() {
  const encounter = createBossEncounter("king-arthur", 0, ["solo"], 2400, { x: 976, y: 144 });
  advanceBossEncounter(encounter, 7000, players, arena);
  return encounter;
}
describe("corrupted legend encounter", () => {
  it("rejects jumps and traverses the complete canonical cycle", () => {
    const boss = createBossEncounter("king-arthur", 0, ["solo"], 2400, { x: 976, y: 144 });
    expect(boss.state).toBe("ROOM_ENTERED");
    expect(() => transitionBoss(boss, "COMBAT", 0)).toThrow();
    advanceBossEncounter(boss, 500, players, arena); expect(boss.state).toBe("INTRO_LOCK");
    advanceBossEncounter(boss, 3200, players, arena); expect(boss.state).toBe("AWAKENING");
    expect(damageBossEncounter(boss, 9999, 3200)).toBe(0);
    advanceBossEncounter(boss, 7000, players, arena); expect(boss.state).toBe("COMBAT");
    damageBossEncounter(boss, 9999, 7100); expect(boss.state).toBe("DEFEATED");
    advanceBossEncounter(boss, 8300, players, arena); expect(boss.state).toBe("PURIFICATION");
    advanceBossEncounter(boss, 14800, players, arena); expect(boss.state).toBe("RESTORED");
    expect(() => confirmBossRestoration(boss, boss.bossId, false, 14800)).toThrow();
    confirmBossRestoration(boss, boss.bossId, true, 14800); expect(boss.state).toBe("CLEARED");
    expect(BossEncounterSchema.parse(JSON.parse(JSON.stringify(boss)))).toEqual(boss);
  });
  it("locks all gameplay actions and releases only its own owner", () => {
    const lock = new CinematicInputLock();
    let stops = 0;
    lock.acquire("boss", () => stops++); lock.acquire("dialogue", () => stops++);
    for (const action of ["move", "attack", "dash", "ability", "weapon", "interact"] as const) expect(lock.permits(action)).toBe(false);
    lock.release("boss"); expect(lock.locked).toBe(true);
    lock.release("dialogue"); expect(lock.locked).toBe(false); expect(stops).toBe(2);
  });
});
