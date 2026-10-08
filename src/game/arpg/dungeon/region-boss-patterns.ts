export type RegionalBossPattern =
  | "tide-volley" | "undertow-sweep" | "deep-current"
  | "frost-shards" | "ice-lanes" | "whiteout-charge";

const MARES: readonly (readonly RegionalBossPattern[])[] = [
  ["tide-volley"],
  ["undertow-sweep", "tide-volley"],
  ["deep-current", "undertow-sweep", "tide-volley"],
];
const RUNIC: readonly (readonly RegionalBossPattern[])[] = [
  ["frost-shards"],
  ["ice-lanes", "frost-shards"],
  ["whiteout-charge", "ice-lanes", "frost-shards"],
];

/** Deterministic phase-dependent attack rotation shared by local and authoritative combat. */
export function getRegionalBossPattern(regionId: string, phase: 1 | 2 | 3, index: number): RegionalBossPattern {
  const set = regionId === "arquipelago-das-mares" ? MARES : RUNIC;
  const options = set[phase - 1];
  return options[Math.abs(Math.trunc(index)) % options.length];
}
