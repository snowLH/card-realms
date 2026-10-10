import type { BossPose } from "./boss-intro-controller";
import type { BossPoint } from "./boss-definition";

export function purificationPose(elapsedMs: number): BossPose {
  return elapsedMs < 1400 ? "reaching" : elapsedMs < 5200 ? "kneeling" : "restored";
}
export function purificationPosition(center: BossPoint, index: number, count: number): BossPoint {
  const angle = Math.PI / 4 + index * Math.PI * 2 / Math.max(1, count);
  return { x: center.x + Math.cos(angle) * 100, y: center.y + Math.sin(angle) * 100 };
}
export function purificationColor(legendId: string) {
  return ({ curupira: 0xb6d88b, iara: 0x9de8ef, raiju: 0xf4fbff, yeti: 0xd7e9ff } as Record<string, number>)[legendId] ?? 0xf2dea7;
}

export function approachPurification(current: BossPoint, destination: BossPoint, deltaMs: number): BossPoint {
  const distance = Math.hypot(destination.x - current.x, destination.y - current.y);
  const travel = Math.min(distance, Math.max(0, deltaMs) * 0.65);
  return { x: current.x + (destination.x - current.x) / (distance || 1) * travel, y: current.y + (destination.y - current.y) / (distance || 1) * travel };
}
