import { z } from "zod";
export const ARTHUR_WARD_RADIUS = 180;
export const ArthurOathsSchema = z.object({
  lastOathReadyAtMs: z.number().nonnegative(), lastOathUntilMs: z.number().nonnegative(),
  ward: z.object({ x: z.number().finite(), y: z.number().finite(), expiresAtMs: z.number().nonnegative() }).optional(),
});
export type ArthurOaths = z.infer<typeof ArthurOathsSchema>;
export const emptyArthurOaths = (): ArthurOaths => ({ lastOathReadyAtMs: 0, lastOathUntilMs: 0 });
export function grantRoundTableWard(memory: ArthurOaths, center: { x: number; y: number }, nowMs: number) {
  memory.ward = { x: center.x, y: center.y, expiresAtMs: nowMs + 5000 };
}
/** All three combat runtimes share this mitigation and use their authority clock. */
export function arthurProtectedDamage(memory: ArthurOaths, damage: number, hp: number, maxHp: number, nowMs: number, position: { x: number; y: number }, isArthur: boolean) {
  if (damage <= 0) return 0;
  if (isArthur && hp - damage <= maxHp * 0.25 && nowMs >= memory.lastOathReadyAtMs) {
    memory.lastOathUntilMs = nowMs + 4000;
    memory.lastOathReadyAtMs = nowMs + 45000;
  }
  let multiplier = isArthur && nowMs < memory.lastOathUntilMs ? 0.65 : 1;
  if (memory.ward && nowMs < memory.ward.expiresAtMs && Math.hypot(position.x - memory.ward.x, position.y - memory.ward.y) <= ARTHUR_WARD_RADIUS) multiplier *= 0.75;
  return Math.max(1, Math.round(damage * multiplier));
}
