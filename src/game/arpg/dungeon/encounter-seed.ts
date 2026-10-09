import type { ArpgExpeditionId } from "../content/expeditions";

/** The seed freezes encounter rules as well as the map for saved runs. */
export function createArpgDungeonSeed(regionId: ArpgExpeditionId, runId: string) {
  return `${regionId}:encounters-v2:${runId}`;
}

export function hasCurrentArpgEncounterRules(seed: string, regionId: string) {
  return seed.startsWith(`${regionId}:encounters-v2:`);
}
