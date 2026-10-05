import { describe, expect, it, vi } from "vitest";
import type { ArpgDungeonCombatCommand, ArpgDungeonCombatState } from "../dungeon/combat-authority";
import { ArpgBridge } from "./bridge";
import { acceptServerConfirmedCombatResponse } from "./visual-events";

function combatState(): ArpgDungeonCombatState {
  return {
    roomId: "room-1",
    status: "combat",
    waveIndex: 0,
    serverTimeMs: 1_000,
    playerX: 80,
    playerY: 96,
    playerHp: 100,
    maxHp: 100,
    attackCount: 0,
    nextAttackAtMs: 1_000,
    nextAbilityAtMs: { "roots-ancestral": 1_000 },
    enemies: [{
      id: "room-1:0:0",
      definitionId: "sprout",
      waveIndex: 0,
      x: 128,
      y: 96,
      hp: 20,
      maxHp: 20,
      alive: true,
      rootedUntilMs: 0,
      nextContactAtMs: 9_999,
      nextShotAtMs: 0,
      shotCount: 0,
      bossPhase: 1,
      bossPatternIndex: 0,
      nextPatternAtMs: 0,
      bossPattern: null,
    }],
  } as unknown as ArpgDungeonCombatState;
}

const attackCommand: ArpgDungeonCombatCommand = {
  actionId: "room-1:attack-1",
  kind: "basic_attack",
  playerX: 80,
  playerY: 96,
  aimX: 1,
  aimY: 0,
};

describe("server-confirmed ARPG visual events", () => {
  it("does not call hit or victory hooks when the combat API rejects an action", async () => {
    const bridge = new ArpgBridge();
    const onAttackHit = vi.fn();
    const onBattleVictory = vi.fn();
    const applyState = vi.fn();
    bridge.onAttackHit(onAttackHit);
    bridge.onBattleVictory(onBattleVictory);

    await expect(acceptServerConfirmedCombatResponse({
      request: () => Promise.reject(new Error("API recusou a ação")),
      isSceneActive: () => true,
      getPreviousState: combatState,
      command: attackCommand,
      applyState,
      emit: (event) => bridge.emitVisualEvent(event),
    })).rejects.toThrow("API recusou a ação");

    expect(applyState).not.toHaveBeenCalled();
    expect(onAttackHit).not.toHaveBeenCalled();
    expect(onBattleVictory).not.toHaveBeenCalled();
  });

  it("does not emit hooks for a null response or an inactive scene", async () => {
    const bridge = new ArpgBridge();
    const onAttackHit = vi.fn();
    const onBattleVictory = vi.fn();
    const applyState = vi.fn();
    bridge.onAttackHit(onAttackHit);
    bridge.onBattleVictory(onBattleVictory);

    const options = {
      isSceneActive: () => true,
      getPreviousState: combatState,
      command: attackCommand,
      applyState,
      emit: (event: Parameters<typeof bridge.emitVisualEvent>[0]) => bridge.emitVisualEvent(event),
    };
    await expect(acceptServerConfirmedCombatResponse({ ...options, request: async () => null })).resolves.toBeNull();
    await expect(acceptServerConfirmedCombatResponse({
      ...options,
      request: async () => ({ state: combatState(), revision: 4 }),
      isSceneActive: () => false,
    })).resolves.toBeNull();

    expect(applyState).not.toHaveBeenCalled();
    expect(onAttackHit).not.toHaveBeenCalled();
    expect(onBattleVictory).not.toHaveBeenCalled();
  });

  it("emits hit and victory hooks after applying an accepted server state", async () => {
    const bridge = new ArpgBridge();
    const onAttackHit = vi.fn();
    const onBattleVictory = vi.fn();
    const applied: string[] = [];
    bridge.onAttackHit((event) => {
      applied.push("hit");
      onAttackHit(event);
    });
    bridge.onBattleVictory((event) => {
      applied.push("victory");
      onBattleVictory(event);
    });
    const previous = combatState();
    const next = {
      ...previous,
      status: "victory",
      attackCount: 1,
      enemies: [{ ...previous.enemies[0]!, hp: 0, alive: false }],
    } as ArpgDungeonCombatState;

    await acceptServerConfirmedCombatResponse({
      request: async () => ({ state: next, revision: 9 }),
      isSceneActive: () => true,
      getPreviousState: () => previous,
      command: attackCommand,
      worldOrigin: { x: 320, y: 160 },
      applyState: () => applied.push("state"),
      emit: (event) => bridge.emitVisualEvent(event),
    });

    expect(applied).toEqual(["state", "hit", "victory"]);
    expect(onAttackHit).toHaveBeenCalledWith(expect.objectContaining({
      source: "server-confirmed",
      actionId: attackCommand.actionId,
      revision: 9,
      targetId: "room-1:0:0",
      position: { x: 448, y: 256 },
      damage: 20,
      defeated: true,
    }));
    expect(onBattleVictory).toHaveBeenCalledWith(expect.objectContaining({
      source: "server-confirmed",
      actionId: attackCommand.actionId,
      revision: 9,
      outcome: "victory",
    }));
  });

  it("emits a power cast only when the accepted state advances that power cooldown", async () => {
    const bridge = new ArpgBridge();
    const onVisualEvent = vi.fn();
    bridge.onVisualEvent(onVisualEvent);
    const previous = combatState();
    const next = {
      ...previous,
      serverTimeMs: 1_100,
      nextAbilityAtMs: { "roots-ancestral": 6_100 },
    } as ArpgDungeonCombatState;

    await acceptServerConfirmedCombatResponse({
      request: async () => ({ state: next, revision: 10 }),
      isSceneActive: () => true,
      getPreviousState: () => previous,
      command: { ...attackCommand, actionId: "room-1:power-1", kind: "ability", abilitySlot: 0 },
      abilityId: "roots-ancestral",
      applyState: () => undefined,
      emit: (event) => bridge.emitVisualEvent(event),
    });

    expect(onVisualEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "power.cast",
      source: "server-confirmed",
      powerId: "roots-ancestral",
      slot: 0,
      revision: 10,
    }));
  });
});
