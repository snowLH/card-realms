import { describe, expect, it } from "vitest";
import { arthurProtectedDamage, emptyArthurOaths, grantRoundTableWard } from "./playable-kit";
import { DEFAULT_ARPG_LOADOUT } from "../../content/mata-encantada";
import { ARPG_ROC_RAID_BOSS } from "../../raid/content";
import { createArpgRaidState, applyArpgRaidAction } from "../../raid/engine";
import { ArpgRaidStateSchema } from "../../raid/schema";

describe("restored Arthur's playable oath kit", () => {
  it("grants critical-life resistance for four seconds with a persistent 45-second cooldown", () => {
    const memory = emptyArthurOaths(), point = { x: 300, y: 300 };
    expect(arthurProtectedDamage(memory, 20, 120, 120, 1000, point, true)).toBe(20);
    expect(arthurProtectedDamage(memory, 20, 40, 120, 2000, point, true)).toBe(13);
    const resumed = JSON.parse(JSON.stringify(memory));
    expect(arthurProtectedDamage(resumed, 20, 25, 120, 7000, point, true)).toBe(20);
    expect(arthurProtectedDamage(resumed, 20, 25, 120, 47000, point, true)).toBe(13);
    expect(arthurProtectedDamage(emptyArthurOaths(), 20, 25, 120, 2000, point, false)).toBe(20);
  });
  it("protects only inside the five-second Round Table area", () => {
    const memory = emptyArthurOaths(); grantRoundTableWard(memory, { x: 100, y: 100 }, 1000);
    expect(arthurProtectedDamage(memory, 20, 100, 120, 2000, { x: 200, y: 100 }, false)).toBe(15);
    expect(arthurProtectedDamage(memory, 20, 100, 120, 2000, { x: 400, y: 100 }, false)).toBe(20);
    expect(arthurProtectedDamage(memory, 20, 100, 120, 6000, { x: 100, y: 100 }, false)).toBe(20);
  });
  it("heals nearby co-op allies, persists their ward, and cannot duplicate a cast", () => {
    const raid = createArpgRaidState("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", [0, 1].map((seat) => ({ id: "33333333-3333-4333-8333-33333333333" + seat, name: "Lenda " + seat, seat: seat + 1, loadout: { ...structuredClone(DEFAULT_ARPG_LOADOUT), abilityIds: seat ? DEFAULT_ARPG_LOADOUT.abilityIds : ["arthur-camelot-cut", "arthur-round-table-oath"] } })), ARPG_ROC_RAID_BOSS, 1000);
    raid.players[1].x = raid.players[0].x + 50; raid.players[1].y = raid.players[0].y; raid.players[1].hp = 60;
    const action = { kind: "ability" as const, slot: 1 as const, actionId: "oath" };
    const result = applyArpgRaidAction(raid, raid.players[0].id, action, 1000).state;
    expect(result.players[1].hp).toBeGreaterThan(60);
    expect(result.players[1].arthurOaths?.ward?.expiresAtMs).toBe(6000);
    expect(ArpgRaidStateSchema.parse(JSON.parse(JSON.stringify(result))).players[1].arthurOaths).toEqual(result.players[1].arthurOaths);
    expect(applyArpgRaidAction(result, raid.players[0].id, action, 1000).state.players[1].hp).toBe(result.players[1].hp);
  });
});
