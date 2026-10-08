import { describe, expect, it } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { getLegendSignatureAbilityIds, legendInventoryKey } from "../content/legends";
import { ARPG_INVENTORY_ITEM_IDS, getOwnedPlayableLegendIds, normalizeArpgLoadoutOwnership } from "./ownership";

describe("ARPG account inventory and loadout authority", () => {
  it("always makes the free Curupira playable, without exposing unowned legends", () => {
    expect(getOwnedPlayableLegendIds([])).toEqual(["curupira"]);
    expect(getOwnedPlayableLegendIds([legendInventoryKey("iara"), "legacy-energy-fire"]))
      .toEqual(["curupira", "iara"]);
    expect(ARPG_INVENTORY_ITEM_IDS.has("legacy-energy-fire")).toBe(false);
  });
  it("prevents using another legend's signature powers", () => {
    const changed = normalizeArpgLoadoutOwnership({
      ...DEFAULT_ARPG_LOADOUT,
      abilityIds: getLegendSignatureAbilityIds("iara"),
    }, [], "curupira");
    expect(changed.abilityIds).toEqual(getLegendSignatureAbilityIds("curupira"));
  });
  it("rejects unowned equipment without deleting valid owned powers", () => {
    const ownedPower = getLegendSignatureAbilityIds("iara");
    const chosen = normalizeArpgLoadoutOwnership({
      ...DEFAULT_ARPG_LOADOUT,
      weaponId: "made-up-weapon",
      armorId: "made-up-armor",
      relicId: "made-up-relic",
      abilityIds: ownedPower,
    }, [], "iara");
    expect(chosen.weaponId).toBe(DEFAULT_ARPG_LOADOUT.weaponId);
    expect(chosen.armorId).toBe(DEFAULT_ARPG_LOADOUT.armorId);
    expect(chosen.relicId).toBe(DEFAULT_ARPG_LOADOUT.relicId);
    expect(chosen.abilityIds).toEqual(ownedPower);
  });
});
