import { describe, expect, it } from "vitest";
import { createDungeonLootPlan, resolveDungeonLootPlan } from "../content/dungeons";
import { ARPG_ARMOR_BY_ID, ARPG_WEAPON_BY_ID } from "../content/equipment";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { connectedRoomIds } from "./graph";
import { generateDungeon } from "./generator";
import { createRunLootAssignments } from "./rewards";
import { createBreakableObjectPlacements } from "./breakable-objects";
import {
  applyArpgRunCheckpoint,
  createInitialArpgRunCheckpoint,
  isValidArpgRunCheckpoint,
  isValidArpgRunCheckpointTransition,
} from "./run-checkpoint";

function initialCheckpoint(startRoomId: string) {
  const armor = ARPG_ARMOR_BY_ID.get(DEFAULT_ARPG_LOADOUT.armorId)!;
  return {
    ...createInitialArpgRunCheckpoint({
    startRoomId,
    weaponId: DEFAULT_ARPG_LOADOUT.weaponId,
    armorId: DEFAULT_ARPG_LOADOUT.armorId,
    maxHp: 120 + armor.maxHpBonus,
    }),
    // Most transition fixtures exercise the legacy JSONB shape with no visit history.
    visitedRoomIds: [],
  };
}

function shortestPath(graph: ReturnType<typeof generateDungeon>, targetRoomId: string) {
  const startRoomId = graph.startRoomId;
  const previous = new Map<string, string | null>([[startRoomId, null]]);
  const queue = [startRoomId];
  while (queue.length > 0) {
    const roomId = queue.shift()!;
    if (roomId === targetRoomId) break;
    for (const nextRoomId of connectedRoomIds(graph.rooms[roomId])) {
      if (!previous.has(nextRoomId)) {
        previous.set(nextRoomId, roomId);
        queue.push(nextRoomId);
      }
    }
  }
  if (!previous.has(targetRoomId)) return null;
  const path: string[] = [];
  for (let roomId: string | null = targetRoomId; roomId; roomId = previous.get(roomId) ?? null) {
    path.unshift(roomId);
  }
  return path;
}

