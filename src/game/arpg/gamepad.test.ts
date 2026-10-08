import { describe, expect, it } from "vitest";
import { mapStandardGamepad, normalizeGamepadAxis } from "./runtime/gamepad";

function buttons(...pressedIndexes: number[]) {
  return Array.from({ length: 16 }, (_, index) => ({
    pressed: pressedIndexes.includes(index),
    value: pressedIndexes.includes(index) ? 1 : 0,
  }));
}

describe("entrada ARPG por gamepad", () => {
  it("remove drift dentro da deadzone e preserva direção fora dela", () => {
    expect(normalizeGamepadAxis(0.1)).toBe(0);
    expect(normalizeGamepadAxis(-0.1)).toBe(0);
    expect(normalizeGamepadAxis(1)).toBe(1);
    expect(normalizeGamepadAxis(-1)).toBe(-1);
    expect(normalizeGamepadAxis(0.6)).toBeGreaterThan(0.4);
    expect(normalizeGamepadAxis(Number.NaN)).toBe(0);
    expect(normalizeGamepadAxis(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("mapeia sticks e botões do controle padrão", () => {
    const result = mapStandardGamepad({
      connected: true,
      axes: [0.8, -0.7, 0.6, 0.4],
      buttons: buttons(0, 1, 3, 5, 12, 13),
    });
    expect(result.frame.connected).toBe(true);
    expect(result.frame.moveX).toBeGreaterThan(0);
    expect(result.frame.moveY).toBeLessThan(0);
    expect(result.frame.aimX).toBeGreaterThan(0);
    expect(result.frame.attack).toBe(true);
    expect(result.frame.dashPressed).toBe(true);
    expect(result.frame.interactPressed).toBe(true);
    expect(result.frame.abilityPressed[0]).toBe(true);
    expect(result.frame.abilityPressed[1]).toBe(true);
  });

  it("não repete comandos de borda enquanto o botão continua pressionado", () => {
    const first = mapStandardGamepad({ connected: true, axes: [], buttons: buttons(1, 2, 3, 5, 12, 13) });
    const held = mapStandardGamepad(
      { connected: true, axes: [], buttons: buttons(1, 2, 3, 5, 12, 13) },
      first.pressedButtons,
    );
    expect(first.frame.dashPressed).toBe(true);
    expect(held.frame.dashPressed).toBe(false);
    expect(held.frame.interactPressed).toBe(false);
    expect(held.frame.abilityPressed[0]).toBe(false);
    expect(held.frame.abilityPressed[1]).toBe(false);
  });

  it("sanitizes corrupt hardware stick readings instead of poisoning physics", () => {
    const result = mapStandardGamepad({ connected: true, axes: [Number.NaN, Infinity, -Infinity, 0.5], buttons: buttons() });
    expect(result.frame.moveX).toBe(0);
    expect(result.frame.moveY).toBe(0);
    expect(result.frame.aimX).toBe(0);
    expect(Number.isFinite(result.frame.aimY)).toBe(true);
  });

  it("reutiliza o frame neutro sem alocações quando não há controle conectado", () => {
    const result = mapStandardGamepad(null, new Set([1, 2]));
    const next = mapStandardGamepad(null);
    expect(result).toBe(next);
    expect(result.frame.connected).toBe(false);
    expect(result.frame.attack).toBe(false);
    expect(result.pressedButtons.size).toBe(0);
  });
});
