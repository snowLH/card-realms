export type BossRoomImage = { key: string; path: string };
export type BossRoomCollisionZone = { x: number; y: number; width: number; height: number };
export type BossRoomArtDefinition = {
  background: BossRoomImage;
  foreground?: BossRoomImage;
  props?: readonly (BossRoomImage & { x: number; y: number; depth: number })[];
  width: number; height: number;
  collisionZones: readonly BossRoomCollisionZone[];
  spawn: { x: number; y: number };
  thronePosition: { x: number; y: number };
  corruptionTint: number;
};

// Same 61x31 tile footprint on client and server. The only entrance is the
// three-tile opening in the south wall; the combat center stays walkable.
export const BOSS_ARENA_COLLISION_ZONES: readonly BossRoomCollisionZone[] = [
  { x: 0, y: 0, width: 1952, height: 32 },
  { x: 0, y: 32, width: 32, height: 928 },
  { x: 1920, y: 32, width: 32, height: 928 },
  { x: 0, y: 960, width: 928, height: 32 },
  { x: 1024, y: 960, width: 928, height: 32 },
];
const arena = (id: string, corruptionTint: number, path: string): BossRoomArtDefinition => ({
  background: { key: `boss-room-${id}-v1`, path },
  width: 1952, height: 992, collisionZones: BOSS_ARENA_COLLISION_ZONES,
  spawn: { x: 976, y: 892 }, thronePosition: { x: 976, y: 144 }, corruptionTint,
});

export const BOSS_ROOM_ART: Readonly<Record<string, BossRoomArtDefinition>> = {
  "ancestral-curupira": arena("curupira", 0xb2a4bf, "/art/boss-rooms/curupira/arena.webp"),
  "deep-iara": arena("iara", 0xa0acc5, "/art/boss-rooms/iara/arena.webp"),
  "king-arthur": arena("arthur", 0xb1a4c5, "/art/boss-rooms/arthur/arena.webp"),
};

export function bossRoomArtAssets(id: string) {
  const art = BOSS_ROOM_ART[id];
  return art ? [art.background, ...(art.foreground ? [art.foreground] : []), ...(art.props ?? [])] : [];
}

export function bossRoomThronePosition(id: string, arenaWidth: number) {
  const art = BOSS_ROOM_ART[id];
  // Durable legacy rooms keep their original footprint and starting position.
  return art?.width === arenaWidth ? { ...art.thronePosition } : { x: arenaWidth / 2, y: 144 };
}
