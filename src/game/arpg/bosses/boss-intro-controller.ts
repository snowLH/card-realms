import type { CorruptedLegendBossDefinition } from "./boss-definition";

export type BossPose = "seated" | "hand" | "head" | "eyes" | "stumble" | "support" | "draw" | "ready" | "kneeling" | "reaching" | "restored";
export function bossIntroDuration(definition: CorruptedLegendBossDefinition, seenByAll: boolean) {
  return seenByAll ? definition.intro.shortDurationMs : definition.intro.durationMs;
}
export function introPose(elapsedMs: number, short: boolean): BossPose {
  const time = short ? elapsedMs / 1800 * 7000 : elapsedMs;
  if (time < 3200) return "seated";
  if (time < 3500) return "hand";
  if (time < 4000) return "head";
  if (time < 4300) return "eyes";
  if (time < 4800) return "stumble";
  if (time < 5200) return "support";
  if (time < 5700) return "draw";
  return "ready";
}
