// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArpgBridge } from "./bridge";
import { bindInputLifecycle } from "./input-lifecycle";

afterEach(() => Reflect.deleteProperty(document, "hidden"));

describe("game input across app suspension", () => {
  it.each(["blur", "pagehide"])("clears held and queued actions on %s and removes listeners on destroy", (event) => {
    const bridge = new ArpgBridge();
    const suspend = vi.fn();
    const release = bindInputLifecycle(bridge, suspend);
    bridge.setMove(1, 0);
    bridge.setAttack(true);
    bridge.queueAbility(0);
    bridge.queueDash();
    window.dispatchEvent(new Event(event));
    expect(bridge.getInput().moveX).toBe(0);
    expect(bridge.getInput().attack).toBe(false);
    expect(bridge.consumeAbility(0)).toBe(false);
    expect(bridge.consumeDash()).toBe(false);
    expect(suspend).toHaveBeenCalledOnce();
    release();
    window.dispatchEvent(new Event(event));
    expect(suspend).toHaveBeenCalledOnce();
  });

  it("suspends only when hidden and never resumes combat automatically", () => {
    const bridge = new ArpgBridge();
    const suspend = vi.fn();
    const release = bindInputLifecycle(bridge, suspend);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(suspend).toHaveBeenCalledOnce();
    release();
  });
});
