import { describe, expect, it } from "vitest";

import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import {
  createCartographerAvatarIdleSpritesheet,
  createCartographerAvatarSpritesheet,
  playCartographerPlayerAnimation,
  registerCartographerPlayerAnimations,
} from "./player-sprites";

describe("Cartographer avatar spritesheet", () => {
  it('uses the authored selected legend sheet for the avatar',()=>{
 const url=createCartographerAvatarSpritesheet({...DEFAULT_AVATAR_CONFIG,legendId:'king-arthur'});
 expect(url).toMatch(/^\/art\/.*arthur.*\.webp$/);
 expect(createCartographerAvatarSpritesheet()).toMatch(/curupira.*v5\.webp$/);
});

  it('reuses the same authored atlas for static previews',()=>{
 expect(createCartographerAvatarIdleSpritesheet()).toBe(createCartographerAvatarSpritesheet());
});

  it("registers idle as a single frame while preserving looping movement and one-shot actions", () => {
    const registered: Array<{ key: string; frameRate: number; repeat: number; frames: number[] }> = [];
    const scene = {
      anims: {
        exists: () => false,
        generateFrameNumbers: (_textureKey: string, range: { start: number; end: number }) =>
          Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index),
        create: (animation: (typeof registered)[number]) => registered.push(animation),
      },
    } as unknown as import("phaser").Scene;

    registerCartographerPlayerAnimations(scene);

    expect(registered.find(({ key }) => key === "cartographer-player-idle"))
      .toMatchObject({ frameRate: 1, repeat: 0, frames: [0] });
    expect(registered.find(({ key }) => key === "cartographer-player-walk-down"))
      .toMatchObject({ repeat: -1, frames: [4, 5, 6, 7] });
    expect(registered.find(({ key }) => key === "cartographer-player-attack"))
      .toMatchObject({ repeat: 0, frames: [20, 21, 22, 23] });
    expect(registered.find(({ key }) => key === "cartographer-player-cast-skill-1"))
      .toMatchObject({ repeat: 0, frames: [44, 45, 46, 47] });
  });

  it("stops the current animation and restores frame zero for idle", () => {
    const calls: string[] = [];
    const sprite = {
      anims: {
        currentAnim: { key: "cartographer-player-walk-down" },
        stop: () => calls.push("stop"),
      },
      setFrame: (frame: number) => calls.push(`frame:${frame}`),
      play: (key: string) => calls.push(`play:${key}`),
    } as unknown as import("phaser").GameObjects.Sprite;

    playCartographerPlayerAnimation(sprite, "idle");

    expect(calls).toEqual(["stop", "frame:0"]);
  });
});
