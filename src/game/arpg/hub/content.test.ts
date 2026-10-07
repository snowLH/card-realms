import { describe, expect, it } from "vitest";
import { buildHubNavigation, HUB_STATIONS, HUB_WORLD, findNearestHubStation } from "./content";
import { findGridPath } from "../navigation/grid-path";

describe("HUB físico do Card Realms", () => {
  it("mantém dez destinos físicos únicos dentro da Guilda", () => {
    expect(HUB_STATIONS).toHaveLength(10);
    expect(new Set(HUB_STATIONS.map((station) => station.id)).size).toBe(10);
    for (const station of HUB_STATIONS) {
      expect(station.x).toBeGreaterThan(station.radius);
      expect(station.x).toBeLessThan(HUB_WORLD.width - station.radius);
      expect(station.y).toBeGreaterThan(station.radius);
      expect(station.y).toBeLessThan(HUB_WORLD.height - station.radius);
    }
  });

  it("expõe as estações de preparação, conhecimento e exploração sem depender do dashboard", () => {
    expect(HUB_STATIONS.map((station) => station.id).sort()).toEqual([
      "altar", "archive", "avatar", "collection", "expeditions", "loadout", "merchant", "portal", "raid", "refuge",
    ]);
    expect(HUB_STATIONS.find((station) => station.id === "altar")).toMatchObject({
      label: "Altar Mítico",
      kicker: "Boss semanal",
    });
    expect(HUB_STATIONS.find((station) => station.id === "raid")).toMatchObject({
      label: "Eventos",
      kicker: "Raids semanais",
    });
    expect(HUB_STATIONS.find((station) => station.id === "avatar")).toMatchObject({
      label: "Lendas Jogáveis",
      kicker: "Escolher Lenda",
    });
    expect(HUB_STATIONS.find((station) => station.id === "refuge")).toMatchObject({
      label: "Refúgio",
      kicker: "Casa do Cartógrafo",
    });
    expect(HUB_STATIONS.some((station) => station.label.includes("Santuário"))).toBe(false);
  });

  it("só permite interação quando o jogador está perto da estação", () => {
    const arsenal = HUB_STATIONS.find((station) => station.id === "loadout")!;
    expect(findNearestHubStation(arsenal.x, arsenal.y)?.id).toBe("loadout");
    expect(findNearestHubStation(HUB_WORLD.spawnX, HUB_WORLD.spawnY)).toBeNull();
  });

  it("gera rota até cada estação sem atravessar os props", () => {
    const navigation = buildHubNavigation();
    for (const station of HUB_STATIONS) {
      const path = findGridPath(navigation, { x: HUB_WORLD.spawnX, y: HUB_WORLD.spawnY }, station);
      expect(path, `rota até ${station.id}`).not.toBeNull();
      const finalPoint = path!.at(-1)!;
      expect(Math.hypot(finalPoint.x - station.x, finalPoint.y - station.y)).toBeLessThanOrEqual(HUB_WORLD.interactDistance);
      for (const point of path!) {
        const overlapsStation = HUB_STATIONS.some((obstacle) =>
          Math.abs(point.x - obstacle.x) <= 107 && Math.abs(point.y - obstacle.y) <= 68
        );
        expect(overlapsStation).toBe(false);
      }
    }
  });
});
