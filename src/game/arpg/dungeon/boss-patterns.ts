export type CurupiraBossPhase = 1 | 2 | 3;

export type CurupiraBossPattern =
  | "bow-volley"
  | "roots-burst"
  | "decoy-ambush"
  | "decoy-volley"
  | "root-arena"
  | "teleport-volley";

export function getCurupiraBossPhase(previousPhase: CurupiraBossPhase, patternIndex: number, hpRatio: number): CurupiraBossPhase {
  const safeRatio = Math.max(0, Math.min(1, hpRatio));
  const healthPhase: CurupiraBossPhase = safeRatio < 0.33 ? 3 : safeRatio < 0.66 ? 2 : 1;
  if (Math.max(0, Math.floor(patternIndex)) === 0) return previousPhase;
  return Math.min(healthPhase, Math.min(3, previousPhase + 1)) as CurupiraBossPhase;
}

export function getCurupiraBossPattern(phase: CurupiraBossPhase, patternIndex: number): CurupiraBossPattern {
  const safeIndex = Math.max(0, Math.floor(patternIndex));
  if (phase === 1) return safeIndex % 3 === 0 ? "roots-burst" : "bow-volley";
  if (phase === 2) return safeIndex % 2 === 0 ? "decoy-ambush" : "decoy-volley";
  return safeIndex % 2 === 0 ? "root-arena" : "teleport-volley";
}
