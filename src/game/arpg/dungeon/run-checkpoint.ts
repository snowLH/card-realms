import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID } from "../content/ability-cards";
import { ARPG_DUNGEON_CONFIGS, isDungeonLootPlanValid, resolveDungeonLootPlan } from "../content/dungeons";
import type { ArpgExpeditionId } from "../content/expeditions";
import { ARPG_ARMOR_BY_ID, ARPG_WEAPON_BY_ID } from "../content/equipment";
import type { ArpgRunLootEntry } from "../domain/types";
import { createRunLootAssignments, rollCombatRoomCache } from "./rewards";
import {
  getRunShardReward,
  getSpecialRoomEncounter,
  resolveSpecialRoomChoice,
} from "./special-rooms";
import { populateArpgDungeonContent } from "./content";
import { ArpgDungeonCombatStateSchema } from "./combat-authority";
import { createBreakableObjectPlacements } from "./breakable-objects";
import { connectedRoomIds, validateDungeonGraph } from "./graph";
import type { DungeonGraph } from "./types";

const RunLootEntrySchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["weapon", "armor", "material", "card"]),
  quantity: z.number().int().min(1).max(99),
  label: z.string().min(1).max(120),
}).strict();
const PLAYER_BASE_HP = 120;
const LEGACY_DUNGEON_CARD_DROPS: Partial<Record<ArpgExpeditionId, Partial<Record<number, string>>>> = {
  "mata-encantada": { 0: "caipora-arrow" },
  "arquipelago-das-mares": { 0: "kappa-splash", 2: "kelpie-surge" },
  "montanhas-runicas": { 1: "tengu-gust" },
};

function getMaximumEarnableXp(graph: DungeonGraph, visitedRoomIds: Set<string>) {
  const dungeon = ARPG_DUNGEON_CONFIGS[graph.regionId as ArpgExpeditionId];
  if (!dungeon) return null;

  const encounterGraph: DungeonGraph = {
    ...graph,
    rooms: Object.fromEntries(Object.entries(graph.rooms).map(([roomId, room]) => [roomId, { ...room, waves: [] }])),
  };
  populateArpgDungeonContent(encounterGraph);

  let maximumXp = 0;
  for (const roomId of visitedRoomIds) {
    const room = encounterGraph.rooms[roomId];
    if (!room) return null;
    for (const enemyId of room.waves.flat()) {
      const enemy = dungeon.enemies[enemyId];
      if (!enemy) return null;
      // The Cartographer's Compass is the largest XP bonus currently available.
      maximumXp += Math.round(enemy.rewardXp * 1.1);
    }
  }
  return maximumXp;
}

export function getArpgCombatRewardDeltas(graph: DungeonGraph, roomId: string, xpMultiplier = 1) {
  const room = graph.rooms[roomId];
  const dungeon = ARPG_DUNGEON_CONFIGS[graph.regionId as ArpgExpeditionId];
  if (
    !room
    || !dungeon
    || (room.type !== "combat" && room.type !== "elite" && room.type !== "boss")
  ) return null;

  const encounterGraph: DungeonGraph = {
    ...graph,
    rooms: Object.fromEntries(Object.entries(graph.rooms).map(([id, current]) => [id, { ...current, waves: [] }])),
  };
  populateArpgDungeonContent(encounterGraph);
  let xp = 0;
  let runShards = 0;
  for (const enemyId of encounterGraph.rooms[roomId].waves.flat()) {
    const enemy = dungeon.enemies[enemyId];
    if (!enemy) return null;
    xp += Math.round(enemy.rewardXp * xpMultiplier);
    runShards += getRunShardReward(enemy.rewardXp);
  }
  return { xp, runShards };
}

