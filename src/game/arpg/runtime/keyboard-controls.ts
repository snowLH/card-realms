export const ARPG_MOVEMENT_KEY_BINDINGS = {
  up: "W", down: "S", left: "A", right: "D",
  upArrow: "UP", downArrow: "DOWN", leftArrow: "LEFT", rightArrow: "RIGHT",
} as const;

export type ArpgMovementKeys<T = { isDown: boolean }> = {
  [Name in keyof typeof ARPG_MOVEMENT_KEY_BINDINGS]: T;
};

export function readKeyboardMovement(keys: ArpgMovementKeys) {
  return {
    x: Number(keys.right.isDown || keys.rightArrow.isDown)
      - Number(keys.left.isDown || keys.leftArrow.isDown),
    y: Number(keys.down.isDown || keys.downArrow.isDown)
      - Number(keys.up.isDown || keys.upArrow.isDown),
  };
}

export function consumeKeyboardDash<T>(primary: T, alternate: T, justDown: (key: T) => boolean) {
  // Consume both edges even when the first is true: a simultaneous press must
  // not remain queued and trigger another dash when its cooldown expires.
  const primaryPressed = justDown(primary);
  const alternatePressed = justDown(alternate);
  return primaryPressed || alternatePressed;
}
