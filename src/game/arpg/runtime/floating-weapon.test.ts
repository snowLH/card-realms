import { describe, expect, it } from "vitest";
import { getFloatingWeaponPose, getFloatingWeaponReach } from "./floating-weapon";

describe("floating weapon pose", () => {
  it("points at a nearby enemy before using the free aim direction", () => {
    const pose = getFloatingWeaponPose({
      player: { x: 100, y: 100 },
      target: { x: 100, y: 200 },
      fallbackDirection: { x: 1, y: 0 },
      distance: 40,
    });

    expect(pose.direction).toEqual({ x: 0, y: 1 });
    expect(pose).toMatchObject({ x: 100, y: 134 });
  });

  it("keeps a stable right-facing rest pose when there is no target or aim", () => {
    const pose = getFloatingWeaponPose({
      player: { x: 40, y: 64 },
      target: null,
      fallbackDirection: { x: 0, y: 0 },
    });

    expect(pose.direction).toEqual({ x: 1, y: 0 });
    expect(pose).toMatchObject({ x: 82, y: 58 });
  });

  it("places ranged weapons slightly farther from the Legend", () => {
    expect(getFloatingWeaponReach("sword")).toBeLessThan(getFloatingWeaponReach("bow"));
    expect(getFloatingWeaponReach("staff")).toBeGreaterThan(getFloatingWeaponReach("sword"));
  });
});
