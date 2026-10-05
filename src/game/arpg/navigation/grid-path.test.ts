import { describe, expect, it } from "vitest";
import {
  buildGridNavigationFromBounds,
  findGridPath,
  gridCellKey,
  worldToGridCell,
  type GridNavigation,
} from "./grid-path";

function makeGrid(rows: readonly string[]): GridNavigation {
  const walkable = new Set<string>();
  rows.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      if (tile !== "#") walkable.add(gridCellKey(x, y));
    });
  });
  return { tileSize: 32, originX: 0, originY: 0, walkable };
}

describe("navegação por grade para clique e toque", () => {
  it("contorna obstáculos sem cortar diagonalmente uma parede", () => {
    const grid = makeGrid([
      "..#..",
      "..#..",
      "..#..",
      "..#..",
      ".....",
    ]);
    const path = findGridPath(grid, { x: 0, y: 0 }, { x: 128, y: 0 });
    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 128, y: 0 });
    for (let index = 1; index < (path?.length ?? 0); index += 1) {
      const previous = path![index - 1];
      const current = path![index];
      expect(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)).toBe(32);
      expect(grid.walkable.has(gridCellKey(Math.round(current.x / 32), Math.round(current.y / 32)))).toBe(true);
    }
  });

  it("acha um ponto caminhável perto do destino clicado em uma parede", () => {
    const grid = makeGrid(["...", ".#.", "..."]);
    const path = findGridPath(grid, { x: 0, y: 32 }, { x: 32, y: 32 });
    expect(path).not.toBeNull();
    expect(path?.at(-1)).not.toEqual({ x: 32, y: 32 });
    expect(grid.walkable.has(gridCellKey(Math.round(path!.at(-1)!.x / 32), Math.round(path!.at(-1)!.y / 32)))).toBe(true);
  });

  it("mantém o jogador dentro da sala durante combate e respeita corredor fechado", () => {
    const roomIdByCell = new Map<string, string>([
      [gridCellKey(0, 0), "room-a"],
      [gridCellKey(1, 0), "room-a"],
      [gridCellKey(3, 0), "room-b"],
    ]);
    const grid: GridNavigation = {
      tileSize: 32,
      originX: 0,
      originY: 0,
      walkable: new Set([gridCellKey(0, 0), gridCellKey(1, 0), gridCellKey(2, 0), gridCellKey(3, 0)]),
      roomIdByCell,
    };
    expect(findGridPath(grid, { x: 0, y: 0 }, { x: 32, y: 0 }, { allowedRoomId: "room-a" })).toEqual([
      { x: 0, y: 0 }, { x: 32, y: 0 },
    ]);
    const confinedPath = findGridPath(grid, { x: 0, y: 0 }, { x: 96, y: 0 }, { allowedRoomId: "room-a" });
    expect(confinedPath).not.toBeNull();
    expect(confinedPath?.at(-1)).toEqual({ x: 32, y: 0 });
    expect(confinedPath?.every((point) => point.x <= 32)).toBe(true);
  });

  it("constrói grade com origem móvel e limites exatos do hub", () => {
    const grid = buildGridNavigationFromBounds({
      width: 96,
      height: 96,
      tileSize: 32,
      originX: 16,
      originY: 16,
      isWalkable: ({ x, y }) => x !== 48 || y !== 48,
    });
    expect(worldToGridCell({ x: 48, y: 48 }, grid)).toEqual({ x: 1, y: 1 });
    expect(grid.walkable.has(gridCellKey(1, 1))).toBe(false);
    expect(grid.walkable.has(gridCellKey(3, 0))).toBe(false);
  });
});
