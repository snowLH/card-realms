import type { ArpgArmorDefinition, ArpgWeaponDefinition } from "../domain/types";
import { MARES_ARMORS, MARES_WEAPONS } from "./arquipelago-das-mares";
import { MATA_ARMORS, MATA_WEAPONS } from "./mata-encantada";
import { RUNIC_ARMORS, RUNIC_WEAPONS } from "./montanhas-runicas";

export const ARPG_WEAPONS = [
  ...MATA_WEAPONS,
  ...MARES_WEAPONS,
  ...RUNIC_WEAPONS,
];

const LEGACY_ARPG_ARMORS = [
  ...MATA_ARMORS,
  ...MARES_ARMORS,
  ...RUNIC_ARMORS,
];

// Persisted runs still refer to these IDs. They no longer grant equipment
// stats or effects; the old HP values are kept only to recognize old saves.
const LEGACY_ARMOR_HP_BONUS_BY_ID = new Map(LEGACY_ARPG_ARMORS.map((item) => [item.id, item.maxHpBonus]));
export const ARPG_ARMORS: ArpgArmorDefinition[] = LEGACY_ARPG_ARMORS.map(({ id, kind, rarity }) => ({
  id,
  kind,
  rarity,
  name: "Sem armadura",
  description: "Identificador de compatibilidade de uma armadura removida do jogo.",
  maxHpBonus: 0,
  defenseBonus: 0,
  moveSpeedBonus: 0,
}));

export function normalizeArmorlessHealth<T extends { armorId: string; playerHp: number; maxHp: number }>(state: T): T {
  const baseHp = 120;
  const legacyMaxHp = baseHp + (LEGACY_ARMOR_HP_BONUS_BY_ID.get(state.armorId) ?? 0);
  if (state.maxHp !== baseHp && state.maxHp !== legacyMaxHp) return state;
  return { ...state, maxHp: baseHp, playerHp: Math.min(baseHp, state.playerHp) };
}

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
  void armor;
  return baseCooldownMs;
}

export function getArmorAbilityCooldownMs(armor: ArpgArmorDefinition, baseCooldownMs: number) {
  void armor;
  return baseCooldownMs;
}

export function getArmorMovingDefenseBonus(armor: ArpgArmorDefinition, moving: boolean) {
  void armor;
  void moving;
  return 0;
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
  void armor;
  return 0;
}
