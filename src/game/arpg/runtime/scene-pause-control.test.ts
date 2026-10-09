import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createScenePauseControl } from "./scene-pause-control";

function loadingScene() {
  let active = false;
  let paused = false;
  const events = new EventEmitter();
  const target = {
    events,
    input: { keyboard: { resetKeys: vi.fn() } },
    scene: {
      isActive: () => active && !paused, isPaused: () => paused,
      pause: vi.fn(() => { paused = true; }),
      resume: vi.fn(() => { paused = false; }),
    },
  };
  return { target, create: () => { active = true; events.emit("create"); } };
}

describe("pause requests during scene loading", () => {
  it("pauses the scene immediately after create when rotation suspended it before boot", () => {
    const bridge = { clearGameplayInput: vi.fn() };
    const control = createScenePauseControl(bridge);
    const scene = loadingScene();
    control.setPaused(true);
    control.attach(scene.target);
    expect(scene.target.scene.pause).not.toHaveBeenCalled();
    scene.create();
    expect(scene.target.scene.isPaused()).toBe(true);
    expect(scene.target.input.keyboard.resetKeys).toHaveBeenCalledOnce();
    control.destroy();
  });

  it("uses the most recent request and can resume after a paused creation", () => {
    const control = createScenePauseControl({ clearGameplayInput: vi.fn() });
    const scene = loadingScene();
    control.attach(scene.target);
    control.setPaused(true);
    control.setPaused(false);
    scene.create();
    expect(scene.target.scene.pause).not.toHaveBeenCalled();
    control.setPaused(true);
    control.setPaused(true);
    expect(scene.target.scene.pause).toHaveBeenCalledOnce();
    control.setPaused(false);
    expect(scene.target.scene.resume).toHaveBeenCalledOnce();
    control.destroy();
  });

  it("removes the pending create listener when the game is destroyed during loading", () => {
    const control = createScenePauseControl({ clearGameplayInput: vi.fn() });
    const scene = loadingScene();
    control.attach(scene.target);
    control.setPaused(true);
    control.destroy();
    expect(scene.target.events.listenerCount("create")).toBe(0);
    scene.create();
    expect(scene.target.scene.pause).not.toHaveBeenCalled();
    control.setPaused(true);
    expect(scene.target.scene.pause).not.toHaveBeenCalled();
  });
});
