// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHubViewportControl } from "./hub-viewport-control";

afterEach(() => vi.unstubAllGlobals());

function fixture(portrait = false) {
  let width = 915;
  let height = 412;
  let notifyResize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { notifyResize = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  const parent = document.createElement("div");
  Object.defineProperties(parent, {
    clientWidth: { get: () => width },
    clientHeight: { get: () => height },
  });
  const scale = { scaleMode: 3, autoCenter: 1, setGameSize: vi.fn(), refresh: vi.fn() };
  const clearInput = vi.fn();
  const control = createHubViewportControl(parent,
    { portrait: 5, landscape: 3, centered: 1, uncentered: 0 }, portrait, clearInput);
  const attach = () => control.attach(scale as unknown as Parameters<typeof control.attach>[0]);
  return {
    control, scale, clearInput, disconnect, attach,
    resize(w: number, h: number) { width = w; height = h; notifyResize(); },
  };
}

describe("Guilda viewport lifecycle", () => {
  it("retains a rotation during loading and applies it when the canvas boots", () => {
    const view = fixture();
    view.resize(393, 873);
    view.control.setPortraitMode(true);
    expect(view.scale.setGameSize).not.toHaveBeenCalled();
    view.attach();
    expect(view.scale.scaleMode).toBe(5);
    expect(view.scale.autoCenter).toBe(0);
    expect(view.scale.setGameSize).toHaveBeenLastCalledWith(393, 873);
    view.control.destroy();
  });

  it("changes the same canvas between orientations and releases held input once per rotation", () => {
    const view = fixture();
    view.attach();
    expect(view.scale.setGameSize).toHaveBeenLastCalledWith(1280, 720);
    view.resize(360, 800);
    view.control.setPortraitMode(true);
    expect(view.scale.setGameSize).toHaveBeenLastCalledWith(360, 800);
    view.control.setPortraitMode(true);
    expect(view.clearInput).toHaveBeenCalledOnce();
    view.resize(800, 360);
    view.control.setPortraitMode(false);
    expect(view.scale.setGameSize).toHaveBeenLastCalledWith(1280, 720);
    expect(view.scale.autoCenter).toBe(1);
    expect(view.clearInput).toHaveBeenCalledTimes(2);
    view.control.destroy();
  });

  it("follows browser-bar resizing in portrait without clearing controls again", () => {
    const view = fixture(true);
    view.resize(393, 873);
    view.attach();
    view.resize(393, 810);
    expect(view.scale.setGameSize).toHaveBeenLastCalledWith(393, 810);
    view.resize(393, 810);
    expect(view.scale.setGameSize).toHaveBeenCalledTimes(2);
    expect(view.scale.refresh).toHaveBeenCalledOnce();
    expect(view.clearInput).not.toHaveBeenCalled();
    view.control.destroy();
  });

  it("disconnects observation and ignores boot or resize callbacks after destruction", () => {
    const view = fixture();
    view.attach();
    view.control.destroy();
    view.resize(393, 873);
    view.control.setPortraitMode(true);
    view.attach();
    expect(view.disconnect).toHaveBeenCalledOnce();
    expect(view.scale.setGameSize).toHaveBeenCalledOnce();
    expect(view.clearInput).not.toHaveBeenCalled();
    const early = fixture();
    early.control.destroy();
    early.attach();
    expect(early.scale.setGameSize).not.toHaveBeenCalled();
  });
});
