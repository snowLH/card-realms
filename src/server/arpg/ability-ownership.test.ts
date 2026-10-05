import { describe, expect, it, vi } from "vitest";
import { validateArpgAbilityOwnership } from "./ability-ownership";

function inventoryAdmin(data: Array<{ item_key: string; quantity: number }>, error: { code: string } | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data, error }),
  };
  const admin = { from: vi.fn().mockReturnValue(query) };
  return { admin, query };
}

describe("ARPG power ownership for classic combat", () => {
  it("validates the two owned powers without querying weapon, armor, or relic ownership", async () => {
    const { admin, query } = inventoryAdmin([
      { item_key: "ancestral-roots", quantity: 1 },
      { item_key: "boitata-flame", quantity: 1 },
    ]);

    const result = await validateArpgAbilityOwnership(
      admin as never,
      "player-id",
      { abilityIds: ["ancestral-roots", "boitata-flame"] },
    );

    expect(result).toEqual({
      valid: true,
      requiredItemKeys: ["ancestral-roots", "boitata-flame"],
    });
    expect(query.in).toHaveBeenCalledWith("item_key", ["ancestral-roots", "boitata-flame"]);
  });

  it("rejects a missing or unowned power", async () => {
    const { admin } = inventoryAdmin([
      { item_key: "ancestral-roots", quantity: 1 },
      { item_key: "boitata-flame", quantity: 0 },
    ]);

    await expect(validateArpgAbilityOwnership(
      admin as never,
      "player-id",
      { abilityIds: ["ancestral-roots", "boitata-flame"] },
    )).resolves.toEqual({
      valid: false,
      reason: "items_not_owned",
      missingItemKeys: ["boitata-flame"],
    });
  });

  it("rejects duplicate or unknown powers before querying inventory", async () => {
    const { admin, query } = inventoryAdmin([]);

    await expect(validateArpgAbilityOwnership(
      admin as never,
      "player-id",
      { abilityIds: ["ancestral-roots", "ancestral-roots"] },
    )).resolves.toEqual({ valid: false, reason: "invalid_abilities" });
    await expect(validateArpgAbilityOwnership(
      admin as never,
      "player-id",
      { abilityIds: ["ancestral-roots", "old-supporter-id"] },
    )).resolves.toEqual({ valid: false, reason: "invalid_abilities" });
    expect(query.in).not.toHaveBeenCalled();
  });
});