function getMaximumEarnableRunShards(graph: DungeonGraph, visitedRoomIds: Set<string>) {
  const dungeon = ARPG_DUNGEON_CONFIGS[graph.regionId as ArpgExpeditionId];
  if (!dungeon) return null;

  const encounterGraph: DungeonGraph = {
    ...graph,
    rooms: Object.fromEntries(Object.entries(graph.rooms).map(([roomId, room]) => [roomId, { ...room, waves: [] }])),
  };
  populateArpgDungeonContent(encounterGraph);

  let maximumShards = 0;
  for (const roomId of visitedRoomIds) {
    const room = encounterGraph.rooms[roomId];
    if (!room) return null;

    for (const enemyId of room.waves.flat()) {
      const enemy = dungeon.enemies[enemyId];
      if (!enemy) return null;
      maximumShards += getRunShardReward(enemy.rewardXp);
    }

    maximumShards += createBreakableObjectPlacements(graph.seed, room, graph.regionId).length;

    if (room.type === "combat") {
      const cache = rollCombatRoomCache(graph.seed, room.id);
      if (cache.kind === "cache") maximumShards += cache.shards;
    }

    const specialRoom = getSpecialRoomEncounter(graph.regionId, room.type);
    if (specialRoom) {
      maximumShards += Math.max(
        0,
        ...specialRoom.options.map((option) => resolveSpecialRoomChoice(graph.regionId, option.id).shardsDelta),
      );
    }
  }
  return maximumShards;
}

function getMaximumCheckpointHealing(
  graph: DungeonGraph,
  previous: ArpgRunCheckpoint,
  next: ArpgRunCheckpoint,
  newlyClearedRoomIds: readonly string[],
) {
  let maximumHealing = 0;
  const newlyClearedRoom = newlyClearedRoomIds
    .map((roomId) => graph.rooms[roomId])
    .find((room) => room?.id === next.currentRoomId);
  if (newlyClearedRoom?.type === "rest") maximumHealing += 35;
  if (newlyClearedRoom?.type === "shop") maximumHealing += 30;

  const armorHpGain = Math.max(0, next.maxHp - previous.maxHp);
  const collectedChestLoot = next.runLoot.length > previous.runLoot.length;
  if (
    previous.rewardRoomId
    && next.rewardRoomId === null
    && graph.rooms[previous.rewardRoomId]?.id === previous.currentRoomId
  ) {
    let lootAssignments: Record<string, number> = {};
    try {
      lootAssignments = createRunLootAssignments(graph);
    } catch {
      return maximumHealing;
    }
    if (typeof lootAssignments[previous.rewardRoomId] === "number") {
      if (collectedChestLoot) maximumHealing += 24 + armorHpGain;
    } else {
      const cache = rollCombatRoomCache(graph.seed, previous.rewardRoomId);
      if (cache.kind === "cache") maximumHealing += cache.healing;
    }
  }
  return maximumHealing;
}

function isValidSpecialRoomOutcome(
  graph: DungeonGraph,
  previous: ArpgRunCheckpoint,
  next: ArpgRunCheckpoint,
  roomId: string,
  breakableShardDelta = 0,
) {
  const room = graph.rooms[roomId];
  const encounter = room && getSpecialRoomEncounter(graph.regionId, room.type);
  if (!room || !encounter || next.currentRoomId !== room.id) return false;

  return encounter.options.some((option) => {
    if (previous.runShards < option.costShards) return false;
    const resolution = resolveSpecialRoomChoice(graph.regionId, option.id);
    const sameLoot = previous.runLoot.length === next.runLoot.length
      && previous.runLoot.every((item, index) => {
        const nextItem = next.runLoot[index];
        return nextItem
          && item.id === nextItem.id
          && item.kind === nextItem.kind
          && item.quantity === nextItem.quantity
          && item.label === nextItem.label;
      });

    return next.playerHp === Math.max(1, Math.min(previous.maxHp, previous.playerHp + resolution.hpDelta))
      && next.maxHp === previous.maxHp
      && next.runShards === previous.runShards + resolution.shardsDelta + breakableShardDelta
      && next.runMoveSpeedBonus === Math.max(previous.runMoveSpeedBonus, resolution.moveSpeedBonus)
      && next.runBasicDamageMultiplier === Math.max(previous.runBasicDamageMultiplier, resolution.basicDamageMultiplier)
      && next.weaponId === previous.weaponId
      && next.armorId === previous.armorId
      && next.xpEarned === previous.xpEarned
      && sameLoot
      && next.rewardRoomId === previous.rewardRoomId
      && next.exitPortalAvailable === previous.exitPortalAvailable;
  });
}

