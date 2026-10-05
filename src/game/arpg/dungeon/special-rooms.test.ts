import { describe, expect, it } from "vitest";
import {
  getRunShardReward,
  getSpecialRoomEncounter,
  isWithinSpecialRoomInteractionRange,
  resolveSpecialRoomChoice,
} from "./special-rooms";

describe("salas especiais procedurais", () => {
  it("converte XP em fragmentos apenas da run", () => {
    expect(getRunShardReward(0)).toBe(1);
    expect(getRunShardReward(10)).toBe(2);
    expect(getRunShardReward(52)).toBe(10);
  });

  it("só cria escolha para descanso, evento e mercador", () => {
    expect(getSpecialRoomEncounter("mata-encantada", "combat")).toBeNull();
    expect(getSpecialRoomEncounter("mata-encantada", "rest")?.options).toHaveLength(2);
    expect(getSpecialRoomEncounter("mata-encantada", "shop")?.options).toHaveLength(3);
    expect(getSpecialRoomEncounter("mata-encantada", "event")?.options).toHaveLength(2);
  });

  it("resolve compras usando apenas fragmentos da run", () => {
    expect(resolveSpecialRoomChoice("mata-encantada", "shop-heal")).toMatchObject({
      hpDelta: 30,
      shardsDelta: -10,
    });
    expect(resolveSpecialRoomChoice("mata-encantada", "shop-power")).toMatchObject({
      shardsDelta: -16,
      basicDamageMultiplier: 1.15,
    });
  });

  it("mantém eventos temáticos diferentes entre as duas expedições", () => {
    expect(resolveSpecialRoomChoice("mata-encantada", "event-risk")).toMatchObject({
      hpDelta: -12,
      shardsDelta: 18,
    });
    expect(resolveSpecialRoomChoice("arquipelago-das-mares", "event-risk")).toMatchObject({
      hpDelta: -10,
      shardsDelta: 20,
    });
  });

  it("só permite interagir com o ponto físico da sala especial ao alcance", () => {
    expect(isWithinSpecialRoomInteractionRange(0, 0, 96, 80)).toBe(true);
    expect(isWithinSpecialRoomInteractionRange(0, 0, 129, 0)).toBe(false);
    expect(isWithinSpecialRoomInteractionRange(Number.NaN, 0, 0, 0)).toBe(false);
  });
});
