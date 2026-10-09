import { describe, expect, it } from "vitest";
import { CREATURES } from "./creatures";
import { REGIONS } from "./regions";

describe("expansão regional 2D", () => {
  it("preserva as 124 espécies e fornece retratos únicos na mesma família pixel art", () => {
    expect(CREATURES).toHaveLength(124);
    expect(CREATURES.every((creature) => creature.sprite.sheet.endsWith("-v5.webp"))).toBe(true);
    expect(new Set(CREATURES.map((creature) => `${creature.sprite.sheet}:${creature.sprite.row}:${creature.sprite.column}`)).size).toBe(124);
  });

  it("oferece cinco áreas em cada uma das cinco regiões principais", () => {
    const expanded = REGIONS.filter((region) => ["roots", "archipelago", "runic", "mist", "desert"].includes(region.id));
    expect(expanded).toHaveLength(5);
    expect(expanded.flatMap((region) => region.areas ?? [])).toHaveLength(25);
    for (const region of expanded) {
      expect(region.areas).toHaveLength(5);
      expect(region.areas?.[0].unlockAfter).toBeUndefined();
      region.areas?.slice(1).forEach((area, index) => {
        expect(area.unlockAfter).toBe(region.areas?.[index].id);
      });
    }
  });
});