function isValidSignedRunLoot(
  graph: DungeonGraph,
  checkpoint: ArpgRunCheckpoint,
  lootItemIds: readonly string[],
) {
  const expeditionId = graph.regionId as ArpgExpeditionId;
  const dungeon = ARPG_DUNGEON_CONFIGS[expeditionId];
  if (!dungeon || !isDungeonLootPlanValid(expeditionId, lootItemIds)) return false;
  const lootPlan = resolveDungeonLootPlan(expeditionId, lootItemIds);
  let assignments: Record<string, number>;
  try {
    assignments = createRunLootAssignments(graph);
  } catch {
    return false;
  }

  const availableEntries = new Map<string, number>();
  const addEntry = (entry: ArpgRunLootEntry) => {
    const key = `${entry.kind}\0${entry.id}\0${entry.quantity}\0${entry.label}`;
    availableEntries.set(key, (availableEntries.get(key) ?? 0) + 1);
  };

  for (const [roomId, index] of Object.entries(assignments)) {
    if (!checkpoint.clearedRoomIds.includes(roomId)) continue;
    const plannedLoot = lootPlan[index];
    if (!plannedLoot) return false;
    addEntry({ ...plannedLoot, quantity: 1 });

    // Preserve validation for checkpoints created before dungeon cards stopped dropping.
    const cardId = LEGACY_DUNGEON_CARD_DROPS[expeditionId]?.[index];
    const card = cardId ? ARPG_ABILITY_CARD_BY_ID.get(cardId) : null;
    if (card) addEntry({ id: card.id, kind: "card", quantity: 1, label: card.name });
  }

  for (const entry of checkpoint.runLoot) {
    const key = `${entry.kind}\0${entry.id}\0${entry.quantity}\0${entry.label}`;
    const available = availableEntries.get(key) ?? 0;
    if (available === 0) return false;
    availableEntries.set(key, available - 1);
  }
  return true;
}

const RunCheckpointFieldsSchema = z.object({
  version: z.literal(1),
  currentRoomId: z.string().min(1).max(40),
  visitedRoomIds: z.array(z.string().min(1).max(40)).max(12).default([]),
  clearedRoomIds: z.array(z.string().min(1).max(40)).max(12),
  brokenBreakableIds: z.array(z.string().min(1).max(96)).max(36).default([]),
  playerHp: z.number().int().min(0).max(500),
  maxHp: z.number().int().min(1).max(500),
  weaponId: z.string().min(1).max(80),
  armorId: z.string().min(1).max(80),
  xpEarned: z.number().int().min(0).max(100_000),
  runShards: z.number().int().min(0).max(10_000),
  runLoot: z.array(RunLootEntrySchema).max(16),
  rewardRoomId: z.string().max(40).nullable(),
  exitPortalAvailable: z.boolean(),
  runMoveSpeedBonus: z.number().min(0).max(16),
  runBasicDamageMultiplier: z.number().min(1).max(1.15),
  serverCombatState: ArpgDungeonCombatStateSchema.optional(),
});

function refineCheckpointHp(checkpoint: { playerHp: number; maxHp: number }, context: z.RefinementCtx) {
  if (checkpoint.playerHp > checkpoint.maxHp) {
    context.addIssue({ code: "custom", message: "HP excede o máximo da run.", path: ["playerHp"] });
  }
}

export const ArpgRunCheckpointSchema = RunCheckpointFieldsSchema.strict().superRefine(refineCheckpointHp);
export const ArpgClientRunCheckpointSchema = RunCheckpointFieldsSchema.omit({ serverCombatState: true })
  .strict()
  .superRefine(refineCheckpointHp);

export type ArpgRunCheckpoint = z.infer<typeof ArpgRunCheckpointSchema>;

