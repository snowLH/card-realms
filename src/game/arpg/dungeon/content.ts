import { MARES_ROOM_WAVES } from "../content/arquipelago-das-mares";
import { MATA_ROOM_WAVES } from "../content/mata-encantada";
import { RUNIC_ROOM_WAVES } from "../content/montanhas-runicas";
import type { DungeonGraph, DungeonRoom } from "./types";
import { createSeededRandom } from "./rng";

/** Stable encounter variety: identical seed+room yields identical waves client/server.
 * Prevents easy memorization of the same three waves by graph distance.
 */
function commonWaves(graph: DungeonGraph, room: DungeonRoom, waves: readonly (readonly string[])[]) {
  const random = createSeededRandom(`${graph.seed}:${graph.regionId}:${room.id}:combat`);
  const first = random.pick(waves);
  const result = [[...first]];
  const additionalWave = room.size === "large"
    ? room.distanceFromStart >= 3
    : room.distanceFromStart >= 4 && random.int(1, 4) === 1;
  if (additionalWave && waves.length > 1) {
    const different = waves.filter((candidate) => candidate !== first);
    result.push([...random.pick(different)]);
  }
  return result;
}

export function populateArpgDungeonContent(graph: DungeonGraph) {
  const mares = graph.regionId === "arquipelago-das-mares";
  const runic = graph.regionId === "montanhas-runicas";
  const waves = mares ? MARES_ROOM_WAVES : runic ? RUNIC_ROOM_WAVES : MATA_ROOM_WAVES;
  for (const room of Object.values(graph.rooms)) {
    if (room.type === "combat") {
      room.waves = commonWaves(graph, room, waves);
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
