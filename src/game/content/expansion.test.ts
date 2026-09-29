import { describe, expect, it } from "vitest";
import { CREATURES } from "./creatures";
import { REGIONS } from "./regions";

describe("expansão regional 2D", () => {
  it("adiciona exatamente 25 novas criaturas ao bestiário original", () => {
    expect(CREATURES).toHaveLength(50);
    const secondAtlas = CREATURES.filter((creature) => creature.sprite.sheet.includes("second-atlas"));
    expect(secondAtlas).toHaveLength(25);
    expect(new Set(secondAtlas.map((creature) => `${creature.sprite.row}:${creature.sprite.column}`)).size).toBe(25);
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
