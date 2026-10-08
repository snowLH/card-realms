import { describe, expect, it, vi } from "vitest";
import { indexRuntimeEntities } from "./entity-index";

describe("runtime entity snapshot indexing", () => {
  it("looks up enemies in linear time without losing identity", () => {
    const sprites = Array.from({ length: 24 }, (_, index) => ({
      getData: vi.fn(() => `enemy-${index}`),
    }));
    const indexed = indexRuntimeEntities(sprites);
    expect(indexed.size).toBe(24);
    expect(indexed.get("enemy-17")).toBe(sprites[17]);
    expect(sprites.every((sprite) => sprite.getData.mock.calls.length === 1)).toBe(true);
  });

  it("skips missing and invalid ids without inventing aliases", () => {
    const a = { getData: () => undefined };
    const b = { getData: () => "" };
    expect(indexRuntimeEntities([a, b]).size).toBe(0);
  });
});
