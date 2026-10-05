import { connectedRoomIds } from "./graph";
import {
  applyArpgRunCheckpoint,
  getArpgVisitedRoomIds,
  isValidArpgRunCheckpoint,
  type ArpgRunCheckpoint,
} from "./run-checkpoint";
import type { DungeonGraph, DungeonRoom } from "./types";

function cloneGraph(graph: DungeonGraph): DungeonGraph {
  return {
    ...graph,
    rooms: Object.fromEntries(Object.entries(graph.rooms).map(([id, room]) => [id, {
      ...room,
      connections: { ...room.connections },
      waves: room.waves.map((wave) => [...wave]),
    }])),
  };
}

export class DungeonManager {
  private readonly graph: DungeonGraph;
  private readonly visitedRoomIds = new Set<string>();
  private currentRoomId: string;

  constructor(graph: DungeonGraph, checkpoint?: ArpgRunCheckpoint) {
    this.graph = cloneGraph(graph);
    if (checkpoint && isValidArpgRunCheckpoint(this.graph, checkpoint)) {
      applyArpgRunCheckpoint(this.graph, checkpoint);
      this.currentRoomId = checkpoint.currentRoomId;
      for (const roomId of getArpgVisitedRoomIds(this.graph, checkpoint)) {
        this.visitedRoomIds.add(roomId);
        this.discoverNeighbors(roomId);
      }
    } else {
      this.currentRoomId = graph.startRoomId;
      this.visitedRoomIds.add(this.currentRoomId);
      this.graph.rooms[this.currentRoomId].state = "active";
    }
    this.discoverNeighbors(this.currentRoomId);
  }

  getGraph() {
    return this.graph;
  }

  getCurrentRoom() {
    return this.graph.rooms[this.currentRoomId];
  }

  getRoom(roomId: string) {
    return this.graph.rooms[roomId];
  }

  getClearedRoomIds() {
    return Object.values(this.graph.rooms)
      .filter((room) => room.state === "cleared")
      .map((room) => room.id);
  }

  getVisitedRoomIds() {
    return [...this.visitedRoomIds].sort();
  }

  enterRoom(roomId: string) {
    const next = this.graph.rooms[roomId];
    if (!next) throw new Error(`Sala inexistente: ${roomId}.`);
    const current = this.getCurrentRoom();
    if (current.state === "combat") throw new Error("Não é possível sair durante o combate.");
    if (roomId !== current.id && !connectedRoomIds(current).includes(roomId)) {
      throw new Error("A sala escolhida não é adjacente à sala atual.");
    }
    if (current.id !== roomId && current.state === "active") {
      current.state = current.type === "start" ? "cleared" : "discovered";
    }
    this.currentRoomId = roomId;
    this.visitedRoomIds.add(roomId);
    if (next.state === "unvisited" || next.state === "discovered") next.state = "active";
    this.discoverNeighbors(roomId);
    return next;
  }

  startCombat(roomId = this.currentRoomId) {
    const room = this.graph.rooms[roomId];
    if (!room) throw new Error("Sala de combate inexistente.");
    if (room.id !== this.currentRoomId) throw new Error("Apenas a sala atual pode iniciar combate.");
    if (room.state === "cleared") return room;
    room.state = "combat";
    return room;
  }

  clearRoom(roomId = this.currentRoomId) {
    const room = this.graph.rooms[roomId];
    if (!room) throw new Error("Sala inexistente.");
    room.state = "cleared";
    this.discoverNeighbors(roomId);
    return room;
  }

  getVisibleRooms(): DungeonRoom[] {
    return Object.values(this.graph.rooms).filter((room) => room.state !== "unvisited");
  }

  isFinished() {
    return this.graph.rooms[this.graph.bossRoomId]?.state === "cleared";
  }

  private discoverNeighbors(roomId: string) {
    const room = this.graph.rooms[roomId];
    for (const neighborId of connectedRoomIds(room)) {
      const neighbor = this.graph.rooms[neighborId];
      if (neighbor.state === "unvisited") neighbor.state = "discovered";
    }
  }
}
