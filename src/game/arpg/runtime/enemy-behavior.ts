import type { EnemyDefinition } from "../domain/types";

export type EnemyCombatRole = NonNullable<EnemyDefinition["combatRole"]>;
export type EnemyMovementIntent = "approach" | "retreat" | "hold";

const RANGED_STANCES: Record<Exclude<EnemyCombatRole, "melee" | "charger">, { retreatBelow: number; approachAbove: number }> = {
  ranged: { retreatBelow: 230, approachAbove: 390 },
  caster: { retreatBelow: 210, approachAbove: 340 },
  elite: { retreatBelow: 250, approachAbove: 370 },
};

export function getEnemyMovementIntent(role: EnemyCombatRole, distance: number, previous: EnemyMovementIntent = "hold"): EnemyMovementIntent {
  if (role === "melee" || role === "charger") return "approach";
  if (!Number.isFinite(distance)) return "hold";
  const stance = RANGED_STANCES[role];
  const hysteresis = 26;
  if (previous === "retreat" && distance < stance.retreatBelow + hysteresis) return "retreat";
  if (previous === "approach" && distance > stance.approachAbove - hysteresis) return "approach";
  if (distance < stance.retreatBelow) return "retreat";
  if (distance > stance.approachAbove) return "approach";
  return "hold";
}