describe("ARPG run checkpoints", () => {
  it("restores an initial checkpoint and keeps it valid", () => {
    const graph = generateDungeon({ seed: "resume-start", regionId: "mata-encantada" });
    const checkpoint = initialCheckpoint(graph.startRoomId);
    const freshCheckpoint = createInitialArpgRunCheckpoint({
      startRoomId: graph.startRoomId,
      weaponId: DEFAULT_ARPG_LOADOUT.weaponId,
      armorId: DEFAULT_ARPG_LOADOUT.armorId,
      maxHp: 120 + ARPG_ARMOR_BY_ID.get(DEFAULT_ARPG_LOADOUT.armorId)!.maxHpBonus,
    });

    expect(freshCheckpoint.visitedRoomIds).toEqual([graph.startRoomId]);
    expect(isValidArpgRunCheckpoint(graph, checkpoint)).toBe(true);
    const legacyCheckpoint: Record<string, unknown> = { ...checkpoint };
    delete legacyCheckpoint.brokenBreakableIds;
    expect(isValidArpgRunCheckpoint(graph, legacyCheckpoint)).toBe(true);
    applyArpgRunCheckpoint(graph, checkpoint);
    expect(graph.rooms[graph.startRoomId].state).toBe("active");
  });

  it("accepts only the newly entered room when visit history is explicit", () => {
    const graph = generateDungeon({ seed: "resume-visited-transitions", regionId: "mata-encantada" });
    const previous = createInitialArpgRunCheckpoint({
      startRoomId: graph.startRoomId,
      weaponId: DEFAULT_ARPG_LOADOUT.weaponId,
      armorId: DEFAULT_ARPG_LOADOUT.armorId,
      maxHp: 120 + ARPG_ARMOR_BY_ID.get(DEFAULT_ARPG_LOADOUT.armorId)!.maxHpBonus,
    });
    const firstRoomId = connectedRoomIds(graph.rooms[graph.startRoomId])[0]!;
    const next = {
      ...previous,
      currentRoomId: firstRoomId,
      visitedRoomIds: [graph.startRoomId, firstRoomId],
      clearedRoomIds: [graph.startRoomId],
    };
    const furtherRoomId = connectedRoomIds(graph.rooms[firstRoomId]).find((id) => id !== graph.startRoomId);

    expect(isValidArpgRunCheckpointTransition(graph, previous, next)).toBe(true);
    expect(isValidArpgRunCheckpoint(graph, {
      ...next,
      visitedRoomIds: [graph.startRoomId],
    })).toBe(false);
    if (furtherRoomId) {
      const forgedVisit = {
        ...next,
        visitedRoomIds: [...next.visitedRoomIds, furtherRoomId],
      };
      expect(isValidArpgRunCheckpoint(graph, forgedVisit)).toBe(true);
      expect(isValidArpgRunCheckpointTransition(graph, previous, forgedVisit)).toBe(false);
    }
  });

  it("restores cleared rooms and rejects a checkpoint that skips the graph", () => {
    const graph = generateDungeon({ seed: "resume-progress", regionId: "mata-encantada" });
    const firstRoomId = Object.values(graph.rooms)
      .find((room) => room.connections.south === graph.startRoomId || room.connections.north === graph.startRoomId
        || room.connections.east === graph.startRoomId || room.connections.west === graph.startRoomId)?.id;
    expect(firstRoomId).toBeDefined();

    const checkpoint = initialCheckpoint(graph.startRoomId);
    checkpoint.currentRoomId = firstRoomId!;
    checkpoint.clearedRoomIds = [graph.startRoomId];
    expect(isValidArpgRunCheckpoint(graph, checkpoint)).toBe(true);
    applyArpgRunCheckpoint(graph, checkpoint);
    expect(graph.rooms[graph.startRoomId].state).toBe("cleared");
    expect(graph.rooms[firstRoomId!].state).toBe("active");

    checkpoint.currentRoomId = graph.bossRoomId;
    expect(isValidArpgRunCheckpoint(graph, checkpoint)).toBe(false);
  });

  it("rejects duplicate room IDs, impossible HP, and unknown equipment", () => {
    const graph = generateDungeon({ seed: "resume-invalid", regionId: "mata-encantada" });
    const checkpoint = initialCheckpoint(graph.startRoomId);

    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, clearedRoomIds: [graph.startRoomId, graph.startRoomId] })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, playerHp: checkpoint.maxHp + 1 })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, maxHp: checkpoint.maxHp + 1 })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, weaponId: "invented-weapon" })).toBe(false);
  });

  it("restores only seeded breakables from rooms already reached", () => {
    const graph = generateDungeon({ seed: "resume-breakables", regionId: "mata-encantada" });
    const reachedRoom = Object.values(graph.rooms).find((room) => (
      room.type !== "start"
      && Object.values(room.connections).includes(graph.startRoomId)
      && createBreakableObjectPlacements(graph.seed, room, graph.regionId).length > 0
    ));
    expect(reachedRoom).toBeDefined();
    const placement = createBreakableObjectPlacements(graph.seed, reachedRoom!, graph.regionId)[0]!;
    const checkpoint = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: reachedRoom!.id,
      clearedRoomIds: [graph.startRoomId],
      brokenBreakableIds: [placement.id],
    };
    const unvisitedPlacement = Object.values(graph.rooms)
      .filter((room) => room.type !== "start" && room.id !== reachedRoom!.id)
      .flatMap((room) => createBreakableObjectPlacements(graph.seed, room, graph.regionId))[0]!;

    expect(isValidArpgRunCheckpoint(graph, checkpoint)).toBe(true);
    expect(isValidArpgRunCheckpoint(graph, {
      ...checkpoint,
      brokenBreakableIds: [placement.id, placement.id],
    })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, {
      ...checkpoint,
      brokenBreakableIds: [unvisitedPlacement.id],
    })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, {
      ...checkpoint,
      brokenBreakableIds: ["unknown:breakable:0"],
    })).toBe(false);
  });

  it("keeps broken props monotonic and only accepts damage in the active room", () => {
    const graph = generateDungeon({ seed: "resume-breakable-transition", regionId: "mata-encantada" });
    const room = Object.values(graph.rooms).find((candidate) => (
      candidate.type !== "start"
      && Object.values(candidate.connections).includes(graph.startRoomId)
      && createBreakableObjectPlacements(graph.seed, candidate, graph.regionId).length > 0
    ));
    expect(room).toBeDefined();
    const placement = createBreakableObjectPlacements(graph.seed, room!, graph.regionId)[0]!;
    const previous = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: room!.id,
      clearedRoomIds: [graph.startRoomId],
    };
    const broken = { ...previous, brokenBreakableIds: [placement.id], runShards: 1 };

    expect(isValidArpgRunCheckpointTransition(graph, previous, broken)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, broken, previous)).toBe(false);
    expect(isValidArpgRunCheckpointTransition(graph, previous, {
      ...broken,
      runShards: 2,
    })).toBe(false);
    expect(isValidArpgRunCheckpointTransition(graph, previous, {
      ...previous,
      runShards: 1,
    })).toBe(false);
  });

  it("accepts a safe checkpoint reached through rooms already cleared", () => {
    const graph = generateDungeon({ seed: "resume-transition", regionId: "mata-encantada" });
    const previous = initialCheckpoint(graph.startRoomId);
    const firstRoomId = Object.values(graph.rooms)
      .find((room) => Object.values(room.connections).includes(graph.startRoomId))!.id;
    const next = {
      ...previous,
      currentRoomId: firstRoomId,
      clearedRoomIds: [graph.startRoomId],
    };

    expect(isValidArpgRunCheckpointTransition(graph, previous, next)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, previous, {
      ...next,
      xpEarned: 1,
      runShards: 1,
    })).toBe(false);
  });

  it("rejects HP regeneration in a room without a healing reward", () => {
    const graph = generateDungeon({ seed: "resume-heal-forgery", regionId: "mata-encantada" });
    const firstRoom = connectedRoomIds(graph.rooms[graph.startRoomId])
      .map((roomId) => graph.rooms[roomId])
      .find((room) => room.type !== "rest" && room.type !== "shop")!;
    const previous = { ...initialCheckpoint(graph.startRoomId), playerHp: 100 };
    const forgedHeal = {
      ...previous,
      currentRoomId: firstRoom.id,
      clearedRoomIds: [graph.startRoomId, firstRoom.id],
      playerHp: 101,
    };

    expect(isValidArpgRunCheckpointTransition(graph, previous, forgedHeal)).toBe(false);
  });

  it("does not allow a persistent run to leave an uncleared combat room", () => {
    const graph = generateDungeon({ seed: "resume-combat-door-lock", regionId: "mata-encantada" });
    const combatRoom = connectedRoomIds(graph.rooms[graph.startRoomId])
      .map((roomId) => graph.rooms[roomId])
      .find((room) => room.type === "combat" || room.type === "elite" || room.type === "boss")!;
    const previous = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: combatRoom.id,
      clearedRoomIds: [graph.startRoomId],
    };
    const backtrack = { ...previous, currentRoomId: graph.startRoomId };

    expect(isValidArpgRunCheckpoint(graph, previous)).toBe(true);
    expect(isValidArpgRunCheckpoint(graph, backtrack)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, previous, backtrack)).toBe(false);
  });

  it("allows only the documented healing from rest and a signed chest", () => {
    const graph = generateDungeon({ seed: "resume-heal-rewards", regionId: "mata-encantada" });
    const restRoom = Object.values(graph.rooms).find((room) => room.type === "rest")!;
    const restPath = shortestPath(graph, restRoom.id)!;
    const beforeRest = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: restPath.at(-2)!,
      clearedRoomIds: restPath.slice(0, -1),
      playerHp: 80,
    };
    const afterRest = {
      ...beforeRest,
      currentRoomId: restRoom.id,
      clearedRoomIds: restPath,
      playerHp: 115,
    };
    expect(isValidArpgRunCheckpointTransition(graph, beforeRest, afterRest)).toBe(true);

    const lootPlan = createDungeonLootPlan("mata-encantada", () => 0);
    const lootItemIds = lootPlan.map((item) => item.id);
    const lootRoomId = Object.entries(createRunLootAssignments(graph))
      .find(([, index]) => index === 0)![0];
    const lootPath = shortestPath(graph, lootRoomId)!;
    const rewardRoom = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: lootRoomId,
      clearedRoomIds: lootPath,
      rewardRoomId: lootRoomId,
      playerHp: 80,
    };
    const afterChest = {
      ...rewardRoom,
      rewardRoomId: null,
      runLoot: [{ ...lootPlan[0], quantity: 1 }],
      playerHp: 104,
    };
    expect(isValidArpgRunCheckpointTransition(graph, rewardRoom, afterChest, lootItemIds)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, rewardRoom, { ...afterChest, playerHp: 105 }, lootItemIds)).toBe(false);
  });

  it("accepts only one exact server-known outcome for a special-room choice", () => {
    const graph = generateDungeon({ seed: "resume-special-choice", regionId: "mata-encantada" });
    const eventRoom = Object.values(graph.rooms).find((room) => room.type === "event")!;
    const path = shortestPath(graph, eventRoom.id)!;
    const previous = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: path.at(-2)!,
      clearedRoomIds: path.slice(0, -1),
      playerHp: 100,
      runShards: 0,
    };
    const safeChoice = {
      ...previous,
      currentRoomId: eventRoom.id,
      clearedRoomIds: path,
      runShards: 6,
    };
    const riskChoice = {
      ...safeChoice,
      playerHp: 88,
      runShards: 18,
    };

    expect(isValidArpgRunCheckpoint(graph, previous)).toBe(true);
    expect(isValidArpgRunCheckpoint(graph, safeChoice)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, previous, safeChoice)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, previous, riskChoice)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, previous, { ...safeChoice, runShards: 10 })).toBe(false);
    expect(isValidArpgRunCheckpointTransition(graph, previous, {
      ...safeChoice,
      runBasicDamageMultiplier: 1.15,
    })).toBe(false);
  });

  it("caps checkpoint XP at the seeded encounter reward ceiling", () => {
    const graph = generateDungeon({ seed: "resume-xp-ceiling", regionId: "mata-encantada" });
    const checkpoint = initialCheckpoint(graph.startRoomId);

    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, xpEarned: 1 })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, xpEarned: 100_000 })).toBe(false);
  });

  it("caps run shards at the rewards available in visited seeded rooms", () => {
    const graph = generateDungeon({ seed: "resume-shard-ceiling", regionId: "mata-encantada" });
    const checkpoint = initialCheckpoint(graph.startRoomId);

    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, runShards: 1 })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...checkpoint, runShards: 100 })).toBe(false);
  });

  it("rejects arbitrary equipment changes and accepts gear from the signed room drop", () => {
    const graph = generateDungeon({ seed: "resume-equipment-ownership", regionId: "mata-encantada" });
    const initial = initialCheckpoint(graph.startRoomId);
    const firstRoomId = Object.values(graph.rooms)
      .find((room) => Object.values(room.connections).includes(graph.startRoomId))!.id;
    const unownedWeapon = [...ARPG_WEAPON_BY_ID.values()].find((weapon) => weapon.id !== initial.weaponId)!;
    const forged = {
      ...initial,
      currentRoomId: firstRoomId,
      clearedRoomIds: [graph.startRoomId, firstRoomId],
      weaponId: unownedWeapon.id,
    };
    expect(isValidArpgRunCheckpointTransition(graph, initial, forged)).toBe(false);

    const lootPlan = createDungeonLootPlan("mata-encantada", () => 0);
    const treasureRoomId = Object.entries(createRunLootAssignments(graph))
      .find(([, index]) => index === 0)![0];
    const queue: Array<{ roomId: string; path: string[] }> = [{ roomId: graph.startRoomId, path: [graph.startRoomId] }];
    const visited = new Set([graph.startRoomId]);
    let path: string[] | null = null;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.roomId === treasureRoomId) {
        path = current.path;
        break;
      }
      for (const roomId of connectedRoomIds(graph.rooms[current.roomId])) {
        if (!visited.has(roomId)) {
          visited.add(roomId);
          queue.push({ roomId, path: [...current.path, roomId] });
        }
      }
    }
    const treasureWeapon = lootPlan[0];
    expect(path).not.toBeNull();
    expect(treasureWeapon.kind).toBe("weapon");

    const previous = {
      ...initial,
      currentRoomId: path!.at(-2)!,
      clearedRoomIds: path!.slice(0, -1),
    };
    const equipped = {
      ...previous,
      currentRoomId: treasureRoomId,
      clearedRoomIds: path!,
      runLoot: [{ ...treasureWeapon, quantity: 1 }],
      rewardRoomId: treasureRoomId,
      weaponId: treasureWeapon.id,
      weaponAId: treasureWeapon.id,
      weaponBId: null,
      activeWeaponSlot: "A" as const,
    };
    expect(isValidArpgRunCheckpointTransition(graph, previous, equipped, lootPlan.map((item) => item.id))).toBe(true);
  });

  it("keeps two owned dungeon weapons and allows switching back to the original", () => {
    const graph = generateDungeon({ seed: "weapon-slots-checkpoint", regionId: "mata-encantada" });
    const initial = initialCheckpoint(graph.startRoomId);
    const lootPlan = createDungeonLootPlan("mata-encantada", () => 0);
    const drop = lootPlan.find((item) => item.kind === "weapon")!;
    const treasureRoomId = Object.entries(createRunLootAssignments(graph)).find(([, index]) => index === 0)![0];
    const path = shortestPath(graph, treasureRoomId)!;
    const previous = {
      ...initial,
      currentRoomId: path.at(-2)!,
      clearedRoomIds: path.slice(0, -1),
    };
    const equipped = {
      ...previous,
      currentRoomId: treasureRoomId,
      clearedRoomIds: path,
      runLoot: [{ ...drop, quantity: 1 }],
      rewardRoomId: treasureRoomId,
      weaponId: drop.id,
      weaponAId: initial.weaponAId,
      weaponBId: drop.id,
      activeWeaponSlot: "B" as const,
    };
    expect(isValidArpgRunCheckpointTransition(graph, previous, equipped, lootPlan.map((item) => item.id))).toBe(true);

    const switchedBack = { ...equipped, weaponId: initial.weaponId, activeWeaponSlot: "A" as const };
    expect(isValidArpgRunCheckpointTransition(graph, equipped, switchedBack, lootPlan.map((item) => item.id))).toBe(true);
    expect(isValidArpgRunCheckpoint(graph, { ...equipped, weaponBId: "invented-weapon" }, lootPlan.map((item) => item.id))).toBe(false);
  });

  it("only accepts run buffs within their limits and at a cleared granting room", () => {
    const graph = generateDungeon({ seed: "resume-buff-validation", regionId: "mata-encantada" });
    const previous = initialCheckpoint(graph.startRoomId);
    const firstRoomId = Object.values(graph.rooms)
      .find((room) => Object.values(room.connections).includes(graph.startRoomId) && room.type !== "rest")!.id;
    const progressed = {
      ...previous,
      currentRoomId: firstRoomId,
      clearedRoomIds: [graph.startRoomId, firstRoomId],
    };

    expect(isValidArpgRunCheckpointTransition(graph, previous, {
      ...progressed,
      runMoveSpeedBonus: 16,
    })).toBe(false);
    expect(isValidArpgRunCheckpointTransition(graph, previous, {
      ...progressed,
      runBasicDamageMultiplier: 1.15,
    })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...progressed, runMoveSpeedBonus: 16.1 })).toBe(false);
    expect(isValidArpgRunCheckpoint(graph, { ...progressed, runBasicDamageMultiplier: 1.16 })).toBe(false);
  });

  it("allows only signed loot from rooms already cleared", () => {
    const graph = generateDungeon({ seed: "resume-loot-validation", regionId: "mata-encantada" });
    const lootItemIds = createDungeonLootPlan("mata-encantada", () => 0).map((item) => item.id);
    const assignments = createRunLootAssignments(graph);
    const [lootRoomId, lootIndex] = Object.entries(assignments).find(([, index]) => index === 0)!;
    const queue: Array<{ roomId: string; path: string[] }> = [{ roomId: graph.startRoomId, path: [graph.startRoomId] }];
    const visited = new Set([graph.startRoomId]);
    let path: string[] | null = null;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.roomId === lootRoomId) {
        path = current.path;
        break;
      }
      for (const roomId of connectedRoomIds(graph.rooms[current.roomId])) {
        if (!visited.has(roomId)) {
          visited.add(roomId);
          queue.push({ roomId, path: [...current.path, roomId] });
        }
      }
    }
    expect(path).not.toBeNull();

    const plannedLoot = resolveDungeonLootPlan("mata-encantada", lootItemIds)[lootIndex];
    const checkpoint = {
      ...initialCheckpoint(graph.startRoomId),
      currentRoomId: lootRoomId,
      clearedRoomIds: path!,
      runLoot: [{ ...plannedLoot, quantity: 1 }],
    };
    expect(isValidArpgRunCheckpoint(graph, checkpoint, lootItemIds)).toBe(true);
    expect(isValidArpgRunCheckpoint(graph, {
      ...checkpoint,
      runLoot: [{ id: "invented-item", kind: "weapon", quantity: 1, label: "Loot inventado" }],
    }, lootItemIds)).toBe(false);
  });

  it("rejects a forged multi-room jump and checkpoint regressions", () => {
    const graph = generateDungeon({ seed: "resume-transition-forgery", regionId: "mata-encantada" });
    const previous = initialCheckpoint(graph.startRoomId);
    const forgedVictory = {
      ...previous,
      currentRoomId: graph.bossRoomId,
      clearedRoomIds: Object.keys(graph.rooms),
      exitPortalAvailable: true,
    };
    expect(isValidArpgRunCheckpoint(graph, forgedVictory)).toBe(true);
    expect(isValidArpgRunCheckpointTransition(graph, previous, forgedVictory)).toBe(false);

    const firstRoomId = Object.values(graph.rooms)
      .find((room) => Object.values(room.connections).includes(graph.startRoomId))!.id;
    const progressed = {
      ...previous,
      currentRoomId: firstRoomId,
      clearedRoomIds: [graph.startRoomId, firstRoomId],
    };
    const regressed = { ...progressed, clearedRoomIds: [graph.startRoomId] };
    expect(isValidArpgRunCheckpointTransition(graph, progressed, regressed)).toBe(false);
  });
});
