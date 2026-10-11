import { describe, expect, it, vi } from "vitest";
import { clearProjectilePool, recycleArcadeProjectile } from "./projectile-recycling";
import { advanceBossEncounter, createBossEncounter, damageBossEncounter } from "../bosses/boss-encounter-controller";
import { isBossInputLocked } from "../bosses/cinematic-input-lock";

describe("final projectile overlap regression", () => {
  it("HP zero recycles the attacking projectile safely before its overlap callback returns", () => {
    const projectile = { body: { enable: true }, setActive: vi.fn(), setVisible: vi.fn(), setVelocity: vi.fn() };
    const encounter = createBossEncounter("king-arthur", 0, ["solo"], 1, { x: 976, y: 144 });
    advanceBossEncounter(encounter, 7000, [], { width: 1952, height: 992 });
    damageBossEncounter(encounter, 1, 7100);
    clearProjectilePool([projectile]); // Inside damageEnemy, during overlap.
    expect(() => recycleArcadeProjectile(projectile)).not.toThrow(); // Remaining overlap callback.
    expect(projectile.body.enable).toBe(false);
    expect(encounter.state).toBe("DEFEATED");
    advanceBossEncounter(encounter, 14900, [], { width: 1952, height: 992 });
    expect(encounter.state).toBe("RESTORED");
    expect(isBossInputLocked(encounter.state)).toBe(false);
  });
  it("ignores an already destroyed body without calling Phaser's velocity setter", () => {
    const projectile = { body: undefined, setActive: vi.fn(), setVisible: vi.fn(), setVelocity: vi.fn(() => { throw new Error("Body destroyed"); }) };
    expect(recycleArcadeProjectile(projectile)).toBe(false);
    expect(projectile.setVelocity).not.toHaveBeenCalled();
  });
});