export function getArpgVisitedRoomIds(graph: DungeonGraph, checkpoint: ArpgRunCheckpoint) {
  const explicit = checkpoint.visitedRoomIds.length > 0
    ? checkpoint.visitedRoomIds
    : [...checkpoint.clearedRoomIds, checkpoint.currentRoomId, graph.startRoomId];
  return [...new Set([...explicit, ...checkpoint.clearedRoomIds, checkpoint.currentRoomId, graph.startRoomId])];
}

export function isValidArpgRunCheckpoint(
  graph: DungeonGraph,
  value: unknown,
  lootItemIds?: readonly string[],
): value is ArpgRunCheckpoint {
  const parsed = ArpgRunCheckpointSchema.safeParse(value);
  if (!parsed.success || !validateDungeonGraph(graph).valid) return false;
  const checkpoint = parsed.data;
  const roomIds = new Set(Object.keys(graph.rooms));
  const explicitVisitedIds = new Set(checkpoint.visitedRoomIds);
  const clearedIds = new Set(checkpoint.clearedRoomIds);
  const brokenBreakableIds = new Set(checkpoint.brokenBreakableIds);
  if (
    explicitVisitedIds.size !== checkpoint.visitedRoomIds.length
    || [...explicitVisitedIds].some((id) => !roomIds.has(id))
    || (checkpoint.visitedRoomIds.length > 0 && !explicitVisitedIds.has(graph.startRoomId))
    || (checkpoint.visitedRoomIds.length > 0 && !explicitVisitedIds.has(checkpoint.currentRoomId))
    || (checkpoint.visitedRoomIds.length > 0 && [...clearedIds].some((id) => !explicitVisitedIds.has(id)))
    || clearedIds.size !== checkpoint.clearedRoomIds.length
    || brokenBreakableIds.size !== checkpoint.brokenBreakableIds.length
    || !roomIds.has(checkpoint.currentRoomId)
    || [...clearedIds].some((id) => !roomIds.has(id))
    || !ARPG_WEAPON_BY_ID.has(checkpoint.weaponId)
    || !ARPG_ARMOR_BY_ID.has(checkpoint.armorId)
  ) return false;

  const visitedIds = new Set(getArpgVisitedRoomIds(graph, checkpoint));
  if (
    !visitedIds.has(graph.startRoomId)
    || !visitedIds.has(checkpoint.currentRoomId)
    || [...clearedIds].some((id) => !visitedIds.has(id))
    || [...visitedIds].some((id) => !roomIds.has(id))
  ) return false;

  const reachedVisited = new Set([graph.startRoomId]);
  const visitedQueue = [graph.startRoomId];
  while (visitedQueue.length > 0) {
    const roomId = visitedQueue.shift()!;
    for (const nextRoomId of connectedRoomIds(graph.rooms[roomId])) {
      if (visitedIds.has(nextRoomId) && !reachedVisited.has(nextRoomId)) {
        reachedVisited.add(nextRoomId);
        visitedQueue.push(nextRoomId);
      }
    }
  }
  if ([...visitedIds].some((id) => !reachedVisited.has(id))) return false;

  const validBreakableIds = new Set<string>();
  for (const roomId of new Set([...clearedIds, checkpoint.currentRoomId])) {
    const room = graph.rooms[roomId];
    for (const placement of createBreakableObjectPlacements(graph.seed, room, graph.regionId)) {
      validBreakableIds.add(placement.id);
    }
  }
  if ([...brokenBreakableIds].some((id) => !validBreakableIds.has(id))) return false;

  const armor = ARPG_ARMOR_BY_ID.get(checkpoint.armorId);
  if (!armor || checkpoint.maxHp !== PLAYER_BASE_HP + armor.maxHpBonus) return false;

  if (checkpoint.serverCombatState) {
    const combatRoom = graph.rooms[checkpoint.serverCombatState.roomId];
    const roomHasCombat = combatRoom && (combatRoom.type === "combat" || combatRoom.type === "elite" || combatRoom.type === "boss");
    if (
      !roomHasCombat
      || (!clearedIds.has(combatRoom.id) && checkpoint.currentRoomId !== combatRoom.id)
      || (clearedIds.has(combatRoom.id) && checkpoint.serverCombatState.status !== "victory")
      || (checkpoint.exitPortalAvailable && (
        combatRoom.id !== graph.bossRoomId
        || checkpoint.serverCombatState.status !== "victory"
      ))
    ) return false;
  }

  const rewardRoom = checkpoint.rewardRoomId ? graph.rooms[checkpoint.rewardRoomId] : null;
  if (
    (checkpoint.rewardRoomId !== null && (
      !rewardRoom
      || rewardRoom.id !== checkpoint.currentRoomId
      || !clearedIds.has(rewardRoom.id)
    ))
    || (checkpoint.exitPortalAvailable && (
      checkpoint.currentRoomId !== graph.bossRoomId
      || !clearedIds.has(graph.bossRoomId)
      || checkpoint.rewardRoomId !== null
    ))
  ) return false;

  const traversable = new Set([...clearedIds, graph.startRoomId, checkpoint.currentRoomId]);
  const reached = new Set([graph.startRoomId]);
  const queue = [graph.startRoomId];
  while (queue.length > 0) {
    const roomId = queue.shift()!;
    for (const nextRoomId of connectedRoomIds(graph.rooms[roomId])) {
      if (traversable.has(nextRoomId) && !reached.has(nextRoomId)) {
        reached.add(nextRoomId);
        queue.push(nextRoomId);
      }
    }
  }
  if (!reached.has(checkpoint.currentRoomId)) return false;
  if ([...clearedIds].some((id) => !reached.has(id))) return false;
  const maximumXp = getMaximumEarnableXp(graph, new Set([...clearedIds, checkpoint.currentRoomId]));
  if (maximumXp === null || checkpoint.xpEarned > maximumXp) return false;
  const maximumRunShards = getMaximumEarnableRunShards(graph, new Set([...clearedIds, checkpoint.currentRoomId]));
  if (maximumRunShards === null || checkpoint.runShards > maximumRunShards) return false;
  if (lootItemIds && !isValidSignedRunLoot(graph, checkpoint, lootItemIds)) return false;
  return true;
}

