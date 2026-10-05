import { computeRoomDistances, DIRECTION_VECTOR, DUNGEON_DIRECTIONS, OPPOSITE_DIRECTION, roomCoordinateKey, validateDungeonGraph } from "./graph";
import { createSeededRandom, type SeededRandom } from "./rng";
import { pickDungeonTemplate } from "./templates";
import type { DungeonDirection, DungeonGraph, DungeonRoom } from "./types";

export type DungeonGeneratorOptions = {
  seed: string;
  regionId?: string;
  floor?: number;
  minRooms?: number;
  maxRooms?: number;
};

type MutableGraph = {
  rooms: Record<string, DungeonRoom>;
  occupied: Map<string, string>;
  nextId: number;
};

function availableDirections(room: DungeonRoom, graph: MutableGraph) {
  return DUNGEON_DIRECTIONS.filter((direction) => {
    const vector = DIRECTION_VECTOR[direction];
    return !graph.occupied.has(roomCoordinateKey(room.gridX + vector.x, room.gridY + vector.y));
  });
}

function addRoom(graph: MutableGraph, parent: DungeonRoom, direction: DungeonDirection, floor: number) {
  const vector = DIRECTION_VECTOR[direction];
  const id = `room-${graph.nextId++}`;
  const room: DungeonRoom = {
    id,
    gridX: parent.gridX + vector.x,
    gridY: parent.gridY + vector.y,
    type: "combat",
    size: "medium",
    state: "unvisited",
    templateId: "",
    floor,
    distanceFromStart: 0,
    connections: { [OPPOSITE_DIRECTION[direction]]: parent.id },
    waves: [],
  };
  parent.connections[direction] = id;
  graph.rooms[id] = room;
  graph.occupied.set(roomCoordinateKey(room.gridX, room.gridY), id);
  return room;
}

function chooseBranchParent(graph: MutableGraph, bossId: string, random: SeededRandom) {
  const candidates = Object.values(graph.rooms).filter((room) =>
    room.id !== bossId && availableDirections(room, graph).length > 0
  );
  return candidates.length ? random.pick(candidates) : null;
}

function degree(room: DungeonRoom) {
  return Object.values(room.connections).filter(Boolean).length;
}

function assignRoomTypes(graph: DungeonGraph, random: SeededRandom) {
  const rooms = Object.values(graph.rooms);
  const distances = computeRoomDistances(graph);
  const start = graph.rooms[graph.startRoomId];
  const boss = graph.rooms[graph.bossRoomId];
  start.type = "start";
  boss.type = "boss";

  const candidates = rooms.filter((room) => room.id !== start.id && room.id !== boss.id);
  const terminals = candidates.filter((room) => degree(room) === 1);
  const treasure = random.pick(terminals.length ? terminals : candidates);
  treasure.type = "treasure";

  const eliteCandidates = candidates.filter((room) => room.id !== treasure.id)
    .sort((left, right) => (distances.get(right.id) ?? 0) - (distances.get(left.id) ?? 0));
  const elitePool = eliteCandidates.slice(0, Math.max(1, Math.ceil(eliteCandidates.length / 2)));
  const elite = random.pick(elitePool);
  elite.type = "elite";

  const remaining = candidates.filter((room) => room.id !== treasure.id && room.id !== elite.id);
  if (remaining.length > 0) random.pick(remaining).type = "event";

  const afterEvent = remaining.filter((room) => room.type === "combat");
  if (afterEvent.length > 0) random.pick(afterEvent).type = "rest";

  const afterRest = remaining.filter((room) => room.type === "combat");
  if (afterRest.length > 0) random.pick(afterRest).type = "shop";
}

function finalizeRooms(graph: DungeonGraph, random: SeededRandom) {
  const distances = computeRoomDistances(graph);
  for (const room of Object.values(graph.rooms)) {
    const roomTemplate = pickDungeonTemplate(graph.regionId, room.type, random);
    room.distanceFromStart = distances.get(room.id) ?? 0;
    room.size = roomTemplate.size;
    room.templateId = roomTemplate.id;
    room.rewardTableId = `${graph.regionId}-${room.type}`;
    room.state = room.type === "start" ? "active" : "unvisited";
  }
}

function generateAttempt(options: Required<DungeonGeneratorOptions>, attempt: number) {
  const random = createSeededRandom(`${options.seed}:${attempt}`);
  const targetCount = random.int(options.minRooms, options.maxRooms);
  const mainLength = Math.min(targetCount - 1, random.int(6, Math.min(8, targetCount - 1)));
  const mutable: MutableGraph = { rooms: {}, occupied: new Map(), nextId: 1 };
  const start: DungeonRoom = {
    id: "room-0", gridX: 0, gridY: 0, type: "start", size: "medium", state: "active",
    templateId: "", floor: options.floor, distanceFromStart: 0, connections: {}, waves: [],
  };
  mutable.rooms[start.id] = start;
  mutable.occupied.set(roomCoordinateKey(0, 0), start.id);

  let current = start;
  const mainPath = [start.id];
  for (let index = 1; index < mainLength; index += 1) {
    const directions = random.shuffle(availableDirections(current, mutable));
    if (directions.length === 0) return null;
    current = addRoom(mutable, current, directions[0], options.floor);
    mainPath.push(current.id);
  }
  const bossId = current.id;

  while (Object.keys(mutable.rooms).length < targetCount) {
    const parent = chooseBranchParent(mutable, bossId, random);
    if (!parent) return null;
    const directions = random.shuffle(availableDirections(parent, mutable));
    addRoom(mutable, parent, directions[0], options.floor);
  }

  const graph: DungeonGraph = {
    seed: options.seed,
    regionId: options.regionId,
    floor: options.floor,
    startRoomId: start.id,
    bossRoomId: bossId,
    rooms: mutable.rooms,
  };
  assignRoomTypes(graph, random);
  finalizeRooms(graph, random);
  return graph;
}

export function generateDungeon(options: DungeonGeneratorOptions): DungeonGraph {
  const normalized: Required<DungeonGeneratorOptions> = {
    seed: options.seed,
    regionId: options.regionId ?? "mata-encantada",
    floor: options.floor ?? 1,
    minRooms: options.minRooms ?? 8,
    maxRooms: options.maxRooms ?? 12,
  };
  if (normalized.minRooms < 8 || normalized.maxRooms > 12 || normalized.minRooms > normalized.maxRooms) {
    throw new Error("A vertical slice aceita entre 8 e 12 salas por dungeon.");
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const graph = generateAttempt(normalized, attempt);
    if (!graph) continue;
    const validation = validateDungeonGraph(graph);
    if (validation.valid) return graph;
  }
  throw new Error(`Não foi possível gerar dungeon válida para seed ${normalized.seed}.`);
}
