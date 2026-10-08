/** Cooperative enemy health scales with the number of living members at
 * the moment a wave starts. Damage is kept constant for fair revives.
 * Co-op parties start at 2 and contain at most 4 participants.
 */
export function scaleCoopEnemyHealth(baseHp: number, elite: boolean, partySize: number): number {
  const members = Number.isFinite(partySize) ? Math.min(4, Math.max(2, Math.floor(partySize))) : 2;
  const roomFactor = elite ? 0.7 : 0.5;
  const playerFactor = 1 + (members - 2) * 0.28;
  return Math.max(24, Math.round(baseHp * roomFactor * playerFactor));
}
