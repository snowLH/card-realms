import { describe, expect, it } from "vitest";
import { resolveCombatDirection, selectNearestTarget } from "./combat-targeting";

const enemies = [
  { x: 20, y: 0, active: false, visible: true },
  { x: 30, y: 0, active: true, visible: false },
  { x: 90, y: 0, active: true, visible: true },
  { x: 120, y: 0, active: true, visible: true },
];
const options = { available: (enemy: typeof enemies[number]) => enemy.active, visible: (enemy: typeof enemies[number]) => enemy.visible };
describe("selectNearestTarget", () => {
  it("ignores inactive and occluded enemies", () => {
    expect(selectNearestTarget({ x: 0, y: 0 }, enemies, options)).toEqual(enemies[2]);
  });
  it("respects distance and rejects corrupt coordinates", () => {
    expect(selectNearestTarget({ x: 0, y: 0 }, enemies, { ...options, maxDistance: 80 })).toBeNull();
    expect(selectNearestTarget({ x: 0, y: 0 }, [{ x: NaN, y: 0, active: true, visible: true }, ...enemies], options)).toEqual(enemies[2]);
  });
});
const input = {
  gamepad: { x: 0, y: 0 },
  touch: { x: 0, y: 0 },
  player: { x: 10, y: 10 },
  target: { x: 10, y: 30 },
  pointer: { x: 20, y: 10 },
  previous: { x: -1, y: 0 },
  autoAim: true,
};
describe("resolveCombatDirection", () => {
  it("uses the nearest visible target while firing on touch", () => {
    expect(resolveCombatDirection(input)).toEqual({ x: 0, y: 1 });
  });
  it("prioritizes explicit analog input", () => {
    expect(resolveCombatDirection({ ...input, gamepad: { x: 1, y: 0 } })).toEqual({ x: 1, y: 0 });
    expect(resolveCombatDirection({ ...input, touch: { x: -1, y: 0 } })).toEqual({ x: -1, y: 0 });
  });
  it("does not retarget to mouse coordinates when no enemy remains", () => {
    expect(resolveCombatDirection({ ...input, target: null })).toEqual({ x: -1, y: 0 });
  });
  it("keeps desktop pointer aiming separate", () => {
    expect(resolveCombatDirection({ ...input, autoAim: false })).toEqual({ x: 1, y: 0 });
  });
  it("recovers from a zero-length or non-finite heading", () => {
    expect(resolveCombatDirection({ ...input, target: null, previous: { x: NaN, y: 0 } })).toEqual({ x: 1, y: 0 });
  });
});
