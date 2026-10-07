import { ARPG_WEAPON_IDS } from "../content/equipment";

export type WeaponSlot = "A" | "B";

/** The Legend always has a weapon in A; B is filled by a dungeon pickup. */
export type WeaponSlots = Readonly<{
  A: string;
  B: string | null;
  active: WeaponSlot;
}>;

export type WeaponPickupResult =
  | Readonly<{ status: "equipped"; state: WeaponSlots; slot: WeaponSlot }>
  | Readonly<{
      status: "choice-required";
      state: WeaponSlots;
      weaponId: string;
      choices: readonly ["A", "B"];
    }>;

const WEAPON_SLOTS = ["A", "B"] as const;

export function isValidWeaponId(value: unknown): value is string {
  return typeof value === "string" && ARPG_WEAPON_IDS.has(value);
}

function assertWeaponId(value: unknown): asserts value is string {
  if (!isValidWeaponId(value)) {
    throw new Error("Arma ARPG inválida.");
  }
}

function assertSlot(value: unknown): asserts value is WeaponSlot {
  if (value !== "A" && value !== "B") {
    throw new Error("Slot de arma inválido.");
  }
}

function assertWeaponSlots(value: WeaponSlots): void {
  assertWeaponId(value?.A);
  if (value.B !== null) assertWeaponId(value.B);
  assertSlot(value.active);
  if (value.active === "B" && value.B === null) {
    throw new Error("O slot B não pode estar ativo enquanto estiver vazio.");
  }
}

/** Creates the initial slots and rejects unknown IDs or an empty active slot. */
export function createWeaponSlots(
  weaponA: string,
  weaponB: string | null = null,
  active: WeaponSlot = "A",
): WeaponSlots {
  assertWeaponId(weaponA);
  if (weaponB !== null) assertWeaponId(weaponB);
  assertSlot(active);
  if (active === "B" && weaponB === null) {
    throw new Error("O slot B não pode estar ativo enquanto estiver vazio.");
  }

  return { A: weaponA, B: weaponB, active };
}

/** Selects an occupied slot without mutating the supplied state. */
export function selectWeaponSlot(state: WeaponSlots, slot: WeaponSlot): WeaponSlots {
  assertWeaponSlots(state);
  assertSlot(slot);
  if (state[slot] === null) {
    throw new Error(`O slot ${slot} está vazio.`);
  }
  return state.active === slot ? state : { ...state, active: slot };
}

/** Toggles between A and B; an empty B leaves A active. */
export function switchWeaponSlot(state: WeaponSlots): WeaponSlots {
  assertWeaponSlots(state);
  const next = state.active === "A" ? "B" : "A";
  return state[next] === null ? state : { ...state, active: next };
}

/**
 * Puts the first dungeon weapon into B and equips it immediately. When both
 * slots are occupied, callers must ask the player which slot to replace.
 */
export function pickUpWeapon(
  state: WeaponSlots,
  weaponId: string,
  replaceSlot?: WeaponSlot,
): WeaponPickupResult {
  assertWeaponSlots(state);
  assertWeaponId(weaponId);

  if (state.B === null) {
    return {
      status: "equipped",
      slot: "B",
      state: { ...state, B: weaponId, active: "B" },
    };
  }

  if (replaceSlot === undefined) {
    return {
      status: "choice-required",
      state,
      weaponId,
      choices: WEAPON_SLOTS,
    };
  }

  assertSlot(replaceSlot);
  return {
    status: "equipped",
    slot: replaceSlot,
    state: replaceSlot === "A"
      ? { ...state, A: weaponId, active: "A" }
      : { ...state, B: weaponId, active: "B" },
  };
}
