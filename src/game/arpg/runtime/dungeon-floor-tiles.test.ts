import { describe, expect, it } from "vitest";
import { drawBiomeFloorVariant } from "./dungeon-floor-tiles";

const palette = { floor: "#101010", wall: "#222222", floorDetail: "#333333", wallHighlight: "#ffffff" };

function draw(regionId: string, variant: number) {
  const rects: string[] = [];
  const context = {
    fillStyle: "",
    globalAlpha: 1,
    fillRect(this: { fillStyle: string }, x: number, y: number, width: number, height: number) {
      rects.push([x, y, width, height, this.fillStyle].join(":"));
    },
  } as unknown as CanvasRenderingContext2D;
  drawBiomeFloorVariant(context, 64, variant, palette, regionId);
  return { rects, context };
}

describe("deterministic biome floor tile variants", () => {
  it.each(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"])(
    "creates two distinct pixel-art patterns for %s",
    (regionId) => {
      const first = draw(regionId, 0);
      const second = draw(regionId, 1);
      expect(first.rects.length).toBeGreaterThan(6);
      expect(first.rects).not.toEqual(second.rects);
      expect(first.context.globalAlpha).toBe(1);
      expect(second.context.globalAlpha).toBe(1);
    },
  );
  it("keeps the biome border tile inside its 32px grid cell", () => {
    for (const region of ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"]) {
      for (const rect of draw(region, 1).rects) {
        const [x, y, width, height] = rect.split(":").map(Number);
        expect(x).toBeGreaterThanOrEqual(64);
        expect(x + width).toBeLessThanOrEqual(96);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + height).toBeLessThanOrEqual(32);
      }
    }
  });
});
