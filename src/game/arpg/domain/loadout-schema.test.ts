import { describe, expect, it } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { ArpgLoadoutSchema, normalizeLegacyArpgLoadout } from "./loadout-schema";

describe("ARPG loadout compatibility", () => {
  it("projects a four-card legacy loadout to its first two attacks", () => {
    const normalized = normalizeLegacyArpgLoadout({
      ...DEFAULT_ARPG_LOADOUT,
      supportIds: ["support-saci", "support-iara"],
      abilityIds: ["ancestral-roots", "boitata-flame", "saci-whirlwind", "iara-song"],
    }, DEFAULT_ARPG_LOADOUT);

    expect(normalized.abilityIds).toEqual(["ancestral-roots", "boitata-flame"]);
    expect(normalized).not.toHaveProperty("supportIds");
    expect(ArpgLoadoutSchema.parse(normalized)).toEqual(normalized);
  });

  it("requires two different known attack cards in new loadout writes", () => {
    const result = ArpgLoadoutSchema.safeParse({
      ...DEFAULT_ARPG_LOADOUT,
      abilityIds: ["ancestral-roots", "ancestral-roots"],
    });
    expect(result.success).toBe(false);

    const legacyWrite = ArpgLoadoutSchema.safeParse({
      ...DEFAULT_ARPG_LOADOUT,
      supportIds: ["support-saci", "support-iara"],
    });
    expect(legacyWrite.success).toBe(false);
  });
});
