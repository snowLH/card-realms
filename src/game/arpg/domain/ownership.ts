import { ARPG_ABILITY_CARD_IDS } from "../content/ability-cards";
import { ARPG_WEAPONS } from "../content/equipment";
import {
  getLegendSignatureAbilityIds,
  hasExactLegendPowers,
  legendInventoryKey,
  PLAYABLE_LEGENDS,
  type PlayableLegendId,
} from "../content/legends";
import { ARPG_MERCHANT_PRODUCT_KEYS } from "../content/merchant-catalog";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { ARPG_RELIC_IDS, STARTER_ARPG_RELIC_ID } from "../content/relics";
import type { ArpgLoadout } from "./types";

const ARPG_EQUIPMENT_IDS = new Set(ARPG_WEAPONS.map((weapon) => weapon.id));

/** Current ARPG permanent inventory entries; excludes legacy card energies. */
export const ARPG_INVENTORY_ITEM_IDS = new Set([
  ...ARPG_EQUIPMENT_IDS,
  ...ARPG_RELIC_IDS,
  ...ARPG_ABILITY_CARD_IDS,
  ...ARPG_MERCHANT_PRODUCT_KEYS,
  ...PLAYABLE_LEGENDS.map((legend) => legendInventoryKey(legend.id)),
]);

/** The free starter always remains playable, even before a profile sync. */
export function getOwnedPlayableLegendIds(inventoryItemKeys: readonly string[]): PlayableLegendId[] {
  const owned = new Set(inventoryItemKeys);
  return ["curupira", ...PLAYABLE_LEGENDS
    .filter((legend) => legend.id !== "curupira" && owned.has(legendInventoryKey(legend.id)))
    .map((legend) => legend.id)];
}

/** Fails closed on unowned equipment; signature powers belong to the active legend. */
export function normalizeArpgLoadoutOwnership(
  loadout: ArpgLoadout,
  inventoryItemKeys: readonly string[],
  legendId: PlayableLegendId,
): ArpgLoadout {
  const owned = new Set([
    DEFAULT_ARPG_LOADOUT.weaponId,
    DEFAULT_ARPG_LOADOUT.armorId,
    STARTER_ARPG_RELIC_ID,
    ...inventoryItemKeys,
  ]);
  const abilityIds: [string, string] = hasExactLegendPowers(loadout.abilityIds, legendId)
    ? [...loadout.abilityIds]
    : getLegendSignatureAbilityIds(legendId);
  return {
    ...loadout,
    weaponId: owned.has(loadout.weaponId) ? loadout.weaponId : DEFAULT_ARPG_LOADOUT.weaponId,
    // The historical field stays readable, but the current game has no armor bonuses.
    armorId: DEFAULT_ARPG_LOADOUT.armorId,
    relicId: ARPG_RELIC_IDS.has(loadout.relicId) && owned.has(loadout.relicId)
      ? loadout.relicId
      : STARTER_ARPG_RELIC_ID,
    abilityIds,
  };
}
