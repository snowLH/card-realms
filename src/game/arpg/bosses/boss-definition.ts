import type { PlayableLegendId } from "../content/legends";

export const FORGOTTEN_LEGEND_CYCLE = ["ESQUECIMENTO", "FRAGMENTAÇÃO", "CORRUPÇÃO", "CONFRONTO", "RECORDAÇÃO", "PURIFICAÇÃO", "RESTAURAÇÃO"] as const;
export const BOSS_STATES = ["INACTIVE", "ROOM_ENTERED", "INTRO_LOCK", "AWAKENING", "COMBAT", "DEFEATED", "PURIFICATION", "RESTORED", "UNLOCK", "CLEARED"] as const;
export type BossState = typeof BOSS_STATES[number];
export type BossPhase = 1 | 2 | 3;
export type BossPoint = { x: number; y: number };
export type BossParticipant = BossPoint & { id: string; alive: boolean };
export type BossHazard = BossPoint & {
  id: string; pattern: string; shape: "arc" | "rect" | "circle";
  radius: number; width: number; height: number; angle: number; arc: number;
  damage: number; createdAtMs: number; impactAtMs: number; endsAtMs: number;
};
export type CorruptedLegendBossDefinition = {
  id: string; playableLegendId?: PlayableLegendId; title: string; corruptedTitle: string;
  arena: { widthTiles: number; heightTiles: number; presentation: "camelot" | "regional" };
  intro: { durationMs: number; shortDurationMs: number; awakeningAtMs: number };
  phases: readonly { phase: BossPhase; hpThreshold: number; title: string }[];
  purification: { defeatedMs: number; durationMs: number; dialogue: readonly string[] };
  unlock: { label: string };
};

export function bossPhaseAtHp(definition: CorruptedLegendBossDefinition, hp: number, maxHp: number): BossPhase {
  const ratio = Math.max(0, hp) / Math.max(1, maxHp);
  return [...definition.phases].reverse().find((phase) => ratio <= phase.hpThreshold)?.phase ?? 1;
}
