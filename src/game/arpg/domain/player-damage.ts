import { ARPG_DAMAGE_INVULNERABILITY_MS } from "./combat-config";

export function resolveLocalPlayerHit(input: {
  hp: number;
  runEnded: boolean;
  timeMs: number;
  nextDamageAtMs: number;
  dashUntilMs: number;
  rawDamage: number;
  defense: number;
}) {
  if (input.runEnded || input.hp <= 0
    || input.timeMs < input.nextDamageAtMs || input.timeMs < input.dashUntilMs) return null;
  const damage = Math.max(1, input.rawDamage - input.defense);
  return {
    hp: Math.max(0, input.hp - damage),
    nextDamageAtMs: input.timeMs + ARPG_DAMAGE_INVULNERABILITY_MS,
  };
}
