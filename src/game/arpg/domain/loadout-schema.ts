import { z } from "zod";
import { ARPG_ABILITY_CARD_IDS, STARTER_ARPG_ABILITY_IDS } from "../content/ability-cards";
import { ARPG_ARMOR_IDS, ARPG_WEAPON_IDS, getDefaultSecondaryArpgWeaponId } from "../content/equipment";
import { ARPG_RELIC_IDS } from "../content/relics";
import type { ArpgLoadout } from "./types";

const weaponId = z.string().refine((id) => ARPG_WEAPON_IDS.has(id), "Arma ARPG inválida");
const armorId = z.string().refine((id) => ARPG_ARMOR_IDS.has(id), "Armadura ARPG inválida");
const relicId = z.string().refine((id) => ARPG_RELIC_IDS.has(id), "Relíquia ARPG inválida");
const abilityId = z.string().refine((id) => ARPG_ABILITY_CARD_IDS.has(id), "Carta-habilidade ARPG inválida");

const ArpgLoadoutFieldsSchema = z.object({
  weaponId,
  secondaryWeaponId: weaponId.optional(),
  armorId,
  relicId,
  abilityIds: z.tuple([abilityId, abilityId]),
}).strict();

function refineArpgLoadout(loadout: { weaponId: string; secondaryWeaponId?: string; abilityIds: [string, string] }, context: z.RefinementCtx) {
  if (loadout.secondaryWeaponId === loadout.weaponId) {
    context.addIssue({ code: "custom", message: "Escolha duas armas diferentes.", path: ["secondaryWeaponId"] });
  }
  if (new Set(loadout.abilityIds).size !== 2) {
    context.addIssue({ code: "custom", message: "O loadout contém cartas repetidas.", path: ["abilityIds"] });
  }
}

export const ArpgLoadoutSchema = ArpgLoadoutFieldsSchema
  .superRefine(refineArpgLoadout)
  .transform((loadout) => ({
    ...loadout,
    secondaryWeaponId: loadout.secondaryWeaponId ?? getDefaultSecondaryArpgWeaponId(loadout.weaponId),
  }));

export const ArpgLoadoutWriteSchema = ArpgLoadoutFieldsSchema.extend({ secondaryWeaponId: weaponId })
  .strict()
  .superRefine(refineArpgLoadout);

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
  const weaponId = typeof row.weaponId === "string" && ARPG_WEAPON_IDS.has(row.weaponId)
    ? row.weaponId
    : fallback.weaponId;
  const secondaryWeaponId = typeof row.secondaryWeaponId === "string"
    && ARPG_WEAPON_IDS.has(row.secondaryWeaponId)
    && row.secondaryWeaponId !== weaponId
    ? row.secondaryWeaponId
    : fallback.secondaryWeaponId && fallback.secondaryWeaponId !== weaponId
      ? fallback.secondaryWeaponId
      : getDefaultSecondaryArpgWeaponId(weaponId);
  return ArpgLoadoutSchema.parse({
    weaponId,
    secondaryWeaponId,
    armorId: typeof row.armorId === "string" && ARPG_ARMOR_IDS.has(row.armorId)
      ? row.armorId
      : fallback.armorId,
    relicId: typeof row.relicId === "string" && ARPG_RELIC_IDS.has(row.relicId)
      ? row.relicId
      : fallback.relicId,
    abilityIds,
  });
}
