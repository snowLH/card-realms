import { z } from "zod";
import { ARPG_ABILITY_CARD_IDS, STARTER_ARPG_ABILITY_IDS } from "../content/ability-cards";
import { ARPG_ARMOR_IDS, ARPG_WEAPON_IDS } from "../content/equipment";
import { ARPG_RELIC_IDS } from "../content/relics";
import type { ArpgLoadout } from "./types";

const weaponId = z.string().refine((id) => ARPG_WEAPON_IDS.has(id), "Arma ARPG inválida");
const armorId = z.string().refine((id) => ARPG_ARMOR_IDS.has(id), "Armadura ARPG inválida");
const relicId = z.string().refine((id) => ARPG_RELIC_IDS.has(id), "Relíquia ARPG inválida");
const abilityId = z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id), "Carta-habilidade ARPG inválida");

export const ArpgLoadoutSchema = z.object({
  weaponId,
  armorId,
  relicId,
  abilityIds: z.tuple([abilityId, abilityId]),
}).strict().superRefine((loadout, context) => {
  if (new Set(loadout.abilityIds).size !== 2) {
    context.addIssue({ code: "custom", message: "O loadout contém cartas repetidas.", path: ["abilityIds"] });
  }
});

export function normalizeLegacyArpgLoadout(value: unknown, fallback: ArpgLoadout): ArpgLoadout {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const oldAbilityIds = Array.isArray(row.abilityIds) ? row.abilityIds : [];
  const picked: string[] = [];

  for (const id of oldAbilityIds) {
    if (typeof id === "string" && ARPG_ABILITY_CARD_IDS.has(id) && !picked.includes(id)) {
      picked.push(id);
      if (picked.length === 2) break;
    }
  }
  for (const id of [...fallback.abilityIds, ...STARTER_ARPG_ABILITY_IDS]) {
    if (picked.length === 2) break;
    if (ARPG_ABILITY_CARD_IDS.has(id) && !picked.includes(id)) picked.push(id);
  }

  const abilityIds: [string, string] = [
    picked[0] ?? fallback.abilityIds[0],
    picked[1] ?? fallback.abilityIds[1],
  ];
  return ArpgLoadoutSchema.parse({
    weaponId: typeof row.weaponId === "string" && ARPG_WEAPON_IDS.has(row.weaponId)
      ? row.weaponId
      : fallback.weaponId,
    armorId: typeof row.armorId === "string" && ARPG_ARMOR_IDS.has(row.armorId)
      ? row.armorId
      : fallback.armorId,
    relicId: typeof row.relicId === "string" && ARPG_RELIC_IDS.has(row.relicId)
      ? row.relicId
      : fallback.relicId,
    abilityIds,
  });
}
