import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CREATURES } from "./creatures";
import { CHARACTER_PORTRAITS } from "./character-portraits";

describe("complete Naturalist-style portrait catalog", () => {
  it("covers every encyclopedia entry without changing species or stages", () => {
    expect(Object.keys(CHARACTER_PORTRAITS).sort()).toEqual(CREATURES.map((creature) => creature.id).sort());
    for (const creature of CREATURES) {
      expect(creature.sprite).toEqual(CHARACTER_PORTRAITS[creature.id]);
      expect(creature.evolutionLine?.[2]?.sprite ?? creature.sprite).toEqual(creature.sprite);
    }
  });

  it("keeps every portrait visible, in bounds and on the 64px pixel grid", async () => {
    for (const sheet of new Set(CREATURES.map((creature) => creature.sprite.sheet))) {
      const { data, info } = await sharp(`public${sheet}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const portraits = CREATURES.filter((creature) => creature.sprite.sheet === sheet);
      const first = portraits[0].sprite;
      expect([info.width, info.height]).toEqual([first.columns * 256, first.rows * 256]);
      let aligned = true; let binary = true;
      const colours = new Set<number>();
      for (let y = 0; y < info.height; y += 4) for (let x = 0; x < info.width; x += 4) {
        const offset = (y * info.width + x) * 4;
        const pixel = data.readUInt32LE(offset);
        colours.add(pixel);
        binary &&= data[offset + 3] === 0 || data[offset + 3] === 255;
        for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
          if (data.readUInt32LE(((y + dy) * info.width + x + dx) * 4) !== pixel) aligned = false;
        }
      }
      expect(aligned, sheet).toBe(true);
      expect(binary, sheet).toBe(true);
      expect(colours.size, sheet).toBeLessThanOrEqual(64);
      for (const creature of portraits) {
        const { column, row } = creature.sprite;
        let count = 0;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          if (data[((row * 256 + y * 4) * info.width + column * 256 + x * 4) * 4 + 3]) count++;
        }
        expect(count, creature.id).toBeGreaterThan(80);
      }
    }
  });
});
