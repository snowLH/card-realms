import type { GridPoint } from "./pathfinding";

export type LocalActorDefinition = {
  id: string;
  name: string;
  role: string;
  route: GridPoint[];
};

export type LocalMapDefinition = {
  regionId: string;
  art: string;
  columns: 40;
  rows: 25;
  width: 1600;
  height: 1000;
  entry: GridPoint;
  blocked: Array<{ x: number; y: number; width: number; height: number }>;
  areaPoints: Record<string, GridPoint>;
  npcs: LocalActorDefinition[];
  creatures: Array<{ id: string; creatureId: string; route: GridPoint[] }>;
  chest: GridPoint;
};

const common = {
  columns: 40 as const,
  rows: 25 as const,
  width: 1600 as const,
  height: 1000 as const,
};

export const LOCAL_MAPS: Record<string, LocalMapDefinition> = {
  roots: {
    ...common,
    regionId: "roots",
    art: "/art/local-map-roots.png",
    entry: { x: 4, y: 20 },
    blocked: [
      { x: 0, y: 0, width: 8, height: 8 },
      { x: 13, y: 0, width: 8, height: 6 },
      { x: 26, y: 0, width: 7, height: 6 },
      { x: 34, y: 5, width: 6, height: 7 },
      { x: 0, y: 10, width: 5, height: 7 },
      { x: 12, y: 10, width: 6, height: 5 },
      { x: 22, y: 8, width: 5, height: 5 },
      { x: 7, y: 19, width: 5, height: 6 },
      { x: 28, y: 18, width: 5, height: 7 },
    ],
    areaPoints: {
      "roots-gate": { x: 4, y: 20 },
      "roots-inverted": { x: 10, y: 16 },
      "roots-whispers": { x: 20, y: 17 },
      "roots-ruins": { x: 29, y: 13 },
      "roots-heart": { x: 36, y: 3 },
    },
    npcs: [
      { id: "roots-scout", name: "Maíra", role: "Batedora da mata", route: [{ x: 7, y: 20 }, { x: 11, y: 20 }, { x: 11, y: 17 }, { x: 7, y: 17 }] },
      { id: "roots-scholar", name: "Ivo", role: "Guardião das histórias", route: [{ x: 20, y: 19 }, { x: 24, y: 19 }, { x: 24, y: 15 }, { x: 20, y: 15 }] },
    ],
    creatures: [
      { id: "roots-wild-1", creatureId: "curupira", route: [{ x: 15, y: 18 }, { x: 18, y: 18 }, { x: 18, y: 21 }] },
      { id: "roots-wild-2", creatureId: "mapinguari", route: [{ x: 31, y: 15 }, { x: 34, y: 15 }, { x: 34, y: 12 }] },
      { id: "roots-wild-3", creatureId: "uirapuru-encantado", route: [{ x: 31, y: 7 }, { x: 36, y: 7 }, { x: 36, y: 4 }] },
    ],
    chest: { x: 25, y: 21 },
  },
  archipelago: {
    ...common,
    regionId: "archipelago",
    art: "/art/local-map-archipelago.png",
    entry: { x: 3, y: 20 },
    blocked: [
      { x: 0, y: 0, width: 9, height: 7 }, { x: 13, y: 0, width: 8, height: 5 },
      { x: 27, y: 0, width: 6, height: 7 }, { x: 34, y: 8, width: 6, height: 6 },
      { x: 0, y: 9, width: 5, height: 7 }, { x: 10, y: 10, width: 6, height: 5 },
      { x: 20, y: 8, width: 5, height: 6 }, { x: 7, y: 20, width: 6, height: 5 },
      { x: 28, y: 19, width: 6, height: 6 },
    ],
    areaPoints: {
      "archipelago-dock": { x: 3, y: 20 }, "archipelago-promises": { x: 10, y: 17 },
      "archipelago-tides": { x: 20, y: 17 }, "archipelago-reef": { x: 29, y: 14 },
      "archipelago-abyss": { x: 36, y: 4 },
    },
    npcs: [
      { id: "archipelago-sailor", name: "Nalu", role: "Barqueira das marés", route: [{ x: 7, y: 19 }, { x: 11, y: 19 }, { x: 11, y: 16 }] },
      { id: "archipelago-priest", name: "Seiji", role: "Guardião dos sinos", route: [{ x: 20, y: 19 }, { x: 25, y: 19 }, { x: 25, y: 16 }] },
    ],
    creatures: [
      { id: "archipelago-wild-1", creatureId: "boto-cor-de-rosa", route: [{ x: 15, y: 18 }, { x: 18, y: 18 }, { x: 18, y: 21 }] },
      { id: "archipelago-wild-2", creatureId: "selkie", route: [{ x: 30, y: 16 }, { x: 34, y: 16 }, { x: 34, y: 13 }] },
      { id: "archipelago-wild-3", creatureId: "umibozu", route: [{ x: 30, y: 7 }, { x: 36, y: 7 }, { x: 36, y: 4 }] },
    ],
    chest: { x: 26, y: 21 },
  },
  runic: {
    ...common,
    regionId: "runic",
    art: "/art/local-map-runic.png",
    entry: { x: 4, y: 21 },
    blocked: [
      { x: 0, y: 0, width: 8, height: 8 }, { x: 13, y: 0, width: 8, height: 6 },
      { x: 27, y: 0, width: 7, height: 6 }, { x: 34, y: 7, width: 6, height: 6 },
      { x: 0, y: 10, width: 5, height: 7 }, { x: 11, y: 10, width: 6, height: 5 },
      { x: 22, y: 9, width: 5, height: 5 }, { x: 8, y: 20, width: 5, height: 5 },
      { x: 29, y: 19, width: 5, height: 6 },
    ],
    areaPoints: {
      "runic-pass": { x: 4, y: 21 }, "runic-bridge": { x: 11, y: 17 },
      "runic-mine": { x: 20, y: 18 }, "runic-thunder": { x: 29, y: 14 },
      "runic-shrine": { x: 36, y: 3 },
    },
    npcs: [
      { id: "runic-smith", name: "Yrsa", role: "Ferreira rúnica", route: [{ x: 7, y: 20 }, { x: 11, y: 20 }, { x: 11, y: 17 }] },
      { id: "runic-climber", name: "Tashi", role: "Guia das alturas", route: [{ x: 20, y: 20 }, { x: 25, y: 20 }, { x: 25, y: 16 }] },
    ],
    creatures: [
      { id: "runic-wild-1", creatureId: "carbunclo", route: [{ x: 15, y: 18 }, { x: 18, y: 18 }, { x: 18, y: 21 }] },
      { id: "runic-wild-2", creatureId: "raiju", route: [{ x: 30, y: 16 }, { x: 34, y: 16 }, { x: 34, y: 13 }] },
      { id: "runic-wild-3", creatureId: "yeti", route: [{ x: 30, y: 7 }, { x: 36, y: 7 }, { x: 36, y: 4 }] },
    ],
    chest: { x: 26, y: 22 },
  },
  mist: {
    ...common,
    regionId: "mist",
    art: "/art/local-map-mist.png",
    entry: { x: 3, y: 21 },
    blocked: [
      { x: 0, y: 0, width: 9, height: 7 }, { x: 14, y: 0, width: 7, height: 6 },
      { x: 27, y: 0, width: 7, height: 6 }, { x: 35, y: 8, width: 5, height: 7 },
      { x: 0, y: 10, width: 5, height: 7 }, { x: 11, y: 10, width: 6, height: 6 },
      { x: 22, y: 9, width: 5, height: 5 }, { x: 8, y: 20, width: 6, height: 5 },
      { x: 28, y: 19, width: 6, height: 6 },
    ],
    areaPoints: {
      "mist-bank": { x: 3, y: 21 }, "mist-village": { x: 11, y: 17 },
      "mist-grove": { x: 20, y: 18 }, "mist-echoes": { x: 29, y: 14 },
      "mist-house": { x: 36, y: 4 },
    },
    npcs: [
      { id: "mist-herbalist", name: "Vesna", role: "Herborista da névoa", route: [{ x: 7, y: 20 }, { x: 11, y: 20 }, { x: 11, y: 17 }] },
      { id: "mist-ferryman", name: "Olek", role: "Barqueiro silencioso", route: [{ x: 20, y: 20 }, { x: 25, y: 20 }, { x: 25, y: 16 }] },
    ],
    creatures: [
      { id: "mist-wild-1", creatureId: "domovoi", route: [{ x: 15, y: 18 }, { x: 18, y: 18 }, { x: 18, y: 21 }] },
      { id: "mist-wild-2", creatureId: "fogo-fatuo", route: [{ x: 30, y: 16 }, { x: 34, y: 16 }, { x: 34, y: 13 }] },
      { id: "mist-wild-3", creatureId: "leshy", route: [{ x: 30, y: 7 }, { x: 36, y: 7 }, { x: 36, y: 4 }] },
    ],
    chest: { x: 26, y: 22 },
  },
  desert: {
    ...common,
    regionId: "desert",
    art: "/art/local-map-desert.png",
    entry: { x: 4, y: 21 },
    blocked: [
      { x: 0, y: 0, width: 8, height: 8 }, { x: 13, y: 0, width: 8, height: 6 },
      { x: 27, y: 0, width: 7, height: 6 }, { x: 35, y: 7, width: 5, height: 7 },
      { x: 0, y: 10, width: 5, height: 7 }, { x: 11, y: 10, width: 6, height: 5 },
      { x: 22, y: 9, width: 5, height: 5 }, { x: 8, y: 20, width: 6, height: 5 },
      { x: 29, y: 19, width: 5, height: 6 },
    ],
    areaPoints: {
      "desert-gate": { x: 4, y: 21 }, "desert-ossuary": { x: 11, y: 17 },
      "desert-oasis": { x: 20, y: 18 }, "desert-sun": { x: 29, y: 14 },
      "desert-tomb": { x: 36, y: 4 },
    },
    npcs: [
      { id: "desert-merchant", name: "Amara", role: "Mercadora do oásis", route: [{ x: 7, y: 20 }, { x: 11, y: 20 }, { x: 11, y: 17 }] },
      { id: "desert-scribe", name: "Nadir", role: "Escriba dos reis", route: [{ x: 20, y: 20 }, { x: 25, y: 20 }, { x: 25, y: 16 }] },
    ],
    creatures: [
      { id: "desert-wild-1", creatureId: "ifrit", route: [{ x: 15, y: 18 }, { x: 18, y: 18 }, { x: 18, y: 21 }] },
      { id: "desert-wild-2", creatureId: "esfinge", route: [{ x: 30, y: 16 }, { x: 34, y: 16 }, { x: 34, y: 13 }] },
      { id: "desert-wild-3", creatureId: "roc", route: [{ x: 30, y: 7 }, { x: 36, y: 7 }, { x: 36, y: 4 }] },
    ],
    chest: { x: 26, y: 22 },
  },
};

export function isLocalTileWalkable(map: LocalMapDefinition, point: GridPoint) {
  if (point.x < 0 || point.y < 0 || point.x >= map.columns || point.y >= map.rows) return false;
  return !map.blocked.some((rect) => (
    point.x >= rect.x
    && point.x < rect.x + rect.width
    && point.y >= rect.y
    && point.y < rect.y + rect.height
  ));
}
