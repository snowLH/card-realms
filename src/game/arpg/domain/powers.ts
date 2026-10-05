import { ARPG_ABILITY_CARD_IDS, STARTER_ARPG_ABILITY_IDS } from "../content/ability-cards";

/** Returns permanent card ownership from inventory keys plus the two free starters. */
export function getOwnedArpgAbilityCardIds(inventoryItemKeys: Iterable<string>): string[] {
  const inventory = new Set(inventoryItemKeys);
  return [...new Set<string>([
    ...STARTER_ARPG_ABILITY_IDS,
    ...[...ARPG_ABILITY_CARD_IDS].filter((id) => inventory.has(id)),
  ])];
}
