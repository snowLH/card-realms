import { describe, expect, it } from "vitest";
import { getEnemyMovementIntent, type EnemyCombatRole } from "./enemy-behavior";

describe("getEnemyMovementIntent", () => {
  it.each(["melee", "charger"] as const)("%s pursues instead of kiting", (role) => {
    expect(getEnemyMovementIntent(role, 500)).toBe("approach");
    expect(getEnemyMovementIntent(role, 90)).toBe("approach");
  });

  it.each([
    ["ranged", 200, 300, 450],
    ["caster", 180, 270, 400],
    ["elite", 200, 300, 430],
  ] as const)("%s keeps a readable combat distance", (role: EnemyCombatRole, close, preferred, far) => {
    expect(getEnemyMovementIntent(role, close)).toBe("retreat");
    expect(getEnemyMovementIntent(role, preferred)).toBe("hold");
    expect(getEnemyMovementIntent(role, far)).toBe("approach");
  });
});
