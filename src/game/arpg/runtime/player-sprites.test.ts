import { describe, expect, it } from "vitest";
import type { AvatarConfig } from "@/game/save/local-progress";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import {
  createCartographerAvatarIdleSpritesheet,
  createCartographerAvatarSpritesheet,
  playCartographerPlayerAnimation,
  registerCartographerPlayerAnimations,
} from "./player-sprites";

describe("Cartographer avatar spritesheet", () => {
  it("builds the animated 4×13 sheet from the selected avatar config", () => {
    const avatar: AvatarConfig = {
      ...DEFAULT_AVATAR_CONFIG,
      skin: "rose",
      hair: "mohawk",
      outfit: "scholar",
      armor: "guardian",
      accent: "crimson",
    };
    const url = createCartographerAvatarSpritesheet(avatar);
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));

    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(svg).toContain('width="756" height="2457"');
    const frameGroups = [...svg.matchAll(/<g transform="translate\((\d+) (\d+)\)">/g)];
    expect(frameGroups).toHaveLength(52);
    expect(frameGroups.map(([, x]) => Number(x)))
      .toEqual(Array.from({ length: 13 }, () => [0, 189, 378, 567]).flat());
    expect(frameGroups.map(([, , y]) => Number(y)))
      .toEqual(Array.from({ length: 13 }, (_, row) => Array(4).fill(row * 189)).flat());
    expect(svg).toContain("shape-rendering=\"crispEdges\"");
    expect(svg).not.toContain("<ellipse");
    expect(svg).not.toContain("<image");
    expect(svg.match(/<rect\b/g)?.length).toBeGreaterThan(44);
    expect(svg).not.toMatch(/<rect x="0" y="0" width="756" height="2457"/);

    const skillOnePose = svg.match(/<g transform="translate\(0 2079\)">([\s\S]*?)<\/g>/)?.[1];
    const skillTwoPose = svg.match(/<g transform="translate\(0 2268\)">([\s\S]*?)<\/g>/)?.[1];
    expect(skillOnePose).toBeDefined();
    expect(skillTwoPose).toBeDefined();
    expect(skillOnePose).not.toEqual(skillTwoPose);
    expect(skillOnePose).toContain("#fff0ad");
    expect(skillTwoPose).toContain("#d2fff0");

    const rects = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)];
    expect(rects.length).toBeGreaterThan(44);
    for (const [, x, y, width, height] of rects) {
      for (const value of [x, y, width, height]) expect(Number(value) % 3).toBe(0);
      expect(Number(width)).toBeGreaterThan(0);
      expect(Number(height)).toBeGreaterThan(0);
    }

    expect(svg).toContain("#edb6a2");
    expect(svg).toContain("#292027");
    expect(svg).toContain("#ec6671");
  });

  it("keeps every idle preview cell on the same static rest pose", () => {
    const url = createCartographerAvatarIdleSpritesheet();
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    const frames = [...svg.matchAll(/<g transform="translate\((\d+) 0\)">([\s\S]*?)<\/g>/g)];
    const poses = frames.map(([, , pose]) => pose);

    expect(frames.map(([, x]) => Number(x))).toEqual([0, 189, 378, 567]);
    expect(poses).toHaveLength(4);
    expect(poses.every((pose) => pose === poses[0])).toBe(true);
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
