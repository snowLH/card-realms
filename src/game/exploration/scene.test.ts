import { describe, expect, it } from "vitest";
import { createLocalScene, isLocalTileWalkable, LOCAL_MAPS } from "./maps";

const regionalCreatures = ["boitata", "curupira", "caipora", "mapinguari", "iara"];

describe("cena local renovável", () => {
  it("mantém atores parados em pontos caminháveis e sem sobreposição", () => {
    const map = LOCAL_MAPS.roots;
    const scene = createLocalScene(map, regionalCreatures, () => 0.42);
    const points = [...scene.npcs, ...scene.creatures].map((actor) => actor.point);

    expect(points.every((point) => isLocalTileWalkable(map, point))).toBe(true);
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(points.length);
    expect(scene.creatures.every((actor) => regionalCreatures.includes(actor.creatureId))).toBe(true);
  });

  it("reorganiza elenco e posições quando uma nova visita é criada", () => {
    const map = LOCAL_MAPS.roots;
    const first = createLocalScene(map, regionalCreatures, () => 0.08);
    const second = createLocalScene(map, regionalCreatures, () => 0.91);

    expect(second).not.toEqual(first);
  });
});
