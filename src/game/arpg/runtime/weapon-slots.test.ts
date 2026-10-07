import { describe, expect, it } from "vitest";
import {
  createWeaponSlots,
  isValidWeaponId,
  pickUpWeapon,
  selectWeaponSlot,
  switchWeaponSlot,
} from "./weapon-slots";

const weaponA = "iron-sword";
const weaponB = "forest-bow";
const weaponC = "ritual-staff";

describe("ARPG weapon slots", () => {
  it("requires a known weapon in A and allows B to start empty", () => {
    expect(createWeaponSlots(weaponA)).toEqual({ A: weaponA, B: null, active: "A" });
    expect(() => createWeaponSlots("unknown-weapon")).toThrow("Arma ARPG inválida");
    expect(() => createWeaponSlots(weaponA, "unknown-weapon")).toThrow("Arma ARPG inválida");
  });

  it("recognizes only weapon IDs registered in the ARPG content", () => {
    expect(isValidWeaponId(weaponA)).toBe(true);
    expect(isValidWeaponId("unknown-weapon")).toBe(false);
    expect(isValidWeaponId(null)).toBe(false);
  });

  it("switches between occupied A and B and stays on A when B is empty", () => {
    const onlyA = createWeaponSlots(weaponA);
    expect(switchWeaponSlot(onlyA)).toBe(onlyA);

    const both = createWeaponSlots(weaponA, weaponB);
    const activeB = switchWeaponSlot(both);
    expect(activeB).toEqual({ A: weaponA, B: weaponB, active: "B" });
    expect(switchWeaponSlot(activeB)).toEqual(both);
    expect(selectWeaponSlot(both, "B")).toEqual(activeB);
  });

  it("rejects selecting B before a weapon has been picked up", () => {
    expect(() => selectWeaponSlot(createWeaponSlots(weaponA), "B")).toThrow("O slot B está vazio");
    expect(() => createWeaponSlots(weaponA, null, "B")).toThrow("O slot B não pode estar ativo");
  });

  it("automatically puts the first picked weapon in B and activates it", () => {
    const state = createWeaponSlots(weaponA);
    const result = pickUpWeapon(state, weaponB);

    expect(result).toEqual({
      status: "equipped",
      slot: "B",
      state: { A: weaponA, B: weaponB, active: "B" },
    });
    expect(state).toEqual({ A: weaponA, B: null, active: "A" });
  });

  it("requires an A/B replacement choice when both slots are occupied", () => {
    const state = createWeaponSlots(weaponA, weaponB);
    expect(pickUpWeapon(state, weaponC)).toEqual({
      status: "choice-required",
      state,
      weaponId: weaponC,
      choices: ["A", "B"],
    });
  });

  it.each(["A", "B"] as const)("replaces the chosen %s slot and activates it", (slot) => {
    const state = createWeaponSlots(weaponA, weaponB);
    const result = pickUpWeapon(state, weaponC, slot);

    expect(result.status).toBe("equipped");
    if (result.status !== "equipped") throw new Error("Esperava uma troca de arma.");
    expect(result.slot).toBe(slot);
    expect(result.state).toEqual(slot === "A"
      ? { A: weaponC, B: weaponB, active: "A" }
      : { A: weaponA, B: weaponC, active: "B" });
  });

  it("rejects an unknown weapon pickup", () => {
    expect(() => pickUpWeapon(createWeaponSlots(weaponA), "unknown-weapon"))
      .toThrow("Arma ARPG inválida");
  });
});
