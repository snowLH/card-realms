import type { BossHazard, BossParticipant, BossPhase, BossPoint } from "../boss-definition";

export const ARTHUR_PATTERNS = {
  1: ["royal-cut", "king-step", "camelot-guard", "old-wound"],
  2: ["royal-cut", "dead-march", "camlann-spears", "mordred-cut", "repeated-field", "old-wound"],
  3: ["last-oath", "king-step", "dead-march", "camlann-spears", "camelot-guard", "royal-cut", "old-wound"],
} as const;
export type ArthurPattern = typeof ARTHUR_PATTERNS[BossPhase][number];
export function arthurPattern(phase: BossPhase, index: number): ArthurPattern {
  const patterns = ARTHUR_PATTERNS[phase];
  return patterns[index % patterns.length];
}
export function arthurCooldown(pattern: ArthurPattern) {
  return pattern === "last-oath" ? 5600 : pattern === "old-wound" ? 2500 : pattern === "camelot-guard" ? 2100 : 2400;
}
export function createArthurHazards(options: {
  phase: BossPhase; index: number; boss: BossPoint; target: BossParticipant;
  width: number; height: number; nowMs: number;
}): BossHazard[] {
  const { phase, index, boss, target, width, height, nowMs } = options;
  const pattern = arthurPattern(phase, index);
  const angle = Math.atan2(target.y - boss.y, target.x - boss.x);
  const hazards: BossHazard[] = [];
  const add = (spec: Partial<BossHazard>, delay = 900) => {
    hazards.push({
      id: "arthur:" + phase + ":" + index + ":" + hazards.length,
      pattern, shape: "rect", x: boss.x, y: boss.y, radius: 0,
      width: 300, height: 64, angle, arc: Math.PI * 0.8, damage: 18,
      createdAtMs: nowMs, impactAtMs: nowMs + delay, endsAtMs: nowMs + delay + 180,
      ...spec,
    });
  };
  if (pattern === "royal-cut") add({ shape: "arc", radius: 190, damage: 22 }, 1050);
  if (pattern === "king-step") add({ x: boss.x + Math.cos(angle) * 145, y: boss.y + Math.sin(angle) * 145, width: 320, height: 72 }, 1000);
  if (pattern === "mordred-cut") add({ x: boss.x + Math.cos(angle) * 360, y: boss.y + Math.sin(angle) * 360, width: 800, height: 64, damage: 24 }, 1250);
  if (pattern === "dead-march" || pattern === "camlann-spears") {
    // Alternating lanes always retain an entire safe lane, even with four players.
    for (let lane = 1; lane <= 5; lane += 1) {
      if (lane % 2 === index % 2) continue;
      add({ x: width / 2, y: height * lane / 6, width: width - 128, height: 66, angle: 0, damage: 20 }, 1200 + lane * 110);
    }
  }
  if (pattern === "repeated-field") {
    add({ x: width * (index % 2 ? 0.25 : 0.75), y: height / 2, width: width * 0.35, height: height - 128, angle: 0, damage: 16 }, 1450);
  }
  if (pattern === "last-oath") {
    add({ shape: "arc", radius: 280, arc: Math.PI * 1.2, damage: 26 }, 1600);
    for (let lane = 1; lane <= 5; lane += 2) {
      add({ x: width / 2, y: height * lane / 6, width: width - 128, height: 80, angle: 0, damage: 24 }, 2200 + lane * 260);
    }
  }
  return hazards;
}
export function insideBossHazard(point: BossPoint, hazard: BossHazard, bodyRadius = 18) {
  const dx = point.x - hazard.x;
  const dy = point.y - hazard.y;
  if (hazard.shape === "circle") return Math.hypot(dx, dy) <= hazard.radius + bodyRadius;
  if (hazard.shape === "arc") {
    const delta = Math.atan2(Math.sin(Math.atan2(dy, dx) - hazard.angle), Math.cos(Math.atan2(dy, dx) - hazard.angle));
    return Math.hypot(dx, dy) <= hazard.radius + bodyRadius && Math.abs(delta) <= hazard.arc / 2;
  }
  const x = dx * Math.cos(hazard.angle) + dy * Math.sin(hazard.angle);
  const y = -dx * Math.sin(hazard.angle) + dy * Math.cos(hazard.angle);
  return Math.abs(x) <= hazard.width / 2 + bodyRadius && Math.abs(y) <= hazard.height / 2 + bodyRadius;
}
