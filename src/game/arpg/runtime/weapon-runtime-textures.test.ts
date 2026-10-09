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
  it("rasterizes a dedicated texture for every weapon plus ranged projectiles", () => {
    const { scene, graphics } = fakeScene(false);
    createWeaponRuntimeTextures(scene);
    const keys = graphics.generateTexture.mock.calls.map(([key]) => key);
    expect(keys.sort()).toEqual([...WEAPON_RUNTIME_TEXTURE_KEYS].sort());
    expect(new Set(keys).size).toBe(keys.length);
    expect(graphics.destroy).toHaveBeenCalledOnce();
  });

  it("does not redraw the arsenal when every generated texture is cached", () => {
    const { scene, graphics } = fakeScene(true);
    createWeaponRuntimeTextures(scene);
    expect(graphics.generateTexture).not.toHaveBeenCalled();
  });
});
