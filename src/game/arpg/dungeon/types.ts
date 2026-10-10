export type DungeonDirection = "north" | "south" | "east" | "west";
export type DungeonRoomType = "start" | "combat" | "treasure" | "event" | "elite" | "rest" | "shop" | "boss";
export type DungeonRoomSize = "small" | "medium" | "large" | "boss";
export type DungeonRoomState = "unvisited" | "discovered" | "active" | "combat" | "cleared";
export type CombatRoomState = "idle" | "entering" | "locked" | "spawning" | "combat" | "wave_complete" | "cleared";

export type DungeonRoomConnections = Partial<Record<DungeonDirection, string>>;

export type DungeonRoom = {
  id: string;
  gridX: number;
  gridY: number;
  type: DungeonRoomType;
  size: DungeonRoomSize;
  state: DungeonRoomState;
  templateId: string;
  floor: number;
  distanceFromStart: number;
  connections: DungeonRoomConnections;
  waves: string[][];
  rewardTableId?: string;
};

export type DungeonGraph = {
  seed: string;
  regionId: string;
  floor: number;
  startRoomId: string;
  bossRoomId: string;
  rooms: Record<string, DungeonRoom>;
};
