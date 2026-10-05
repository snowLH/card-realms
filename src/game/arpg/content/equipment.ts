import type { ArpgArmorDefinition, ArpgWeaponDefinition } from "../domain/types";
import { MARES_ARMORS, MARES_WEAPONS } from "./arquipelago-das-mares";
import { MATA_ARMORS, MATA_WEAPONS } from "./mata-encantada";
import { RUNIC_ARMORS, RUNIC_WEAPONS } from "./montanhas-runicas";

export const ARPG_WEAPONS = [
  ...MATA_WEAPONS,
  ...MARES_WEAPONS,
  ...RUNIC_WEAPONS,
];

export const ARPG_ARMORS = [
  ...MATA_ARMORS,
  ...MARES_ARMORS,
  ...RUNIC_ARMORS,
];

export const ARPG_WEAPON_BY_ID = new Map(ARPG_WEAPONS.map((item) => [item.id, item]));
export const ARPG_ARMOR_BY_ID = new Map(ARPG_ARMORS.map((item) => [item.id, item]));
export const ARPG_WEAPON_IDS = new Set(ARPG_WEAPON_BY_ID.keys());
export const ARPG_ARMOR_IDS = new Set(ARPG_ARMOR_BY_ID.keys());

export function getWeaponAttackIntervalMs(weapon: ArpgWeaponDefinition, moving: boolean) {
  return weapon.effect?.id === "forest-rhythm" && moving
    ? Math.round(weapon.attackRateMs * 0.85)
    : weapon.attackRateMs;
}

export function getArmorDashCooldownMs(armor: ArpgArmorDefinition, baseCooldownMs: number) {
  return armor.effect?.id === "kelpie-step"
    ? Math.round(baseCooldownMs * 0.8)
    : baseCooldownMs;
}

export function getArmorAbilityCooldownMs(armor: ArpgArmorDefinition, baseCooldownMs: number) {
  return armor.effect?.id === "ritual-focus"
    ? Math.round(baseCooldownMs * 0.9)
    : baseCooldownMs;
}

export function getArmorMovingDefenseBonus(armor: ArpgArmorDefinition, moving: boolean) {
  return armor.effect?.id === "curupira-ward" && moving ? 2 : 0;
}

export function getWeaponAttackProc(weapon: ArpgWeaponDefinition, attackCounter: number) {
  const fourthAttack = attackCounter > 0 && attackCounter % 4 === 0;
  return {
    piercing: weapon.effect?.id === "river-pierce",
    cleaveMultiplier: weapon.effect?.id === "tide-cleave" ? 0.35 : 0,
    echoMultiplier: weapon.effect?.id === "spirit-echo" && fourthAttack ? 0.6 : 0,
    restoreHp: weapon.effect?.id === "iara-renewal" && fourthAttack ? 4 : 0,
  };
}

export function getArmorRetaliationDamage(armor: ArpgArmorDefinition) {
  return armor.effect?.id === "ahuizotl-retaliation" ? 10 : 0;
}
