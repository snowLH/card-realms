import { ARPG_DUNGEON_CONFIGS } from "../content/dungeons";
import { buildRoomTileData, createSafeRoomSpawnPoints } from "../dungeon/room-tilemap";
import { DUNGEON_TILE_SIZE } from "../dungeon/layout";
import { connectedRoomIds } from "../dungeon/graph";
import { populateArpgDungeonContent } from "../dungeon/content";
import { generateDungeon } from "../dungeon/generator";
import { createArpgDungeonSeed } from "../dungeon/encounter-seed";
import { createSeededRandom } from "../dungeon/rng";
import { scaleCoopEnemyHealth } from "./scaling";
import { ARPG_ROOM_TEMPLATE_BY_ID } from "../dungeon/templates";
import type { ArpgRaidDungeonEnemyState, ArpgRaidDungeonRoomState, ArpgRaidDungeonState, ArpgRaidPlayerState, ArpgRaidState } from "../raid/types";
import type { ArpgExpeditionId } from "../content/expeditions";
import type { DungeonRoom } from "../dungeon/types";

const ROOM_LABELS: Record<DungeonRoom["type"], string> = {
  start: "Acampamento",
  combat: "Câmara de combate",
  treasure: "Câmara do tesouro",
  event: "Altar ancestral",
  elite: "Covil de elite",
  rest: "Refúgio",
  shop: "Mercado errante",
  boss: "Arena final",
};

export const ARPG_SHARED_DUNGEON_CORRIDOR_WIDTH = DUNGEON_TILE_SIZE * 8;
export const ARPG_SHARED_DUNGEON_MIN_DURATION_MS = 20 * 60_000;

/** Each generated co-op arena must be accessible. We visit the graph in
 * breadth-first order and reserve the final boss for last. The room corridor
 * itself is linear because the multiplayer run advances as one party.
 */
export function planArpgCoopRoomSequence(graph: ReturnType<typeof generateDungeon>): DungeonRoom[] {
  const visited = new Set([graph.startRoomId]);
  const queue = [graph.startRoomId];
  const result: DungeonRoom[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const room = graph.rooms[id];
    if (id !== graph.bossRoomId) result.push(room);
    for (const nextId of connectedRoomIds(room)) {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push(nextId);
      }
    }
  }
  if (visited.size !== Object.keys(graph.rooms).length) {
    throw new Error("A dungeon cooperativa contém salas inacessíveis.");
  }
  return [...result, graph.rooms[graph.bossRoomId]];
}

function buildRoomEnemies(
  regionId: ArpgExpeditionId,
  room: Pick<ArpgRaidDungeonRoomState, "id" | "type" | "templateId" | "worldWidth" | "worldHeight" | "waves">,
  waveIndex: number,
  partySize: number,
  seed: string,
): ArpgRaidDungeonEnemyState[] {
  const config = ARPG_DUNGEON_CONFIGS[regionId];
  const ids = room.waves[waveIndex] ?? [];
  const template = ARPG_ROOM_TEMPLATE_BY_ID.get(room.templateId);
  if (!template || ids.length === 0) return [];
  const tileData = buildRoomTileData(room.templateId, {}, seed);
  const positions = createSafeRoomSpawnPoints(tileData, partySize + ids.length);
  const random = createSeededRandom(`${seed}:${room.id}:wave:${waveIndex}`);
  return ids.flatMap((definitionId, index) => {
    const definition = config.enemies[definitionId];
    if (!definition) return [];
    const position = positions[partySize + index] ?? { x: room.worldWidth / 2, y: room.worldHeight / 2 };
    const maxHp = scaleCoopEnemyHealth(definition.maxHp, room.type === "elite", partySize);
    return [{
      id: `${room.id}:w${waveIndex}:${index}:${random.int(0, 0xffff).toString(16)}`,
      definitionId,
      name: definition.name,
      waveIndex,
      x: position.x,
      y: position.y,
      hp: maxHp,
      maxHp,
      alive: true,
      contactDamage: Math.max(5, Math.round(definition.contactDamage * 0.65)),
      moveSpeed: definition.moveSpeed,
      slowedUntilMs: 0,
      nextAttackAtMs: 0,
    }];
  });
}

