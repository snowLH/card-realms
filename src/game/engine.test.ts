import { describe, expect, it } from "vitest";
import {
  GameRuleError,
  acquireEnergy,
  attachEnergy,
  createDemoBattle,
  getActive,
  getSide,
  resolveAttack,
  switchActiveCreature,
} from "./engine";

describe("motor de combate Card Realms", () => {
  it("mantém exatamente seis cartas de criaturas em cada lado", () => {
    const state = createDemoBattle("six-card-team");
    expect(state.sides[0].team).toHaveLength(6);
    expect(state.sides[1].team).toHaveLength(6);
  });

  it("permite adquirir no máximo duas energias escolhidas por turno", () => {
    let state = createDemoBattle("energy-choice");
    state = acquireEnergy(state, "player-one", ["fire", "shadow"], "a1").state;
    expect(getSide(state, "player-one").energyAvailable.fire).toBe(3);
    expect(getSide(state, "player-one").energyReserve.shadow).toBe(3);
    expect(() => acquireEnergy(state, "player-one", ["water"], "a2")).toThrow(GameRuleError);
  });

  it("consome a energia mesmo quando o dado causa falha", () => {
    let state = createDemoBattle("failed-roll");
    state = attachEnergy(state, "player-one", 0, "fire", "a1").state;
    const attack = "ignavora-1";
    state = resolveAttack(state, "player-one", attack, 1, "a2").state;
    expect(getActive(getSide(state, "player-one")).attachedEnergy.fire).toBe(0);
    expect(getSide(state, "player-one").discard.fire).toBe(1);
    expect(getActive(getSide(state, "warden-aya")).hp).toBe(
      getActive(getSide(state, "warden-aya")).maxHp,
    );
  });

  it("aplica multiplicador de crítico no resultado seis", () => {
    let state = createDemoBattle("critical-roll");
    state = attachEnergy(state, "player-one", 0, "fire", "a1").state;
    const before = getActive(getSide(state, "warden-aya")).hp;
    const result = resolveAttack(state, "player-one", "ignavora-1", 6, "a2");
    const after = getActive(getSide(result.state, "warden-aya")).hp;
    expect(before - after).toBeGreaterThan(25);
    expect(result.events[0].kind).toBe("critical");
  });

  it("impede cartas derrotadas de voltarem ao campo", () => {
    const state = createDemoBattle("defeated-switch");
    state.sides[0].team[1].defeated = true;
    state.sides[0].team[1].hp = 0;
    expect(() => switchActiveCreature(state, "player-one", 1, "a1")).toThrow(GameRuleError);
  });

  it("rejeita uma ação idempotente já processada", () => {
    const state = createDemoBattle("idempotency");
    const result = attachEnergy(state, "player-one", 0, "fire", "same-action");
    expect(() =>
      acquireEnergy(result.state, "player-one", ["fire"], "same-action"),
    ).toThrow(GameRuleError);
  });
});
