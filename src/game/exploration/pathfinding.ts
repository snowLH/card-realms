export type GridPoint = { x: number; y: number };

type GridBounds = { columns: number; rows: number };

const keyOf = (point: GridPoint) => `${point.x}:${point.y}`;
const distance = (left: GridPoint, right: GridPoint) => (
  Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
);

function neighbours(point: GridPoint, bounds: GridBounds) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ].filter((candidate) => (
    candidate.x >= 0
    && candidate.y >= 0
    && candidate.x < bounds.columns
    && candidate.y < bounds.rows
  ));
}

export function nearestWalkablePoint(
  target: GridPoint,
  bounds: GridBounds,
  isWalkable: (point: GridPoint) => boolean,
) {
  const clamped = {
    x: Math.max(0, Math.min(bounds.columns - 1, Math.round(target.x))),
    y: Math.max(0, Math.min(bounds.rows - 1, Math.round(target.y))),
  };
  if (isWalkable(clamped)) return clamped;

  const queue = [clamped];
  const seen = new Set([keyOf(clamped)]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const candidate of neighbours(current, bounds)) {
      const key = keyOf(candidate);
      if (seen.has(key)) continue;
      if (isWalkable(candidate)) return candidate;
      seen.add(key);
      queue.push(candidate);
    }
  }
  return null;
}

export function findGridPath(
  start: GridPoint,
  destination: GridPoint,
  bounds: GridBounds,
  isWalkable: (point: GridPoint) => boolean,
) {
  const goal = nearestWalkablePoint(destination, bounds, isWalkable);
  if (!goal || !isWalkable(start)) return [];

  const open = new Set([keyOf(start)]);
  const points = new Map([[keyOf(start), start]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map([[keyOf(start), 0]]);
  const fScore = new Map([[keyOf(start), distance(start, goal)]]);

  while (open.size) {
    let currentKey = [...open].reduce((best, candidate) => (
      (fScore.get(candidate) ?? Number.POSITIVE_INFINITY)
        < (fScore.get(best) ?? Number.POSITIVE_INFINITY)
        ? candidate
        : best
    ));
    const current = points.get(currentKey)!;
    if (current.x === goal.x && current.y === goal.y) {
      const path = [current];
      while (cameFrom.has(currentKey)) {
        currentKey = cameFrom.get(currentKey)!;
        path.unshift(points.get(currentKey)!);
      }
      return path;
    }

    open.delete(currentKey);
    for (const candidate of neighbours(current, bounds)) {
      if (!isWalkable(candidate)) continue;
      const candidateKey = keyOf(candidate);
      const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
      if (tentative >= (gScore.get(candidateKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(candidateKey, currentKey);
      points.set(candidateKey, candidate);
      gScore.set(candidateKey, tentative);
      fScore.set(candidateKey, tentative + distance(candidate, goal));
      open.add(candidateKey);
    }
  }
  return [];
}

export function nearestInteractionPoint(
  target: GridPoint,
  origin: GridPoint,
  bounds: GridBounds,
  isWalkable: (point: GridPoint) => boolean,
) {
  return neighbours(target, bounds)
    .filter(isWalkable)
    .sort((left, right) => distance(left, origin) - distance(right, origin))[0]
    ?? nearestWalkablePoint(target, bounds, isWalkable);
}
