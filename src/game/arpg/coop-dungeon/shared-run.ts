import { ARPG_DUNGEON_CONFIGS } from "../content/dungeons";
import { buildRoomTileData, createSafeRoomSpawnPoints } from "../dungeon/room-tilemap";
import { DUNGEON_TILE_SIZE } from "../dungeon/layout";
import { connectedRoomIds } from "../dungeon/graph";
import { populateArpgDungeonContent } from "../dungeon/content";
import { generateDungeon } from "../dungeon/generator";
import { createSeededRandom } from "../dungeon/rng";
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

function shortestRoute(graph: ReturnType<typeof generateDungeon>) {
  const previous = new Map<string, string | null>([[graph.startRoomId, null]]);
  const queue = [graph.startRoomId];
  while (queue.length) {
    const roomId = queue.shift()!;
    if (roomId === graph.bossRoomId) break;
    for (const nextId of connectedRoomIds(graph.rooms[roomId])) {
      if (previous.has(nextId)) continue;
      previous.set(nextId, roomId);
      queue.push(nextId);
    }
  }
  const route: string[] = [];
  let cursor: string | null = graph.bossRoomId;
  while (cursor) {
    route.unshift(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return route.map((id) => graph.rooms[id]);
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
    const hpScale = room.type === "elite" ? 0.7 : 0.5;
    const maxHp = Math.max(24, Math.round(definition.maxHp * hpScale));
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
  const seed = `coop-${state.roomId}-${state.eventId}`;
  const graph = populateArpgDungeonContent(generateDungeon({ seed, regionId, minRooms: 8, maxRooms: 8 }));
  const route = shortestRoute(graph);
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
