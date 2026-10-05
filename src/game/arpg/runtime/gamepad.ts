export type GamepadButtonLike = { pressed: boolean; value?: number };

export type GamepadLike = {
  connected: boolean;
  axes: readonly number[];
  buttons: readonly GamepadButtonLike[];
};

export type GamepadFrame = {
  connected: boolean;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  attack: boolean;
  dashPressed: boolean;
  interactPressed: boolean;
  abilityPressed: [boolean, boolean];
};

export type GamepadReadResult = {
  frame: GamepadFrame;
  pressedButtons: Set<number>;
};

const EMPTY_FRAME: GamepadFrame = {
  connected: false, moveX: 0, moveY: 0, aimX: 0, aimY: 0,
  attack: false, dashPressed: false, interactPressed: false,
  abilityPressed: [false, false],
};
const EMPTY_PRESSED_BUTTONS = new Set<number>();
const EMPTY_GAMEPAD_RESULT: GamepadReadResult = {
  frame: EMPTY_FRAME,
  pressedButtons: EMPTY_PRESSED_BUTTONS,
};
export function normalizeGamepadAxis(value: number, deadzone = 0.18) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const scaled = (magnitude - deadzone) / Math.max(0.0001, 1 - deadzone);
  return Math.sign(value) * Math.min(1, scaled);
}

function pressed(buttons: readonly GamepadButtonLike[], index: number) {
  return Boolean(buttons[index]?.pressed || (buttons[index]?.value ?? 0) > 0.55);
}

export function mapStandardGamepad(
  gamepad: GamepadLike | null,
  previousPressed: ReadonlySet<number> = EMPTY_PRESSED_BUTTONS,
): GamepadReadResult {
  if (!gamepad?.connected) {
    return EMPTY_GAMEPAD_RESULT;
  }

  const currentPressed = new Set<number>();
  gamepad.buttons.forEach((button, index) => {
    if (button.pressed || (button.value ?? 0) > 0.55) currentPressed.add(index);
  });
  const justPressed = (index: number) => currentPressed.has(index) && !previousPressed.has(index);

  return {
    frame: {
      connected: true,
      moveX: normalizeGamepadAxis(gamepad.axes[0] ?? 0),
      moveY: normalizeGamepadAxis(gamepad.axes[1] ?? 0),
      aimX: normalizeGamepadAxis(gamepad.axes[2] ?? 0),
      aimY: normalizeGamepadAxis(gamepad.axes[3] ?? 0),
      attack: pressed(gamepad.buttons, 0),
      dashPressed: justPressed(1),
      interactPressed: justPressed(5),
      abilityPressed: [
        justPressed(12),
        justPressed(13),
      ],
    },
    pressedButtons: currentPressed,
  };
}

export function readBrowserGamepad(previousPressed: ReadonlySet<number>): GamepadReadResult {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return EMPTY_GAMEPAD_RESULT;
  }
  const pads = navigator.getGamepads();
  let pad: Gamepad | null = null;
  for (let index = 0; index < pads.length; index += 1) {
    const candidate = pads[index];
    if (candidate?.connected) {
      pad = candidate;
      break;
    }
  }
  return mapStandardGamepad(pad, previousPressed);
}
