import type { DungeonGraph, DungeonRoom } from "../dungeon/types";

const ROOM_SYMBOL: Record<DungeonRoom["type"], string> = {
  start: "S",
  combat: "C",
  treasure: "T",
  event: "?",
  elite: "E",
  rest: "R",
  shop: "$",
  boss: "B",
};

export function summarizeDungeonGraph(graph: DungeonGraph) {
  return Object.values(graph.rooms)
    .sort((left, right) => left.distanceFromStart - right.distanceFromStart || left.id.localeCompare(right.id))
    .map((room) => ({
      id: room.id,
      grid: `${room.gridX},${room.gridY}`,
      type: room.type,
      size: room.size,
      state: room.state,
      distance: room.distanceFromStart,
      doors: Object.keys(room.connections).sort(),
      templateId: room.templateId,
    }));
}

export function renderDungeonAscii(graph: DungeonGraph, revealAll = true) {
  const rooms = Object.values(graph.rooms).filter((room) => revealAll || room.state !== "unvisited");
  if (rooms.length === 0) return "";
  const minX = Math.min(...rooms.map((room) => room.gridX));
  const maxX = Math.max(...rooms.map((room) => room.gridX));
  const minY = Math.min(...rooms.map((room) => room.gridY));
  const maxY = Math.max(...rooms.map((room) => room.gridY));
  const byCoordinate = new Map(rooms.map((room) => [`${room.gridX},${room.gridY}`, room]));
  const lines: string[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    const roomLine: string[] = [];
    const connectorLine: string[] = [];
    for (let x = minX; x <= maxX; x += 1) {
      const room = byCoordinate.get(`${x},${y}`);
      roomLine.push(room ? `[${ROOM_SYMBOL[room.type]}]${room.connections.east ? "—" : " "}` : "    ");
      connectorLine.push(room?.connections.south ? " |  " : "    ");
    }
    lines.push(roomLine.join(""));
    if (y < maxY) lines.push(connectorLine.join(""));
  }
  return lines.join("\n");
}
