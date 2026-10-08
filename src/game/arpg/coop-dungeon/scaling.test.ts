import { describe, expect, it } from "vitest";
import { scaleCoopEnemyHealth } from "./scaling";

describe("co-op enemy scaling", () => {
  it("preserves two-player baseline health and increases for larger parties", () => {
    expect(scaleCoopEnemyHealth(200, false, 2)).toBe(100);
    expect(scaleCoopEnemyHealth(200, false, 3)).toBe(128);
    expect(scaleCoopEnemyHealth(200, false, 4)).toBe(156);
    expect(scaleCoopEnemyHealth(200, true, 2)).toBe(140);
    expect(scaleCoopEnemyHealth(200, true, 4)).toBe(218);
  });

  it("bounds party size and protects small enemies from spawning dead", () => {
    expect(scaleCoopEnemyHealth(4, false, 4)).toBe(24);
    expect(scaleCoopEnemyHealth(200, false, 1)).toBe(scaleCoopEnemyHealth(200, false, 2));
    expect(scaleCoopEnemyHealth(200, false, 100)).toBe(scaleCoopEnemyHealth(200, false, 4));
    expect(scaleCoopEnemyHealth(200, false, Number.NaN)).toBe(scaleCoopEnemyHealth(200, false, 2));
  });
});
