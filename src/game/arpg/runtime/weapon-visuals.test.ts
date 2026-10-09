import { describe, expect, it } from "vitest";
import { ARPG_WEAPONS } from "../content/equipment";
import {
  ARPG_WEAPON_VISUALS,
  getSnappedWeaponAngle,
  getWeaponMotionFrame,
  getWeaponProjectileVisual,
  getWeaponVisualDefinition,
} from "./weapon-visuals";

describe("weapon visual registry", () => {
  it("covers every obtainable ARPG weapon and no extra stale IDs", () => {
    const weaponIds = ARPG_WEAPONS.map((weapon) => weapon.id).sort();
    const visualIds = ARPG_WEAPON_VISUALS.map((visual) => visual.id).sort();
    expect(visualIds).toEqual(weaponIds);
  });

  it("uses a unique runtime texture for every weapon", () => {
    const keys = ARPG_WEAPON_VISUALS.map((visual) => visual.textureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps attack motion bounded and returns to a neutral pose", () => {
    for (const visual of ARPG_WEAPON_VISUALS) {
      const active = getWeaponMotionFrame(visual, visual.motionDurationMs / 2);
      expect(Number.isFinite(active.angleOffset)).toBe(true);
      expect(Math.abs(active.distanceOffset)).toBeLessThanOrEqual(12);
      expect(active.scaleMultiplier).toBeGreaterThanOrEqual(1);
      expect(getWeaponMotionFrame(visual, visual.motionDurationMs + 1)).toEqual({
        angleOffset: 0,
        distanceOffset: 0,
        sideOffset: 0,
        scaleMultiplier: 1,
        alpha: 1,
      });
    }
  });

  it("maps ranged weapon families to readable projectile silhouettes", () => {
    expect(getWeaponProjectileVisual("bow")).toEqual({
      textureKey: "arpg-weapon-projectile-arrow",
      rotateWithVelocity: true,
    });
    expect(getWeaponProjectileVisual("staff")).toEqual({
      textureKey: "arpg-weapon-projectile-focus",
      rotateWithVelocity: false,
    });
    expect(getWeaponProjectileVisual("sword").textureKey).toBe("arpg-projectile");
  });

  it("snaps weapon aim to stable pixel-friendly angles", () => {
    expect(getSnappedWeaponAngle({ x: 1, y: 0 })).toBe(0);
    const diagonal = getSnappedWeaponAngle({ x: 1, y: 1 });
    expect(diagonal).toBeCloseTo(Math.PI / 4);
    expect(Number.isFinite(getSnappedWeaponAngle({ x: 0, y: 0 }, 0.4))).toBe(true);
  });

  it("resolves every gameplay weapon definition without a fallback visual", () => {
    for (const weapon of ARPG_WEAPONS) {
      expect(getWeaponVisualDefinition(weapon.id).id).toBe(weapon.id);
    }
  });
});
