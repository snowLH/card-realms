import type { ArpgExpeditionId } from "../content/expeditions";

/** The seed freezes encounter rules as well as the map for saved runs. */
export function createArpgDungeonSeed(regionId: ArpgExpeditionId, runId: string) {
  return `${regionId}:encounters-v4:${runId}`;
}

export function hasCurrentArpgEncounterRules(seed: string, regionId: string) {
  return seed.startsWith(`${regionId}:encounters-v2:`)
    || seed.startsWith(`${regionId}:encounters-v3:`)
    || seed.startsWith(`${regionId}:encounters-v4:`);
}

export function usesLegacyDungeonLayout(seed: string, regionId: string) {
  return seed.startsWith(`${regionId}:`)
    && !seed.startsWith(`${regionId}:encounters-v3:`)
    && !seed.startsWith(`${regionId}:encounters-v4:`);
}

/** Encounter-v4 is the compact, fast stage layout. Older signed runs keep
 * their frozen 8–12 room graph so saved checkpoints remain valid. */
export function usesCompactDungeonLayout(seed: string, regionId: string) {
  return seed.startsWith(`${regionId}:encounters-v4:`);
}
