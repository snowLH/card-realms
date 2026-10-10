import { z } from "zod";
import { BOSS_STATES, bossPhaseAtHp, type BossParticipant, type BossPoint, type BossState } from "./boss-definition";
import { bossById } from "./registry";
import { bossIntroDuration } from "./boss-intro-controller";
import { advanceBossCombat } from "./boss-combat-strategies";

const PointNumber = z.number().finite().min(0).max(4096);
// A telegraphed sweep may be centered beyond a wall while intersecting the arena.
const HazardPointNumber = z.number().finite().min(-4096).max(8192);
export const BossEncounterSchema = z.object({
  version: z.literal(1), bossId: z.string().min(1).max(80),
  state: z.enum(BOSS_STATES), enteredAtMs: z.number().nonnegative(),
  stateAtMs: z.number().nonnegative(), serverTimeMs: z.number().nonnegative(),
  introDurationMs: z.number().min(0).max(10000), seenByAll: z.boolean(),
  participantIds: z.array(z.string().min(1)).min(1).max(4),
  skipVotes: z.array(z.string()).max(4),
  hp: z.number().min(0).max(100000), maxHp: z.number().min(1).max(100000),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  x: PointNumber, y: PointNumber, patternIndex: z.number().int().nonnegative(),
  nextPatternAtMs: z.number().nonnegative(), guardUntilMs: z.number().nonnegative(),
  weakUntilMs: z.number().nonnegative(), pattern: z.string().nullable(),
  hazards: z.array(z.object({
    id: z.string(), pattern: z.string(), shape: z.enum(["arc", "rect", "circle"]),
    x: HazardPointNumber, y: HazardPointNumber, radius: z.number().nonnegative(),
    width: z.number().nonnegative(), height: z.number().nonnegative(),
    angle: z.number().finite(), arc: z.number().nonnegative(), damage: z.number().nonnegative(),
    createdAtMs: z.number().nonnegative(), impactAtMs: z.number().nonnegative(), endsAtMs: z.number().nonnegative(),
  })).max(32),
});
export type BossEncounterSnapshot = z.infer<typeof BossEncounterSchema>;
export function transitionBoss(encounter: BossEncounterSnapshot, next: BossState, nowMs: number) {
  const expected = BOSS_STATES[BOSS_STATES.indexOf(encounter.state) + 1];
  if (next !== expected) throw new Error("Transição inválida: " + encounter.state + " -> " + next);
  encounter.state = next;
  encounter.stateAtMs = nowMs;
}
export function createBossEncounter(bossId: string, nowMs: number, participants: readonly string[], maxHp: number, throne: BossPoint, seenByAll = false): BossEncounterSnapshot {
  const definition = bossById(bossId);
  const encounter: BossEncounterSnapshot = {
    version: 1, bossId, state: "INACTIVE", enteredAtMs: nowMs, stateAtMs: nowMs,
    serverTimeMs: nowMs, introDurationMs: bossIntroDuration(definition, seenByAll),
    seenByAll, participantIds: [...participants], skipVotes: [], hp: maxHp, maxHp, phase: 1,
    ...throne, patternIndex: 0, nextPatternAtMs: nowMs + bossIntroDuration(definition, seenByAll) + 800,
    guardUntilMs: 0, weakUntilMs: 0, pattern: null, hazards: [],
  };
  transitionBoss(encounter, "ROOM_ENTERED", nowMs);
  return encounter;
}
export function voteBossIntroSkip(encounter: BossEncounterSnapshot, playerId: string, nowMs: number) {
  if (!encounter.seenByAll || !["ROOM_ENTERED", "INTRO_LOCK", "AWAKENING"].includes(encounter.state)) return;
  if (!encounter.participantIds.includes(playerId)) return;
  if (!encounter.skipVotes.includes(playerId)) encounter.skipVotes.push(playerId);
  if (encounter.participantIds.every((id) => encounter.skipVotes.includes(id))) {
    encounter.introDurationMs = Math.max(600, nowMs - encounter.enteredAtMs);
  }
}
export function damageBossEncounter(encounter: BossEncounterSnapshot, damage: number, nowMs: number) {
  if (encounter.state !== "COMBAT") return 0;
  // Guard absorbs damage; its counter is telegraphed by the same hazard geometry.
  if (nowMs < encounter.guardUntilMs) {
    if (!encounter.hazards.some((hazard) => hazard.pattern === "guard-counter")) {
      encounter.hazards.push({
        id: "counter:" + encounter.patternIndex, pattern: "guard-counter", shape: "arc",
        x: encounter.x, y: encounter.y, radius: 220, angle: Math.PI / 2, arc: Math.PI * 2,
        width: 0, height: 0, damage: 18, createdAtMs: nowMs, impactAtMs: nowMs + 850, endsAtMs: nowMs + 1030,
      });
    }
    return 0;
  }
  const applied = Math.min(encounter.hp, Math.max(0, Math.round(damage * (nowMs < encounter.weakUntilMs ? 1.25 : 1))));
  encounter.hp -= applied;
  const definition = bossById(encounter.bossId);
  const phase = bossPhaseAtHp(definition, encounter.hp, encounter.maxHp);
  if (phase > encounter.phase) { encounter.phase = phase; encounter.patternIndex = 0; }
  if (encounter.hp === 0) {
    encounter.hazards = [];
    transitionBoss(encounter, "DEFEATED", nowMs);
  }
  return applied;
}
/** Uses authority time and fixed target ordering; no timers or Phaser objects in saves. */
export function advanceBossEncounter(encounter: BossEncounterSnapshot, nowMs: number, players: readonly BossParticipant[], arena: { width: number; height: number }) {
  const definition = bossById(encounter.bossId);
  const previousMs = encounter.serverTimeMs;
  encounter.serverTimeMs = Math.max(previousMs, nowMs);
  const elapsed = nowMs - encounter.enteredAtMs;
  if (encounter.state === "ROOM_ENTERED") transitionBoss(encounter, "INTRO_LOCK", encounter.enteredAtMs);
  if (encounter.state === "INTRO_LOCK" && elapsed >= (encounter.seenByAll ? 350 : definition.intro.awakeningAtMs)) {
    transitionBoss(encounter, "AWAKENING", encounter.enteredAtMs + (encounter.seenByAll ? 350 : definition.intro.awakeningAtMs));
  }
  if (encounter.state === "AWAKENING" && elapsed >= encounter.introDurationMs) {
    transitionBoss(encounter, "COMBAT", encounter.enteredAtMs + encounter.introDurationMs);
    encounter.nextPatternAtMs = nowMs + 800;
  }
  if (encounter.state === "DEFEATED" && nowMs - encounter.stateAtMs >= definition.purification.defeatedMs) {
    transitionBoss(encounter, "PURIFICATION", encounter.stateAtMs + definition.purification.defeatedMs);
  }
  if (encounter.state === "PURIFICATION" && nowMs - encounter.stateAtMs >= definition.purification.durationMs) {
    transitionBoss(encounter, "RESTORED", encounter.stateAtMs + definition.purification.durationMs);
  }
  advanceBossCombat(encounter, nowMs, previousMs, players, arena);
}
export function confirmBossRestoration(encounter: BossEncounterSnapshot, bossId: string, confirmed: boolean, nowMs: number) {
  if (encounter.state === "CLEARED") return;
  if (encounter.state !== "RESTORED" || bossId !== encounter.bossId || !confirmed) throw new Error("Restauração ainda não confirmada pelo save.");
  transitionBoss(encounter, "UNLOCK", nowMs);
  transitionBoss(encounter, "CLEARED", nowMs);
}
