import "server-only";

import { ARPG_ABILITY_CARD_IDS } from "@/game/arpg/content/ability-cards";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ArpgAbilityOwnershipResult =
  | { valid: true; requiredItemKeys: string[] }
  | { valid: false; reason: "invalid_abilities" }
  | { valid: false; reason: "inventory_unavailable"; code: string }
  | { valid: false; reason: "items_not_owned"; missingItemKeys: string[] };

/** Checks ownership of the two selected powers without requiring ARPG gear. */
export async function validateArpgAbilityOwnership(
  admin: AdminClient,
  playerId: string,
  loadout: Pick<ArpgLoadout, "abilityIds">,
): Promise<ArpgAbilityOwnershipResult> {
  const requiredItemKeys = [...loadout.abilityIds];
  if (requiredItemKeys.length !== 2
    || requiredItemKeys[0] === requiredItemKeys[1]
    || requiredItemKeys.some((id) => !ARPG_ABILITY_CARD_IDS.has(id))) {
    return { valid: false, reason: "invalid_abilities" };
  }

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
