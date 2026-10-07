export type GridPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };

export type GridNavigation = {
  tileSize: number;
  originX: number;
  originY: number;
  walkable: ReadonlySet<string>;
  roomIdByCell?: ReadonlyMap<string, string>;
};

export type GridPathOptions = {
  allowedRoomId?: string;
  nearestSearchRadius?: number;
};

export function gridCellKey(x: number, y: number) {
  return `${x},${y}`;
}

export function worldToGridCell(point: WorldPoint, grid: Pick<GridNavigation, "tileSize" | "originX" | "originY">): GridPoint {
  return {
    x: Math.round((point.x - grid.originX) / grid.tileSize),
    y: Math.round((point.y - grid.originY) / grid.tileSize),
  };
}

export function gridCellToWorld(point: GridPoint, grid: Pick<GridNavigation, "tileSize" | "originX" | "originY">): WorldPoint {
  return {
    x: grid.originX + point.x * grid.tileSize,
    y: grid.originY + point.y * grid.tileSize,
  };
}

/** True when every grid cell between two world points is walkable. */
export function hasGridLineOfSight(grid: GridNavigation, start: WorldPoint, end: WorldPoint) {
  let x = worldToGridCell(start, grid).x;
  let y = worldToGridCell(start, grid).y;
  const target = worldToGridCell(end, grid);
  const dx = Math.abs(target.x - x);
  const dy = Math.abs(target.y - y);
  const stepX = x < target.x ? 1 : -1;
  const stepY = y < target.y ? 1 : -1;
  let error = dx - dy;

  if (!grid.walkable.has(gridCellKey(x, y)) || !grid.walkable.has(gridCellKey(target.x, target.y))) return false;

  while (x !== target.x || y !== target.y) {
    const doubledError = error * 2;
    if (doubledError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubledError < dx) {
      error += dx;
      y += stepY;
    }
    if ((x !== target.x || y !== target.y) && !grid.walkable.has(gridCellKey(x, y))) return false;
  }
  return true;
}

type HeapEntry = { key: string; x: number; y: number; cost: number; priority: number };

class MinHeap {
  private values: HeapEntry[] = [];

  get size() {
    return this.values.length;
  }

  push(value: HeapEntry) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].priority <= value.priority) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    if (this.values.length === 0) return undefined;
    const first = this.values[0];
    const last = this.values.pop()!;
    if (this.values.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child = right < this.values.length && this.values[right].priority < this.values[left].priority
          ? right
          : left;
        if (this.values[child].priority >= last.priority) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}

const NEIGHBORS: readonly GridPoint[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function manhattan(a: GridPoint, b: GridPoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findNearestWalkableCell(
  worldPoint: WorldPoint,
  grid: GridNavigation,
  allowedRoomId: string | undefined,
  radius: number,
) {
  const origin = worldToGridCell(worldPoint, grid);
  const isWalkable = (cell: GridPoint) => {
    const key = gridCellKey(cell.x, cell.y);
    return grid.walkable.has(key)
      && (!allowedRoomId || grid.roomIdByCell?.get(key) === allowedRoomId);
  };

  for (let distance = 0; distance <= radius; distance += 1) {
    let nearest: GridPoint | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let offsetX = -distance; offsetX <= distance; offsetX += 1) {
      const offsetY = distance - Math.abs(offsetX);
      for (const signedY of offsetY === 0 ? [0] : [-offsetY, offsetY]) {
        const candidate = { x: origin.x + offsetX, y: origin.y + signedY };
        if (!isWalkable(candidate)) continue;
        const position = gridCellToWorld(candidate, grid);
        const worldDistance = (position.x - worldPoint.x) ** 2 + (position.y - worldPoint.y) ** 2;
        if (worldDistance < nearestDistance) {
          nearest = candidate;
          nearestDistance = worldDistance;
        }
      }
    }
    if (nearest) return nearest;
  }
  return null;
}

export function findGridPath(
  grid: GridNavigation,
  start: WorldPoint,
  destination: WorldPoint,
  options: GridPathOptions = {},
): WorldPoint[] | null {
  const startCell = findNearestWalkableCell(
    start,
    grid,
    options.allowedRoomId,
    options.nearestSearchRadius ?? 12,
  );
  const targetCell = findNearestWalkableCell(
    destination,
    grid,
    options.allowedRoomId,
    options.nearestSearchRadius ?? 12,
  );
  if (!startCell || !targetCell) return null;

  const startKey = gridCellKey(startCell.x, startCell.y);
  const targetKey = gridCellKey(targetCell.x, targetCell.y);
  const frontier = new MinHeap();
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>([[startKey, 0]]);
  frontier.push({ ...startCell, key: startKey, cost: 0, priority: manhattan(startCell, targetCell) });

  while (frontier.size > 0) {
    const current = frontier.pop()!;
    if (current.cost !== costs.get(current.key)) continue;
    if (current.key === targetKey) {
      const path: GridPoint[] = [{ x: current.x, y: current.y }];
      let key = current.key;
      while (key !== startKey) {
        key = cameFrom.get(key)!;
        const [x, y] = key.split(",").map(Number);
        path.push({ x, y });
      }
      path.reverse();
      return path.map((cell) => gridCellToWorld(cell, grid));
    }

    for (const offset of NEIGHBORS) {
      const x = current.x + offset.x;
      const y = current.y + offset.y;
      const key = gridCellKey(x, y);
      if (!grid.walkable.has(key)) continue;
      if (options.allowedRoomId && grid.roomIdByCell?.get(key) !== options.allowedRoomId) continue;
      const nextCost = current.cost + 1;
      if (nextCost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(key, nextCost);
      cameFrom.set(key, current.key);
      frontier.push({ x, y, key, cost: nextCost, priority: nextCost + manhattan({ x, y }, targetCell) });
    }
  }
  return null;
}

export function buildGridNavigationFromBounds(options: {
  width: number;
  height: number;
  tileSize: number;
  originX?: number;
  originY?: number;
  isWalkable: (point: WorldPoint) => boolean;
}): GridNavigation {
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const walkable = new Set<string>();
  const columns = Math.ceil((options.width - originX) / options.tileSize);
  const rows = Math.ceil((options.height - originY) / options.tileSize);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const point = { x: originX + x * options.tileSize, y: originY + y * options.tileSize };
      if (point.x >= options.width || point.y >= options.height || !options.isWalkable(point)) continue;
      walkable.add(gridCellKey(x, y));
    }
  }
  return { tileSize: options.tileSize, originX, originY, walkable };
}
