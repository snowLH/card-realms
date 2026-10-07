import { describe, expect, it } from "vitest";
import {
  getArpgExpeditionForAtlasRegion,
  getFirstAtlasCombatRoomId,
  resolveAtlasEncounterTarget,
} from "./atlas-encounters";

describe("Atlas action encounter routing", () => {
  it("routes every Atlas region to a playable action expedition", () => {
    expect(getArpgExpeditionForAtlasRegion("roots")).toBe("mata-encantada");
    expect(getArpgExpeditionForAtlasRegion("mist")).toBe("mata-encantada");
    expect(getArpgExpeditionForAtlasRegion("desert")).toBe("montanhas-runicas");
    expect(getArpgExpeditionForAtlasRegion("runic")).toBe("montanhas-runicas");
    expect(getArpgExpeditionForAtlasRegion("eclipse")).toBe("montanhas-runicas");
    expect(getArpgExpeditionForAtlasRegion("archipelago")).toBe("arquipelago-das-mares");
    expect(getArpgExpeditionForAtlasRegion("deep-sea")).toBe("arquipelago-das-mares");
  });

  it("does not guess for unknown regions", () => {
    expect(getArpgExpeditionForAtlasRegion("future-region")).toBeNull();
  });

  it("resolves an exact wild Atlas target to its regional expedition and runtime sprite", () => {
    const target = resolveAtlasEncounterTarget({ kind: "wild", regionId: "roots", id: "curupira" });

    expect(target).toMatchObject({ kind: "wild", id: "curupira", regionId: "roots", name: "Curupira" });
    expect(target?.sprite).toMatchObject({ kind: "atlas", atlas: "folklore-atlas" });
    expect(resolveAtlasEncounterTarget({ kind: "wild", regionId: "roots", id: "raiju" })).toBeNull();
  });

  it("preserves the selected NPC ID and identifies its training sprite", () => {
    expect(resolveAtlasEncounterTarget({ kind: "npc", regionId: "roots", id: "roots-scout" })).toEqual({
      kind: "npc",
      regionId: "roots",
      id: "roots-scout",
      name: "Maíra",
      sprite: { kind: "npc", actorId: "archivist" },
    });
    expect(resolveAtlasEncounterTarget({ kind: "npc", regionId: "roots", id: "desert-scribe" })).toBeNull();
  });

  it("chooses the nearest combat room as the Atlas target room", () => {
    expect(getFirstAtlasCombatRoomId({
      start: { id: "start", type: "start", distanceFromStart: 0 },
      later: { id: "later", type: "combat", distanceFromStart: 4 },
      first: { id: "first", type: "combat", distanceFromStart: 2 },
    })).toBe("first");
  });
});
