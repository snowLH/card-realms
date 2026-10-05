import { MARES_ROOM_WAVES } from "../content/arquipelago-das-mares";
import { MATA_ROOM_WAVES } from "../content/mata-encantada";
import { RUNIC_ROOM_WAVES } from "../content/montanhas-runicas";
import type { DungeonGraph, DungeonRoom } from "./types";

function commonWaves(room: DungeonRoom, waves: readonly (readonly string[])[]) {
  const first = [...waves[room.distanceFromStart % 3]];
  if (room.size !== "large" || room.distanceFromStart < 3) return [first];
  const second = [...waves[(room.distanceFromStart + 1) % 3]];
  return [first, second];
}

export function populateArpgDungeonContent(graph: DungeonGraph) {
  const mares = graph.regionId === "arquipelago-das-mares";
  const runic = graph.regionId === "montanhas-runicas";
  const waves = mares ? MARES_ROOM_WAVES : runic ? RUNIC_ROOM_WAVES : MATA_ROOM_WAVES;
  for (const room of Object.values(graph.rooms)) {
    if (room.type === "combat") {
      room.waves = commonWaves(room, waves);
    } else if (room.type === "elite") {
      room.waves = mares
        ? [["guardian", "skirmisher", "elite"], ["miniBoss"]]
        : runic
          ? [["stormBeast", "treasureLight", "elite"], ["miniBoss"]]
          : [["thorn", "shade", "elite"], ["miniBoss"]];
    } else if (room.type === "boss") {
      room.waves = [["boss"]];
    } else {
      room.waves = [];
    }
  }
  return graph;
}

export function populateMataDungeonContent(graph: DungeonGraph) {
  return populateArpgDungeonContent(graph);
}
