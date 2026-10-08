import { describe, expect, it, vi } from "vitest";
import type { GameObjects } from "phaser";
import { playActorIdle } from "./actor-idle";

describe("playable idle animation", () => {
  it("starts after another action, advances across updates and restarts after an interrupted cycle", () => {
    const actor = {
      anims: { currentAnim: { key: "walk" }, isPlaying: true, stop: vi.fn() },
      play: vi.fn(), setFrame: vi.fn(),
    };
    playActorIdle(actor as unknown as GameObjects.Sprite, "legend-idle");
    expect(actor.play).toHaveBeenCalledOnce();
    actor.anims.currentAnim.key = "legend-idle";
    for (let frame = 0; frame < 60; frame++) playActorIdle(actor as unknown as GameObjects.Sprite, "legend-idle");
    expect(actor.play).toHaveBeenCalledOnce();
    expect(actor.setFrame).not.toHaveBeenCalled();
    actor.anims.isPlaying = false;
    playActorIdle(actor as unknown as GameObjects.Sprite, "legend-idle");
    expect(actor.play).toHaveBeenCalledTimes(2);
  });

  it("honors reduced motion and can return to animation when the preference changes", () => {
    const actor = { anims: { currentAnim: { key: "idle" }, isPlaying: false, stop: vi.fn() }, play: vi.fn(), setFrame: vi.fn() };
    playActorIdle(actor as unknown as GameObjects.Sprite, "idle", 0, true);
    expect(actor.anims.stop).toHaveBeenCalledOnce();
    expect(actor.setFrame).toHaveBeenCalledWith(0);
    expect(actor.play).not.toHaveBeenCalled();
    playActorIdle(actor as unknown as GameObjects.Sprite, "idle", 0, false);
    expect(actor.play).toHaveBeenCalledWith("idle");
  });
});
