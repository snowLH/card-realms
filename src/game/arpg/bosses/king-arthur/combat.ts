import type { BossEncounterSnapshot } from '../boss-encounter-controller';
import type { BossParticipant } from '../boss-definition';
import { arthurCooldown, arthurPattern, createArthurHazards } from './patterns';
export function advanceArthurCombat(encounter: BossEncounterSnapshot, nowMs: number, previousMs: number, players: readonly BossParticipant[], arena: { width: number; height: number }) {
  if (encounter.state !== "COMBAT") return;
  const stepImpact = encounter.hazards.find((hazard) => hazard.pattern === "king-step" && previousMs < hazard.impactAtMs && nowMs >= hazard.impactAtMs);
  if (stepImpact) {
    encounter.x = Math.max(64, Math.min(arena.width - 64, encounter.x + Math.cos(stepImpact.angle) * 115));
    encounter.y = Math.max(64, Math.min(arena.height - 64, encounter.y + Math.sin(stepImpact.angle) * 115));
  }
  encounter.hazards = encounter.hazards.filter((hazard) => nowMs <= hazard.endsAtMs);
  const target = [...players].filter((player) => player.alive).sort((a, b) => a.id.localeCompare(b.id))[encounter.patternIndex % Math.max(1, players.filter((player) => player.alive).length)];
  if (!target) return;
  // Movement stops during windups and weakness; targets are frozen into hazards.
  if (encounter.hazards.length === 0 && nowMs >= encounter.weakUntilMs && nowMs >= encounter.guardUntilMs) {
    const dx = target.x - encounter.x, dy = target.y - encounter.y;
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(Math.max(0, distance - 130), Math.min(100, nowMs - previousMs) * 0.095);
    encounter.x = Math.max(64, Math.min(arena.width - 64, encounter.x + dx / (distance || 1) * travel));
    encounter.y = Math.max(64, Math.min(arena.height - 64, encounter.y + dy / (distance || 1) * travel));
  }
  if (nowMs < encounter.nextPatternAtMs) return;
  const pattern = arthurPattern(encounter.phase, encounter.patternIndex);
  encounter.pattern = pattern;
  encounter.hazards.push(...createArthurHazards({ phase: encounter.phase, index: encounter.patternIndex, boss: encounter, target, ...arena, nowMs }));
  if (pattern === "camelot-guard") encounter.guardUntilMs = nowMs + 1600;
  if (pattern === "old-wound") encounter.weakUntilMs = nowMs + 2000;
  encounter.patternIndex++;
  encounter.nextPatternAtMs = nowMs + arthurCooldown(pattern);
}
