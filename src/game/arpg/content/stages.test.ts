import { describe, expect, it } from "vitest";
import { generateDungeon } from "../dungeon/generator";
import { getExpeditionStages, getRoomStage } from "./stages";
import type { ArpgExpeditionId } from "./expeditions";

describe("expedition stages (Opção A: fases sequenciais de mundo)", () => {
  const regions: ArpgExpeditionId[] = [
    "mata-encantada",
    "arquipelago-das-mares",
    "montanhas-runicas",
  ];

  it.each(regions)("possui 3 zonas sequenciais mais a arena do boss para %s", (regionId) => {
    const stages = getExpeditionStages(regionId);
    expect(stages).toHaveLength(4);
    expect(stages[0].index).toBe(1);
    expect(stages[1].index).toBe(2);
    expect(stages[2].index).toBe(3);
    expect(stages[3].index).toBe(4);
    expect(stages[0].total).toBe(3);
    expect(stages[3].badge).toBe("Confronto Final");
  });

  it.each(regions)("atribui cada sala da dungeon a uma zona de forma coerente e determinística em %s", (regionId) => {
    for (let i = 0; i < 20; i++) {
      const graph = generateDungeon({ seed: `stage-test-${regionId}-${i}`, regionId });
      const bossStage = getRoomStage(graph, graph.bossRoomId);
      expect(bossStage.index).toBe(4);
      expect(bossStage.badge).toBe("Confronto Final");

      const startStage = getRoomStage(graph, graph.startRoomId);
      expect(startStage.index).toBe(1);

      const ordinaryRooms = Object.values(graph.rooms).filter((r) => r.id !== graph.bossRoomId);
      const stageIndices = new Set(ordinaryRooms.map((r) => getRoomStage(graph, r.id).index));

      // Each generated dungeon with 8-12 rooms should span all 3 zones
      expect(stageIndices.has(1)).toBe(true);
      expect(stageIndices.has(2)).toBe(true);
      expect(stageIndices.has(3)).toBe(true);
      expect(stageIndices.has(4)).toBe(false); // Only boss has stage 4
    }
  });

  it("produz a mesma distribuição de fases para a mesma seed", () => {
    const graphA = generateDungeon({ seed: "deterministic-stage-seed", regionId: "mata-encantada" });
    const graphB = generateDungeon({ seed: "deterministic-stage-seed", regionId: "mata-encantada" });
    for (const roomId of Object.keys(graphA.rooms)) {
      expect(getRoomStage(graphA, roomId)).toEqual(getRoomStage(graphB, roomId));
    }
  });
});
