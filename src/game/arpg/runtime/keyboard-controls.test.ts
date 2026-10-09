import { describe, expect, it } from "vitest";
import { ARPG_MOVEMENT_KEY_BINDINGS, consumeKeyboardDash, readKeyboardMovement, type ArpgMovementKeys } from "./keyboard-controls";

function held(...names: (keyof ArpgMovementKeys)[]): ArpgMovementKeys {
  return Object.fromEntries(Object.keys(ARPG_MOVEMENT_KEY_BINDINGS)
    .map((name) => [name, { isDown: names.includes(name as keyof ArpgMovementKeys) }])) as ArpgMovementKeys;
}

describe("ARPG keyboard controls", () => {
  it.each([
    ["up", "upArrow", { x: 0, y: -1 }],
    ["down", "downArrow", { x: 0, y: 1 }],
    ["left", "leftArrow", { x: -1, y: 0 }],
    ["right", "rightArrow", { x: 1, y: 0 }],
  ] as const)("moves equally with %s and %s without doubling speed", (letter, arrow, expected) => {
    expect(readKeyboardMovement(held(letter))).toEqual(expected);
    expect(readKeyboardMovement(held(arrow))).toEqual(expected);
    expect(readKeyboardMovement(held(letter, arrow))).toEqual(expected);
  });

  it("cancels opposing aliases while preserving a mixed-key diagonal", () => {
    expect(readKeyboardMovement(held("left", "rightArrow", "downArrow"))).toEqual({ x: 0, y: 1 });
    expect(readKeyboardMovement(held("upArrow", "right"))).toEqual({ x: 1, y: -1 });
    expect(readKeyboardMovement(held())).toEqual({ x: 0, y: 0 });
  });

  it("consumes simultaneous dash edges once, including when held through a cooldown", () => {
    const space = { justDown: true };
    const shift = { justDown: true };
    const consume = (key: typeof space) => {
      const pressed = key.justDown;
      key.justDown = false;
      return pressed;
    };
    expect(consumeKeyboardDash(space, shift, consume)).toBe(true);
    expect(consumeKeyboardDash(space, shift, consume)).toBe(false);
    shift.justDown = true;
    expect(consumeKeyboardDash(space, shift, consume)).toBe(true);
    expect(consumeKeyboardDash(space, shift, consume)).toBe(false);
  });
});