export function isValidArpgRunCheckpointTransition(
  graph: DungeonGraph,
  previousValue: unknown,
  nextValue: unknown,
  lootItemIds?: readonly string[],
): boolean {
  if (
    !isValidArpgRunCheckpoint(graph, previousValue, lootItemIds)
    || !isValidArpgRunCheckpoint(graph, nextValue, lootItemIds)
  ) return false;

  const previous = ArpgRunCheckpointSchema.parse(previousValue);
  const next = ArpgRunCheckpointSchema.parse(nextValue);
  const previousVisited = new Set(getArpgVisitedRoomIds(graph, previous));
  const nextVisited = new Set(next.visitedRoomIds.length > 0
    ? getArpgVisitedRoomIds(graph, next)
    : [...previousVisited, ...next.clearedRoomIds, next.currentRoomId, graph.startRoomId]);
  const previousRoom = graph.rooms[previous.currentRoomId];
  const previousCleared = new Set(previous.clearedRoomIds);
  const nextCleared = new Set(next.clearedRoomIds);
  const previousBrokenBreakables = new Set(previous.brokenBreakableIds);
  const nextBrokenBreakables = new Set(next.brokenBreakableIds);
  const nextRoom = graph.rooms[next.currentRoomId];
  const newlyCleared = [...nextCleared].filter((roomId) => !previousCleared.has(roomId));
  const newlyBrokenBreakables = [...nextBrokenBreakables].filter((id) => !previousBrokenBreakables.has(id));
  const breakablesInPreviousRoom = new Set(
    createBreakableObjectPlacements(graph.seed, previousRoom, graph.regionId).map((placement) => placement.id),
  );
  const maximumHealing = getMaximumCheckpointHealing(graph, previous, next, newlyCleared);
  const newlyClearedCombatRoom = newlyCleared
    .map((roomId) => graph.rooms[roomId])
    .find((room) => room.type === "combat" || room.type === "elite" || room.type === "boss");
  const newlyClearedSpecialRoom = newlyCleared.find((roomId) => (
    getSpecialRoomEncounter(graph.regionId, graph.rooms[roomId].type) !== null
  ));
  const breakableShardDelta = newlyBrokenBreakables.length;
  let validRunShardDelta = next.runShards === previous.runShards + breakableShardDelta;
  if (newlyClearedSpecialRoom) {
    validRunShardDelta = isValidSpecialRoomOutcome(
      graph,
      previous,
      next,
      newlyClearedSpecialRoom,
      breakableShardDelta,
    );
  } else if (
    previous.rewardRoomId
    && next.rewardRoomId === null
    && graph.rooms[previous.rewardRoomId]?.id === previous.currentRoomId
  ) {
    let lootAssignments: Record<string, number>;
    try {
      lootAssignments = createRunLootAssignments(graph);
    } catch {
      return false;
    }
    if (typeof lootAssignments[previous.rewardRoomId] !== "number") {
      const cache = rollCombatRoomCache(graph.seed, previous.rewardRoomId);
      validRunShardDelta = next.runShards === previous.runShards
        + (cache.kind === "cache" ? cache.shards : 0)
        + breakableShardDelta;
    }
  }
  const hasCollectedEquipment = (kind: "weapon" | "armor", id: string) => next.runLoot.some(
    (item) => item.kind === kind && item.id === id,
  );

  if (
    [...previousVisited].some((roomId) => !nextVisited.has(roomId))
    || [...nextVisited].some((roomId) => !previousVisited.has(roomId) && roomId !== next.currentRoomId)
    || [...previousCleared].some((roomId) => !nextCleared.has(roomId))
    || [...previousBrokenBreakables].some((id) => !nextBrokenBreakables.has(id))
    || (
      newlyBrokenBreakables.length > 0
      && (
        next.currentRoomId !== previous.currentRoomId
        || newlyBrokenBreakables.some((id) => !breakablesInPreviousRoom.has(id))
      )
    )
    || (
      previousRoom
      && ["combat", "elite", "boss"].includes(previousRoom.type)
      && !previousCleared.has(previousRoom.id)
      && next.currentRoomId !== previousRoom.id
    )
    || (next.weaponId !== previous.weaponId && !hasCollectedEquipment("weapon", next.weaponId))
    || (next.armorId !== previous.armorId && !hasCollectedEquipment("armor", next.armorId))
    || next.xpEarned < previous.xpEarned
    || next.xpEarned !== previous.xpEarned
    || !validRunShardDelta
    || next.playerHp - previous.playerHp > maximumHealing
    || next.runMoveSpeedBonus < previous.runMoveSpeedBonus
    || (
      next.runMoveSpeedBonus > previous.runMoveSpeedBonus
      && !(nextRoom.type === "rest" && nextCleared.has(nextRoom.id))
    )
    || next.runBasicDamageMultiplier < previous.runBasicDamageMultiplier
    || (
      next.runBasicDamageMultiplier > previous.runBasicDamageMultiplier
      && !(nextRoom.type === "shop" && nextCleared.has(nextRoom.id))
    )
    || (previous.exitPortalAvailable && !next.exitPortalAvailable)
    || next.runLoot.length < previous.runLoot.length
    || previous.runLoot.some((item, index) => {
      const nextItem = next.runLoot[index];
      return !nextItem
        || item.id !== nextItem.id
        || item.kind !== nextItem.kind
        || item.quantity !== nextItem.quantity
        || item.label !== nextItem.label;
    })
  ) return false;

  const previousRoomIsStart = graph.rooms[previous.currentRoomId]?.type === "start";
  if (
    newlyCleared.length > (previousRoomIsStart ? 2 : 1)
    || newlyCleared.some((roomId) => (
      roomId !== next.currentRoomId
      && !(previousRoomIsStart && roomId === previous.currentRoomId)
    ))
  ) return false;

  if (
    newlyClearedSpecialRoom
    && (
      newlyCleared.length !== 1
      || !isValidSpecialRoomOutcome(graph, previous, next, newlyClearedSpecialRoom, breakableShardDelta)
    )
  ) return false;

  if (newlyClearedCombatRoom) {
    const proof = previous.serverCombatState;
    const expectedRewards = getArpgCombatRewardDeltas(
      graph,
      newlyClearedCombatRoom.id,
      proof?.xpMultiplier ?? 1,
    );
    if (
      previous.currentRoomId !== newlyClearedCombatRoom.id
      || proof?.roomId !== newlyClearedCombatRoom.id
      || proof.status !== "victory"
      || !expectedRewards
      || proof.xpEarned !== expectedRewards.xp
      || proof.runShards !== expectedRewards.runShards
      || next.xpEarned !== proof.baseXpEarned + proof.xpEarned
      || next.runShards !== proof.baseRunShards + proof.runShards + breakableShardDelta
      || next.playerHp !== proof.playerHp
    ) return false;
  }

  const traversable = new Set([
    ...previousCleared,
    previous.currentRoomId,
    next.currentRoomId,
  ]);
  const reached = new Set([previous.currentRoomId]);
  const queue = [previous.currentRoomId];
  while (queue.length > 0) {
    const roomId = queue.shift()!;
    for (const nextRoomId of connectedRoomIds(graph.rooms[roomId])) {
      if (traversable.has(nextRoomId) && !reached.has(nextRoomId)) {
        reached.add(nextRoomId);
        queue.push(nextRoomId);
      }
    }
  }
  return reached.has(next.currentRoomId);
}

