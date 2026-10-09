import type { ArpgExpeditionId } from "./expeditions";
import { CREATURE_BY_ID } from "@/game/content/creatures";
import { LOCAL_MAPS } from "@/game/exploration/maps";
import type { SpriteDefinition } from "@/game/types";

export type AtlasEncounterReference = {
  kind: "wild" | "npc";
  regionId: string;
  id: string;
};

export type AtlasEncounterTarget = AtlasEncounterReference & {
  name: string;
  sprite:
    | ({ kind: "portrait" } & SpriteDefinition)
    | { kind: "npc"; actorId: "archivist" };
};

/**
 * The Atlas still contains regions from the classic encounter flow. Route each
 * one to the closest playable action expedition until every region has its own
 * ARPG dungeon.
 */
const ATLAS_REGION_EXPEDITIONS: Readonly<Record<string, ArpgExpeditionId>> = {
  roots: "mata-encantada",
  mist: "mata-encantada",
  desert: "montanhas-runicas",
  runic: "montanhas-runicas",
  eclipse: "montanhas-runicas",
  archipelago: "arquipelago-das-mares",
  "deep-sea": "arquipelago-das-mares",
};

export function getArpgExpeditionForAtlasRegion(regionId: string): ArpgExpeditionId | null {
  return ATLAS_REGION_EXPEDITIONS[regionId] ?? null;
}

/** Resolve and validate a clicked Atlas target against its source region. */
export function resolveAtlasEncounterTarget(
  encounter: AtlasEncounterReference | null | undefined,
): AtlasEncounterTarget | null {
  if (!encounter || !getArpgExpeditionForAtlasRegion(encounter.regionId)) return null;
  const map = LOCAL_MAPS[encounter.regionId];
  if (!map) return null;

  if (encounter.kind === "wild") {
    const mapCreature = map.creatures.find((entry) => entry.creatureId === encounter.id);
    const creature = CREATURE_BY_ID.get(encounter.id);
    if (!mapCreature || !creature) return null;
    return {
      ...encounter,
      name: creature.name,
      sprite: {
        kind: "portrait",
        ...creature.sprite,
      },
    };
  }

  const npc = map.npcs.find((entry) => entry.id === encounter.id);
  if (!npc) return null;
  return { ...encounter, name: npc.name, sprite: { kind: "npc", actorId: "archivist" } };
}

export function getFirstAtlasCombatRoomId(rooms: Readonly<Record<string, { id: string; type: string; distanceFromStart: number }>>) {
  return Object.values(rooms)
    .filter((room) => room.type === "combat")
    .sort((left, right) => left.distanceFromStart - right.distanceFromStart || left.id.localeCompare(right.id))[0]?.id ?? null;
}
