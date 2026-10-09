import { describe, expect, it } from "vitest";
import { populateArpgDungeonContent } from "./content";
import { generateDungeon } from "./generator";
import { computeRoomDistances, validateDungeonGraph } from "./graph";
import { buildDungeonPixelLayout } from "./layout";
import { buildDungeonNavigation } from "./navigation";
import { DungeonManager } from "./manager";
import { CombatRoomController } from "./room-controller";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_FLOOR_TILE, ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WALL_TILE, ROOM_WATER_TILE } from "./room-tilemap";
import { createRunLootAssignments, rollCombatRoomCache } from "./rewards";
import { MARES_ROOM_TEMPLATES, MATA_ROOM_TEMPLATES, RUNIC_ROOM_TEMPLATES } from "./templates";
import { findGridPath, gridCellKey, worldToGridCell } from "../navigation/grid-path";

function signature(seed: string) {
  const graph = generateDungeon({ seed });
  return Object.values(graph.rooms)
    .map((room) => `${room.id}:${room.gridX},${room.gridY}:${room.type}:${room.templateId}`)
    .sort();
}

describe("dungeon procedural do Card Realms", () => {
  it("é determinística para a mesma seed", () => {
    expect(signature("mata-debug-42")).toEqual(signature("mata-debug-42"));
  });

  it("mantém o catálogo mínimo de templates da Mata", () => {
    expect(MATA_ROOM_TEMPLATES.filter((item) => item.type === "combat")).toHaveLength(5);
    expect(MATA_ROOM_TEMPLATES.some((item) => item.type === "treasure")).toBe(true);
    expect(MATA_ROOM_TEMPLATES.some((item) => item.type === "event")).toBe(true);
    expect(MATA_ROOM_TEMPLATES.some((item) => item.type === "elite")).toBe(true);
    expect(MATA_ROOM_TEMPLATES.some((item) => item.type === "boss")).toBe(true);
  });

  it("gera o Arquipélago com templates e ondas aquáticas próprias", () => {
    expect(MARES_ROOM_TEMPLATES.filter((item) => item.type === "combat")).toHaveLength(5);
    const graph = populateArpgDungeonContent(generateDungeon({
      seed: "mares-procedural",
      regionId: "arquipelago-das-mares",
    }));
    const rooms = Object.values(graph.rooms);
    expect(rooms.every((room) => room.templateId.startsWith("mares-"))).toBe(true);
    expect(graph.regionId).toBe("arquipelago-das-mares");
    expect(graph.rooms[graph.bossRoomId].waves).toEqual([["boss"]]);
    expect(rooms.filter((room) => room.type === "elite")[0].waves.flat()).toContain("miniBoss");
    expect(() => buildDungeonPixelLayout(graph)).not.toThrow();
  });

  it("gera as Montanhas Rúnicas com templates, piso e ondas próprios", () => {
    expect(RUNIC_ROOM_TEMPLATES.filter((item) => item.type === "combat")).toHaveLength(5);
    const graph = populateArpgDungeonContent(generateDungeon({
      seed: "runic-procedural",
      regionId: "montanhas-runicas",
    }));
    const rooms = Object.values(graph.rooms);
    expect(rooms.every((room) => room.templateId.startsWith("runic-"))).toBe(true);
    expect(graph.regionId).toBe("montanhas-runicas");
    expect(graph.rooms[graph.bossRoomId].templateId).toBe("runic-boss-summit-arena");
    expect(graph.rooms[graph.bossRoomId].waves).toEqual([["boss"]]);
    expect(rooms.find((room) => room.type === "elite")?.waves.flat()).toContain("miniBoss");
    expect(buildRoomTileData("runic-combat-rune-ruins-a", {}, graph.seed).data.flat()).toContain(ROOM_RUNE_TILE);
    expect(() => buildDungeonPixelLayout(graph)).not.toThrow();
  });

  it("mantém templates e spawns válidos em 250 seeds das Montanhas", () => {
    for (let index = 0; index < 250; index += 1) {
      const graph = generateDungeon({ seed: `runic-stress-${index}`, regionId: "montanhas-runicas" });
      expect(validateDungeonGraph(graph).errors, `seed runic-stress-${index}`).toEqual([]);
      for (const room of Object.values(graph.rooms)) {
        expect(room.templateId, `${room.id} em runic-stress-${index}`).toMatch(/^runic-/);
        const tileData = buildRoomTileData(room.templateId, room.connections, graph.seed);
        const spawns = createSafeRoomSpawnPoints(tileData, room.type === "boss" ? 14 : 4);
        expect(spawns).toHaveLength(room.type === "boss" ? 14 : 4);
        for (const spawn of spawns) {
          const tile = tileData.data[Math.floor(spawn.y / 32)]?.[Math.floor(spawn.x / 32)];
          expect(tile).not.toBe(ROOM_WALL_TILE);
          expect(tile).not.toBe(ROOM_OBSTACLE_TILE);
        }
      }
    }
  }, 20_000);

  it("encontra um caminho caminhável do início ao boss em cada bioma", () => {
    const regions = ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const;
    for (const regionId of regions) {
      for (let index = 0; index < 40; index += 1) {
        const graph = generateDungeon({ seed: `click-path-${regionId}-${index}`, regionId });
        const layout = buildDungeonPixelLayout(graph);
        const navigation = buildDungeonNavigation(graph, layout);
        const start = layout.rooms[graph.startRoomId];
        const boss = layout.rooms[graph.bossRoomId];
        const path = findGridPath(
          navigation,
          { x: start.centerX, y: start.centerY },
          { x: boss.centerX, y: boss.centerY },
        );
        expect(path, `rota ${regionId} seed ${index}`).not.toBeNull();
        for (let pointIndex = 0; pointIndex < path!.length; pointIndex += 1) {
          const cell = worldToGridCell(path![pointIndex], navigation);
          expect(navigation.walkable.has(gridCellKey(cell.x, cell.y))).toBe(true);
          if (pointIndex === 0) continue;
          const previous = path![pointIndex - 1];
          expect(Math.abs(path![pointIndex].x - previous.x) + Math.abs(path![pointIndex].y - previous.y)).toBe(32);
        }
      }
    }
  });

  it("valida mil seeds sem sobreposição, salas inacessíveis ou portas para vazio", () => {
    for (let index = 0; index < 1000; index += 1) {
      const graph = generateDungeon({ seed: `stress-${index}` });
      const rooms = Object.values(graph.rooms);
      const lootAssignments = createRunLootAssignments(graph);
      const validation = validateDungeonGraph(graph);
      expect(validation.errors, `seed stress-${index}`).toEqual([]);
      expect(rooms.length).toBeGreaterThanOrEqual(8);
      expect(rooms.length).toBeLessThanOrEqual(12);
      expect(rooms.filter((room) => room.type === "start")).toHaveLength(1);
      expect(rooms.filter((room) => room.type === "boss")).toHaveLength(1);
      expect(Object.values(lootAssignments).sort()).toEqual([0, 1, 2, 3]);
      expect(rooms.some((room) => room.type === "treasure")).toBe(true);
      expect(rooms.some((room) => room.type === "elite")).toBe(true);
      expect(rooms.filter((room) => room.type === "event")).toHaveLength(1);
      expect(rooms.filter((room) => room.type === "rest")).toHaveLength(1);
      expect(rooms.filter((room) => room.type === "shop")).toHaveLength(1);
      expect(rooms.some((room) => room.type === "combat")).toBe(true);
      expect(new Set(rooms.map((room) => `${room.gridX},${room.gridY}`)).size).toBe(rooms.length);
      const distances = computeRoomDistances(graph);
      expect(distances.size).toBe(rooms.length);
      expect(distances.get(graph.bossRoomId)).toBeGreaterThanOrEqual(4);
    }
  });

  it("converte o grafo em salas físicas e corredores sem sobreposição", () => {
    const graph = generateDungeon({ seed: "physical-layout" });
    const layout = buildDungeonPixelLayout(graph);
    expect(Object.keys(layout.rooms)).toHaveLength(Object.keys(graph.rooms).length);
    expect(layout.corridors).toHaveLength(Object.keys(graph.rooms).length - 1);
    expect(layout.width).toBeGreaterThan(1280);
    expect(layout.height).toBeGreaterThan(720);
    const roomLayouts = Object.values(layout.rooms);
    for (let index = 0; index < roomLayouts.length; index += 1) {
      for (let other = index + 1; other < roomLayouts.length; other += 1) {
        const a = roomLayouts[index];
        const b = roomLayouts[other];
        const overlap = a.left < b.left + b.width && a.left + a.width > b.left
          && a.top < b.top + b.height && a.top + a.height > b.top;
        expect(overlap).toBe(false);
      }
    }
  });

  it("gera tilemap modular com paredes e aberturas apenas nas portas conectadas", () => {
    const graph = generateDungeon({ seed: "tilemap-test" });
    const room = graph.rooms[graph.startRoomId];
    const tiles = buildRoomTileData(room.templateId, room.connections);
    expect(tiles.data[0][0]).toBe(ROOM_WALL_TILE);
    expect(tiles.data[1][1]).toBe(ROOM_FLOOR_TILE);
    if (room.connections.east) {
      expect(tiles.data[Math.floor(tiles.height / 2)][tiles.width - 1]).toBe(ROOM_FLOOR_TILE);
    }
    if (!room.connections.west) {
      expect(tiles.data[Math.floor(tiles.height / 2)][0]).toBe(ROOM_WALL_TILE);
    }
  });

  it("dá forma própria ao tilemap e mantém spawn em piso caminhável", () => {
    const waterTiles = buildRoomTileData("mata-combat-river", {}, "safe-spawn-test");
    const tiles = buildRoomTileData("mata-combat-ruins-a", {}, "safe-spawn-test");
    expect(waterTiles.data.flat()).toContain(ROOM_WATER_TILE);
    expect(tiles.data.flat()).toContain(ROOM_OBSTACLE_TILE);

    const spawns = createSafeRoomSpawnPoints(tiles, 14);
    expect(spawns).toHaveLength(14);
    for (const point of spawns) {
      const tile = tiles.data[Math.floor(point.y / 32)]?.[Math.floor(point.x / 32)];
      expect(tile).not.toBe(ROOM_WALL_TILE);
      expect(tile).not.toBe(ROOM_OBSTACLE_TILE);
    }
  });

  it("reserva as quatro recompensas assinadas e torna caches de combate reproduzíveis", () => {
    const graph = populateArpgDungeonContent(generateDungeon({ seed: "reward-assignment" }));
    const assignment = createRunLootAssignments(graph);
    expect(Object.values(assignment).sort()).toEqual([0, 1, 2, 3]);
    expect(graph.rooms[Object.entries(assignment).find(([, index]) => index === 0)![0]].type).toBe("treasure");
    expect(graph.rooms[Object.entries(assignment).find(([, index]) => index === 1)![0]].type).toBe("elite");
    expect(graph.rooms[Object.entries(assignment).find(([, index]) => index === 3)![0]].type).toBe("boss");
    expect(rollCombatRoomCache(graph.seed, "room-2")).toEqual(rollCombatRoomCache(graph.seed, "room-2"));
  });

  it("descobre vizinhos e mantém sala limpa ao retornar", () => {
    const manager = new DungeonManager(generateDungeon({ seed: "manager-test" }));
    const start = manager.getCurrentRoom();
    const neighborId = Object.values(start.connections).find(Boolean)!;
    expect(manager.getRoom(neighborId).state).toBe("discovered");
    manager.enterRoom(neighborId);
    manager.startCombat();
    manager.clearRoom();
    expect(manager.getCurrentRoom().state).toBe("cleared");
    manager.enterRoom(start.id);
    manager.enterRoom(neighborId);
    expect(manager.getCurrentRoom().state).toBe("cleared");
  });

  it("persiste visitas às salas mesmo depois de sair delas", () => {
    const manager = new DungeonManager(generateDungeon({ seed: "manager-visited-map" }));
    const start = manager.getCurrentRoom();
    const firstRoomId = Object.values(start.connections).find(Boolean)!;
    manager.enterRoom(firstRoomId);
    manager.enterRoom(start.id);

    expect(manager.getVisitedRoomIds()).toContain(firstRoomId);
    expect(manager.getRoom(firstRoomId).state).toBe("discovered");
  });

  it("controla fechamento, ondas e clear da sala de combate", () => {
    const controller = new CombatRoomController(2);
    expect(controller.enter()).toMatchObject({ state: "locked", doorsLocked: true });
    expect(controller.startNextWave(3)).toMatchObject({ state: "combat", waveIndex: 0, enemiesAlive: 3 });
    controller.enemyDefeated();
    controller.enemyDefeated();
    expect(controller.enemyDefeated()).toMatchObject({ state: "wave_complete", enemiesAlive: 0 });
    expect(controller.completeWave()).toMatchObject({ state: "locked", doorsLocked: true });
    controller.startNextWave(1);
    controller.enemyDefeated();
    expect(controller.completeWave()).toMatchObject({ state: "cleared", doorsLocked: false });
  });
});