export function applyArpgRunCheckpoint(graph: DungeonGraph, checkpoint: ArpgRunCheckpoint) {
  const clearedIds = new Set(checkpoint.clearedRoomIds);
  const visitedIds = new Set(getArpgVisitedRoomIds(graph, checkpoint));
  for (const room of Object.values(graph.rooms)) {
    room.state = clearedIds.has(room.id) ? "cleared" : visitedIds.has(room.id) ? "discovered" : "unvisited";
  }
  const current = graph.rooms[checkpoint.currentRoomId];
  current.state = clearedIds.has(current.id) ? "cleared" : "active";
  for (const roomId of visitedIds) {
    for (const neighborId of connectedRoomIds(graph.rooms[roomId])) {
      if (graph.rooms[neighborId].state === "unvisited") graph.rooms[neighborId].state = "discovered";
    }
  }
  return graph;
}

export function createInitialArpgRunCheckpoint(options: {
  startRoomId: string;
  weaponId: string;
  armorId: string;
  maxHp: number;
}): ArpgRunCheckpoint {
  return {
    version: 1,
    currentRoomId: options.startRoomId,
    visitedRoomIds: [options.startRoomId],
    clearedRoomIds: [],
    brokenBreakableIds: [],
    playerHp: options.maxHp,
    maxHp: options.maxHp,
    weaponId: options.weaponId,
    armorId: options.armorId,
    xpEarned: 0,
    runShards: 0,
    runLoot: [],
    rewardRoomId: null,
    exitPortalAvailable: false,
    runMoveSpeedBonus: 0,
    runBasicDamageMultiplier: 1,
  };
}

export function snapshotArpgRunCheckpoint(options: {
  currentRoomId: string;
  visitedRoomIds: string[];
  clearedRoomIds: string[];
  brokenBreakableIds: string[];
  playerHp: number;
  maxHp: number;
  weaponId: string;
  armorId: string;
  xpEarned: number;
  runShards: number;
  runLoot: ArpgRunLootEntry[];
  rewardRoomId: string | null;
  exitPortalAvailable: boolean;
  runMoveSpeedBonus: number;
  runBasicDamageMultiplier: number;
}): ArpgRunCheckpoint {
  return ArpgRunCheckpointSchema.parse({ version: 1, ...options });
}
