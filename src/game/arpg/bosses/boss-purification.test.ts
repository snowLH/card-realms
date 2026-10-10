import { describe, expect, it } from "vitest";
import { createBossEncounter, advanceBossEncounter, damageBossEncounter, confirmBossRestoration } from "./boss-encounter-controller";
import { createArpgDungeonCombatState, applyArpgDungeonCombatCommand, ArpgDungeonCombatStateSchema } from "../dungeon/combat-authority";
import { generateDungeon } from "../dungeon/generator";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
describe("zero HP means purification, not death", () => {
  it("keeps the authority enemy alive at zero HP and withholds room victory", () => {
    const graph = generateDungeon({ seed: "purification-authority", regionId: "montanhas-runicas" });
    const state = createArpgDungeonCombatState({ graph, roomId: graph.bossRoomId, loadout: DEFAULT_ARPG_LOADOUT, playerHp: 120, maxHp: 120, playerX: 976, playerY: 850, runMoveSpeedBonus: 0, runBasicDamageMultiplier: 1, xpMultiplier: 1, baseXpEarned: 0, baseRunShards: 0, nowMs: 1000 });
    const boss = state.bossEncounter!;
    advanceBossEncounter(boss, 8000, [{ id: "solo", x: 976, y: 850, alive: true }], { width: 1952, height: 992 });
    damageBossEncounter(boss, 99999, 8100);
    state.serverTimeMs = 8100; state.enemies[0].hp = 0;
    let current = ArpgDungeonCombatStateSchema.parse(state);
    for (const at of [9300, 11300, 13300, 15300, 15800]) {
      current = applyArpgDungeonCombatCommand({ state: current, graph, loadout: DEFAULT_ARPG_LOADOUT, nowMs: at, command: { actionId: String(at), kind: "sync", playerX: 976, playerY: 850, aimX: 0, aimY: -1 } });
      expect(current.status).toBe("combat"); expect(current.enemies[0].alive).toBe(true);
      expect(current.xpEarned).toBe(0); expect(current.runShards).toBe(0);
    }
    expect(current.bossEncounter?.state).toBe("RESTORED");
    expect(current.enemies[0].hp).toBe(0);
  });
  it("resumes purification without restarting or granting another reward", () => {
    const boss = createBossEncounter("king-arthur", 0, ["solo"], 100, { x: 976, y: 144 });
    const players = [{ id: "solo", x: 976, y: 850, alive: true }], arena = { width: 1952, height: 992 };
    advanceBossEncounter(boss, 7000, players, arena); damageBossEncounter(boss, 100, 7100);
    advanceBossEncounter(boss, 9000, players, arena);
    const resumed = JSON.parse(JSON.stringify(boss));
    advanceBossEncounter(resumed, 14800, players, arena);
    expect(resumed.state).toBe("RESTORED"); expect(damageBossEncounter(resumed, 100, 14800)).toBe(0);
    confirmBossRestoration(resumed, "king-arthur", true, 14800);
    confirmBossRestoration(resumed, "king-arthur", true, 14801);
    expect(resumed.state).toBe("CLEARED");
  });
});
