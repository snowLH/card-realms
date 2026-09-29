import { describe, expect, it } from "vitest";
import { findGridPath, nearestWalkablePoint } from "./pathfinding";

describe("local map pathfinding", () => {
  it("walks around blocked tiles instead of crossing them", () => {
    const blocked = new Set(["2:0", "2:1", "2:2", "2:3"]);
    const path = findGridPath(
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { columns: 5, rows: 5 },
      (point) => !blocked.has(`${point.x}:${point.y}`),
    );
    expect(path.at(-1)).toEqual({ x: 4, y: 1 });
    expect(path.some((point) => blocked.has(`${point.x}:${point.y}`))).toBe(false);
    expect(path.length).toBeGreaterThan(5);
  });

  it("snaps clicks on scenery to the nearest walkable tile", () => {
    const point = nearestWalkablePoint(
      { x: 2, y: 2 },
      { columns: 5, rows: 5 },
      (candidate) => candidate.x === 4,
    );
    expect(point).toEqual({ x: 4, y: 2 });
  });

  it("returns no route when the destination is sealed off", () => {
    const path = findGridPath(
      { x: 0, y: 0 },
      { x: 3, y: 3 },
      { columns: 4, rows: 4 },
      (point) => point.x !== 1,
    );
    expect(path).toEqual([]);
  });
});
