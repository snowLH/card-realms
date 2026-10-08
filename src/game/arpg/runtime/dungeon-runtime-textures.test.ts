import { describe, expect, it, vi } from "vitest";
import { createDungeonRuntimeTextures } from "./dungeon-runtime-textures";

function fakeScene(alreadyPresent: boolean) {
  const graphics = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get(target, method) {
      const key = String(method);
      return target[key] ?? (target[key] = vi.fn());
    },
  });
  const scene = {
    add: { graphics: () => graphics },
    textures: { exists: () => alreadyPresent },
  } as unknown as import("phaser").Scene;
  return { scene, graphics };
}

describe("dungeon runtime textures", () => {
  it("registers every texture exactly once per uncached texture set", () => {
    const { scene, graphics } = fakeScene(false);
    createDungeonRuntimeTextures(scene);
    const keys = graphics.generateTexture.mock.calls.map(([key]) => key);
    expect(keys).toContain("arpg-projectile");
    expect(keys).toContain("arpg-ground-shadow");
    expect(keys).toContain("arpg-loot-sword");
    expect(new Set(keys).size).toBe(keys.length);
    expect(graphics.destroy).toHaveBeenCalledOnce();
  });

  it("skips all pixel rasterization when the previous dungeon already registered textures", () => {
    const { scene, graphics } = fakeScene(true);
    createDungeonRuntimeTextures(scene);
    expect(graphics.generateTexture).not.toHaveBeenCalled();
  });
});
