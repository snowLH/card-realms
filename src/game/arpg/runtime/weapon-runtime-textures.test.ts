import { describe, expect, it, vi } from "vitest";
import {
  createWeaponRuntimeTextures,
  WEAPON_RUNTIME_TEXTURE_KEYS,
} from "./weapon-runtime-textures";

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

describe("weapon runtime textures", () => {
  it("rasterizes only projectile helpers, never equipable weapons", () => {
    const { scene, graphics } = fakeScene(false);
    createWeaponRuntimeTextures(scene);
    const keys = graphics.generateTexture.mock.calls.map(([key]) => key);
    expect(keys.sort()).toEqual([...WEAPON_RUNTIME_TEXTURE_KEYS].sort());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.includes("projectile"))).toBe(true);
    expect(keys).toHaveLength(2);
    expect(graphics.destroy).toHaveBeenCalledOnce();
  });

  it("does not redraw projectile helpers when they are cached", () => {
    const { scene, graphics } = fakeScene(true);
    createWeaponRuntimeTextures(scene);
    expect(graphics.generateTexture).not.toHaveBeenCalled();
  });
});
