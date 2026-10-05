import "server-only";

import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { getDefaultSecondaryArpgWeaponId } from "@/game/arpg/content/equipment";
import { STARTER_ARPG_RELIC_ID } from "@/game/arpg/content/relics";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ArpgLoadoutOwnershipResult =
  | { valid: true; requiredItemKeys: string[] }
  | { valid: false; reason: "inventory_unavailable"; code: string }
  | { valid: false; reason: "items_not_owned"; missingItemKeys: string[] };

/**
 * Confirms every selected permanent item against the account inventory.
 * The default weapon, armor, and relic are starter equipment; the two powers
 * always require explicit inventory ownership.
 */
export async function validateArpgLoadoutOwnership(
  admin: AdminClient,
  playerId: string,
  loadout: ArpgLoadout,
): Promise<ArpgLoadoutOwnershipResult> {
  const secondaryWeaponId = loadout.secondaryWeaponId
    ?? getDefaultSecondaryArpgWeaponId(loadout.weaponId);
  if (secondaryWeaponId === loadout.weaponId) {
    return { valid: false, reason: "items_not_owned", missingItemKeys: ["distinct-secondary-weapon"] };
  }
  const requiredItemKeys = [...new Set([
    ...(loadout.weaponId === DEFAULT_ARPG_LOADOUT.weaponId ? [] : [loadout.weaponId]),
    ...(secondaryWeaponId === DEFAULT_ARPG_LOADOUT.secondaryWeaponId ? [] : [secondaryWeaponId]),
    ...(loadout.armorId === DEFAULT_ARPG_LOADOUT.armorId ? [] : [loadout.armorId]),
    ...(loadout.relicId === STARTER_ARPG_RELIC_ID ? [] : [loadout.relicId]),
    ...loadout.abilityIds,
  ])];
  const { data, error } = await admin
    .from("inventory_items")
    .select("item_key,quantity")
    .eq("user_id", playerId)
    .in("item_key", requiredItemKeys);

  if (error) {
    return { valid: false, reason: "inventory_unavailable", code: error.code };
  }

  const owned = new Set(
    (data ?? [])
      .filter((row) => Number(row.quantity) > 0)
      .map((row) => String(row.item_key)),
  );
  const missingItemKeys = requiredItemKeys.filter((itemKey) => !owned.has(itemKey));
  return missingItemKeys.length === 0
    ? { valid: true, requiredItemKeys }
    : { valid: false, reason: "items_not_owned", missingItemKeys };
}
