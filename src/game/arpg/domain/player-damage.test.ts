import { describe, expect, it } from "vitest";
import { resolveLocalPlayerHit } from "./player-damage";

const base = {
  hp: 120, runEnded: false, timeMs: 1000, nextDamageAtMs: 0,
  dashUntilMs: 0, rawDamage: 15, defense: 0,
};

describe("local player damage", () => {
  it("shares protection across overlapping ice strikes, contact and projectiles", () => {
    let state = { ...base };
    for (const rawDamage of [15, 15, 15, 24, 13]) {
      const hit = resolveLocalPlayerHit({ ...state, rawDamage });
      if (hit) state = { ...state, hp: hit.hp, nextDamageAtMs: hit.nextDamageAtMs };
    }
    expect(state.hp).toBe(105);
    expect(resolveLocalPlayerHit({ ...state, timeMs: 1259, rawDamage: 13 })).toBeNull();
    expect(resolveLocalPlayerHit({ ...state, timeMs: 1260, rawDamage: 13 }))
      .toEqual({ hp: 92, nextDamageAtMs: 1520 });
  });

  it("protects a dash through its final active instant and permits the next hit", () => {
    expect(resolveLocalPlayerHit({ ...base, dashUntilMs: 1170, timeMs: 1169 })).toBeNull();
    expect(resolveLocalPlayerHit({ ...base, dashUntilMs: 1170, timeMs: 1170 }))
      .toEqual({ hp: 105, nextDamageAtMs: 1430 });
  });

  it("applies defense and never revives or damages an ended run", () => {
    expect(resolveLocalPlayerHit({ ...base, defense: 5 })).toEqual({ hp: 110, nextDamageAtMs: 1260 });
    expect(resolveLocalPlayerHit({ ...base, defense: 30 })).toEqual({ hp: 119, nextDamageAtMs: 1260 });
    expect(resolveLocalPlayerHit({ ...base, hp: 10 })).toEqual({ hp: 0, nextDamageAtMs: 1260 });
    expect(resolveLocalPlayerHit({ ...base, hp: 0 })).toBeNull();
    expect(resolveLocalPlayerHit({ ...base, runEnded: true })).toBeNull();
  });
});
