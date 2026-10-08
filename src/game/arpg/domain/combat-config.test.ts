import { describe, expect, it } from "vitest";
import { ARPG_BASE_HP, ARPG_BASE_SPEED, ARPG_DASH_SPEED, ARPG_DASH_DURATION_MS, ARPG_DASH_COOLDOWN_MS } from "./combat-config";

describe("single source of truth for ARPG movement", () => {
  it("keeps a positive, bounded movement/dash configuration", () => {
    expect(ARPG_BASE_HP).toBeGreaterThan(0);
    expect(ARPG_BASE_SPEED).toBeGreaterThan(0);
    expect(ARPG_DASH_SPEED).toBeGreaterThan(ARPG_BASE_SPEED);
    expect(ARPG_DASH_DURATION_MS).toBeGreaterThan(0);
    expect(ARPG_DASH_COOLDOWN_MS).toBeGreaterThan(ARPG_DASH_DURATION_MS);
    expect(ARPG_DASH_SPEED * ARPG_DASH_DURATION_MS / 1000).toBeLessThan(128);
  });
});
