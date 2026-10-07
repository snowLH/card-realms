import { buildGridNavigationFromBounds } from "../navigation/grid-path";

export type HubDestinationId =
  | "expeditions"
  | "loadout"
  | "archive"
  | "avatar"
  | "merchant"
  | "portal"
  | "collection"
  | "refuge"
  | "raid"
  | "altar";

export type HubStationDefinition = {
  id: HubDestinationId;
  label: string;
  kicker: string;
  x: number;
  y: number;
  radius: number;
  tint: number;
};

export const HUB_WORLD = {
  width: 1280,
  height: 720,
  spawnX: 640,
  spawnY: 420,
  interactDistance: 118,
} as const;

export const HUB_STATIONS: readonly HubStationDefinition[] = [
  { id: "expeditions", label: "Cartógrafo", kicker: "Expedições", x: 640, y: 170, radius: 72, tint: 0xd3a64d },
  { id: "loadout", label: "Forja", kicker: "Armas e relíquias", x: 330, y: 230, radius: 68, tint: 0xb96d45 },
  { id: "archive", label: "Ataques da Lenda", kicker: "2 poderes próprios", x: 500, y: 438, radius: 68, tint: 0x6a8fc1 },
  { id: "collection", label: "Bestiário", kicker: "Monstros e chefes", x: 950, y: 230, radius: 68, tint: 0x7d6cc2 },
  { id: "avatar", label: "Lendas Jogáveis", kicker: "Escolher Lenda", x: 1090, y: 370, radius: 68, tint: 0xc18254 },
  { id: "merchant", label: "Mercador", kicker: "Empório de Aurória", x: 830, y: 448, radius: 68, tint: 0xc17e48 },
  { id: "refuge", label: "Refúgio", kicker: "Casa do Cartógrafo", x: 270, y: 500, radius: 68, tint: 0x6f9b69 },
  { id: "raid", label: "Eventos", kicker: "Raids semanais", x: 1010, y: 500, radius: 72, tint: 0xa95478 },
  { id: "altar", label: "Altar Mítico", kicker: "Boss semanal", x: 820, y: 590, radius: 64, tint: 0x5d85ad },
  { id: "portal", label: "Portal das Expedições", kicker: "Mata Encantada", x: 640, y: 650, radius: 60, tint: 0x69b6a4 },
] as const;

export function findNearestHubStation(
  x: number,
  y: number,
  maxDistance = HUB_WORLD.interactDistance,
) {
  let nearest: HubStationDefinition | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const station of HUB_STATIONS) {
    const distance = Math.hypot(station.x - x, station.y - y);
    if (distance <= maxDistance && distance < nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function buildHubNavigation() {
  return buildGridNavigationFromBounds({
    width: HUB_WORLD.width,
    height: HUB_WORLD.height,
    tileSize: 32,
    originX: 16,
    originY: 16,
    isWalkable: (point) => HUB_STATIONS.every((station) =>
      Math.abs(point.x - station.x) > 107 || Math.abs(point.y - station.y) > 68
    ),
  });
}
