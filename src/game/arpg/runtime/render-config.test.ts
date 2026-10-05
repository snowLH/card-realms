import { describe, expect, it } from "vitest";
import { ARPG_LOGICAL_VIEWPORT, ARPG_PIXEL_RENDER_SETTINGS } from "./render-config";

describe("ARPG pixel renderer defaults", () => {
  it("keeps the guild and dungeon on one crisp 2D viewport profile", () => {
    expect(ARPG_LOGICAL_VIEWPORT).toEqual({ width: 1280, height: 720 });
    expect(ARPG_PIXEL_RENDER_SETTINGS).toEqual({
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    });
  });
});
