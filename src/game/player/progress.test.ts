import { describe, expect, it } from "vitest";
import { RemotePlayerSnapshotSchema } from "./progress";

const ids = {
  player: "00000000-0000-4000-8000-000000000001",
  creature: "00000000-0000-4000-8000-000000000002",
  team: "00000000-0000-4000-8000-000000000003",
};

function snapshotFixture() {
  return {
    version: 1,
    profile: {
      id: ids.player,
      username: "viajante_teste",
      displayName: "Viajante",
      avatarUrl: null,
      level: 1,
      xp: 0,
      coins: 500,
      gems: 0,
      equippedTitle: null,
    },
    world: {
      currentRegionId: "roots",
      unlockedRegionIds: ["roots", "archipelago", "runic"],
      openedTreasures: [],
    },
    collection: [{
      instanceId: ids.creature,
      catalogId: "boitata",
      nickname: null,
      level: 1,
      xp: 0,
      bond: 0,
      variant: "standard",
      acquiredFrom: "starter",
      acquiredAt: "2026-09-27T00:00:00.000Z",
    }],
    teams: [{
      id: ids.team,
      name: "Equipe principal",
      isActive: true,
      members: [{
        slot: 1,
        playerCreatureId: ids.creature,
        catalogId: "boitata",
      }],
    }],
    energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
    inventory: [],
    exploration: [],
    missions: [],
    achievements: [],
    house: null,
    battleHistory: [],
  };
}

describe("contrato do progresso remoto", () => {
  it("aceita um snapshot completo dos cinco elementos", () => {
    expect(RemotePlayerSnapshotSchema.safeParse(snapshotFixture()).success).toBe(true);
  });

  it("recusa economia negativa vinda do backend", () => {
    const fixture = snapshotFixture();
    fixture.profile.coins = -1;

    expect(RemotePlayerSnapshotSchema.safeParse(fixture).success).toBe(false);
  });

  it("recusa energia fora dos cinco elementos-base", () => {
    const fixture = snapshotFixture();
    const invalid = {
      ...fixture,
      energy: { ...fixture.energy, shadow: 99 },
    };

    expect(RemotePlayerSnapshotSchema.safeParse(invalid).success).toBe(false);
  });
});
