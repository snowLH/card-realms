import { describe, expect, it } from "vitest";
import { getRegionalBossPattern } from "./region-boss-patterns";

describe("regional boss combat patterns", () => {
  it("gains new options with each phase of Iara", () => {
    expect(getRegionalBossPattern("arquipelago-das-mares", 1, 5)).toBe("tide-volley");
    expect([0, 1].map((index) => getRegionalBossPattern("arquipelago-das-mares", 2, index)))
      .toEqual(["undertow-sweep", "tide-volley"]);
    expect([0, 1, 2].map((index) => getRegionalBossPattern("arquipelago-das-mares", 3, index)))
      .toEqual(["deep-current", "undertow-sweep", "tide-volley"]);
  });
  it("gains new options with each phase of Amarok", () => {
    expect(getRegionalBossPattern("montanhas-runicas", 1, 10)).toBe("frost-shards");
    expect([0, 1].map((index) => getRegionalBossPattern("montanhas-runicas", 2, index)))
      .toEqual(["ice-lanes", "frost-shards"]);
    expect([0, 1, 2].map((index) => getRegionalBossPattern("montanhas-runicas", 3, index)))
      .toEqual(["whiteout-charge", "ice-lanes", "frost-shards"]);
  });
});