export function spawnArpgRaidDungeonWave(
  dungeon: ArpgRaidDungeonState,
  room: ArpgRaidDungeonRoomState,
  waveIndex: number,
  partySize: number,
  atMs: number,
) {
  room.waveIndex = waveIndex;
  if (room.type !== "combat" && room.type !== "elite") {
    room.enemies = [];
    room.state = "awaiting_exit";
    room.waveCompleteAtMs = null;
    room.nextRoomAtMs = null;
    return;
  }
  room.enemies = buildRoomEnemies(dungeon.regionId, room, waveIndex, partySize, dungeon.seed);
  for (const enemy of room.enemies) enemy.nextAttackAtMs = atMs + 800 + waveIndex * 250;
  room.state = room.enemies.length ? "combat" : "awaiting_exit";
  room.waveCompleteAtMs = null;
  room.nextRoomAtMs = null;
}

export function attachArpgSharedDungeon(
  state: ArpgRaidState,
  regionId: ArpgExpeditionId = "mata-encantada",
): ArpgRaidState {
  const seed = createArpgDungeonSeed(regionId, `coop-${state.roomId}-${state.eventId}`);
  const graph = populateArpgDungeonContent(generateDungeon({ seed, regionId, minRooms: 8, maxRooms: 8 }));
  const route = planArpgCoopRoomSequence(graph);
  const rooms: ArpgRaidDungeonRoomState[] = route.map((room) => {
    const tileData = buildRoomTileData(room.templateId, room.connections, seed);
    const roomWidth = tileData.width * DUNGEON_TILE_SIZE;
    const corridorWidth = room.type === "boss" ? 0 : ARPG_SHARED_DUNGEON_CORRIDOR_WIDTH;
    const isCombatRoom = room.type === "combat" || room.type === "elite";
    const waves = isCombatRoom ? room.waves : [];
    return {
      id: room.id,
      type: room.type,
      templateId: room.templateId,
      label: ROOM_LABELS[room.type],
      roomWidth,
      corridorWidth,
      worldWidth: roomWidth + corridorWidth,
      worldHeight: tileData.height * DUNGEON_TILE_SIZE,
      waves: waves.map((wave) => [...wave]),
      waveIndex: 0,
      state: room.type === "start" ? "cleared" : isCombatRoom ? "combat" : "awaiting_exit",
      waveCompleteAtMs: null,
      nextRoomAtMs: null,
      enemies: [],
    };
  });
  const dungeon: ArpgRaidDungeonState = { regionId, seed, roomIndex: Math.min(1, rooms.length - 1), rooms };
  const current = rooms[dungeon.roomIndex];
  spawnArpgRaidDungeonWave(dungeon, current, 0, state.players.length, state.serverTimeMs);
  const tileData = buildRoomTileData(current.templateId, {}, seed);
  const playerSpawns = createSafeRoomSpawnPoints(tileData, state.players.length);
  for (const player of state.players) {
    const spawn = playerSpawns[player.seat - 1] ?? { x: current.worldWidth / 2, y: current.worldHeight / 2 };
    player.x = spawn.x;
    player.y = spawn.y;
  }
  state.dungeon = dungeon;
  // A multi-room expedition must not inherit the six-minute single-boss timeout.
  state.maxDurationMs = Math.max(state.maxDurationMs, ARPG_SHARED_DUNGEON_MIN_DURATION_MS);
  state.boss.x = current.roomWidth / 2;
  state.boss.y = current.worldHeight / 2 - 110;
  return state;
}

export function activeArpgRaidDungeonRoom(state: ArpgRaidState) {
  return state.dungeon?.rooms[state.dungeon.roomIndex] ?? null;
}

export function activeArpgRaidDungeonWorld(state: ArpgRaidState) {
  const room = activeArpgRaidDungeonRoom(state);
  return room
    ? { width: room.worldWidth, height: room.worldHeight }
    : { width: 1280, height: 720 };
}

export function entryPositionsForRoom(room: ArpgRaidDungeonRoomState, players: readonly ArpgRaidPlayerState[], seed: string) {
  const tileData = buildRoomTileData(room.templateId, {}, seed);
  return createSafeRoomSpawnPoints(tileData, players.length);
}
