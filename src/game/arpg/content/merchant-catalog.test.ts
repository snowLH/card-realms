import { describe, expect, it } from "vitest";
import { ARPG_MERCHANT_PRODUCTS } from "./merchant-catalog";
import { REFUGE_FURNITURE_UNLOCK_ITEM_KEYS } from "@/game/refuge";

describe("catálogo do Mercador ARPG", () => {
  it("usa chaves únicas e preços positivos para cada produto", () => {
    expect(new Set(ARPG_MERCHANT_PRODUCTS.map((item) => item.itemKey)).size)
      .toBe(ARPG_MERCHANT_PRODUCTS.length);
    expect(ARPG_MERCHANT_PRODUCTS.every((item) => Number.isInteger(item.price) && item.price > 0)).toBe(true);
  });

  it("vende apenas cosméticos que desbloqueiam móveis reais do Refúgio", () => {
    const cosmetics = ARPG_MERCHANT_PRODUCTS.filter((item) => item.category === "cosmetic");

    expect(ARPG_MERCHANT_PRODUCTS.every((item) => item.category === "cosmetic")).toBe(true);
    expect(ARPG_MERCHANT_PRODUCTS.map((item) => item.itemKey)).not.toContain("forest-bow");
    expect(ARPG_MERCHANT_PRODUCTS.map((item) => item.itemKey)).not.toContain("ritual-cloak");
    expect(cosmetics.map((item) => item.itemKey).sort()).toEqual(
      Object.values(REFUGE_FURNITURE_UNLOCK_ITEM_KEYS).sort(),
    );
  });
});
