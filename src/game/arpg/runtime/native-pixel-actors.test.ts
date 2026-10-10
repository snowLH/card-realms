import { describe, expect, it } from "vitest";
import { NATIVE_PIXEL_ACTORS, NATIVE_PIXEL_ACTOR_ANIMATION_MAP, getNativePixelWalkPose } from "./native-pixel-actors";

describe("native pixel walk cycle", () => {
  it("alternates lifted feet with a visible two-pixel stride", () => {
    const cycle = [0, 1, 2, 3].map(getNativePixelWalkPose);

    expect(cycle.map(({ stride }) => stride)).toEqual([-2, 0, 2, 0]);
    expect(cycle[0].leftLift).toBe(0);
    expect(cycle[0].rightLift).toBe(2);
    expect(cycle[2].leftLift).toBe(2);
    expect(cycle[2].rightLift).toBe(0);
    expect(cycle[1]).toEqual(cycle[3]);
  });

  it("wraps negative and later frame indices into the same four-frame cycle", () => {
    expect(getNativePixelWalkPose(4)).toEqual(getNativePixelWalkPose(0));
    expect(getNativePixelWalkPose(-1)).toEqual(getNativePixelWalkPose(3));
  });
});

describe("folklore pixel actor animation coverage", () => {
  it("provides six four-frame animation cycles for every hero, enemy and guild NPC", () => {
    expect(NATIVE_PIXEL_ACTORS.length).toBe(19);
    for (const actor of NATIVE_PIXEL_ACTORS) {
      expect(NATIVE_PIXEL_ACTOR_ANIMATION_MAP[actor]).toEqual({
        idle: 0, walk: 1, attack: 2, shoot: 3, damage: 4, defeat: 5,
      });
    }
  });
});
