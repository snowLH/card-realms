import { describe, expect, it } from "vitest";
import {
  createDemoBattle,
  evolveActiveCreature,
  getSide,
  passTurn,
  resolveAttack,
} from "./engine";

const fixedRandom = () => 0.12;

function prepareAttachedEnergy(count: number) {
  const state = createDemoBattle(
    "evolution-terrain-test",
    fixedRandom,
    ["boitata"],
    { fire: 12, water: 0, nature: 0, storm: 0, spirit: 0 },
  );
  const player = getSide(state, "player-one");
  const cards = player.energyHand.splice(0, count);
  player.team[0].attachedEnergy.push(...cards);
  return state;
}

describe("evolução autoritativa", () => {
  it("consome duas energias, altera o snapshot e emite início/fim", () => {
    const state = prepareAttachedEnergy(2);
    state.turn.round = 2;
    const beforeMax = getSide(state, "player-one").team[0].maxHp;

    const result = evolveActiveCreature(state, "player-one", "evolve-action");
    const evolved = getSide(result.state, "player-one").team[0];

    expect(evolved.evolutionStage).toBe(1);
    expect(evolved.maxHp).toBeGreaterThan(beforeMax);
    expect(evolved.shield).toBe(12);
    expect(evolved.attachedEnergy).toHaveLength(0);
    expect(getSide(result.state, "player-one").energyDiscard).toHaveLength(2);
    expect(result.events.map((event) => event.kind)).toEqual([
      "evolution_started",
      "evolution_completed",
    ]);
    expect(result.state.processedActionIds).toContain("evolve-action");
  });

  it("não permite evoluir duas vezes a mesma criatura", () => {
    const state = prepareAttachedEnergy(2);
    state.turn.round = 2;
    const first = evolveActiveCreature(state, "player-one", "evolve-one");
    const evolved = getSide(first.state, "player-one").team[0];
    const extra = getSide(first.state, "player-one").energyHand.splice(0, 2);
    evolved.attachedEnergy.push(...extra);

    expect(() => evolveActiveCreature(first.state, "player-one", "evolve-two")).toThrow(
      "já evoluiu",
    );
  });
});

describe("terreno autoritativo", () => {
  it("ataque de assinatura ativa terreno por três turnos futuros", () => {
    const state = prepareAttachedEnergy(3);
    const result = resolveAttack(
      state,
      "player-one",
      "boitata-3",
      6,
      1,
      "signature-attack",
    );

    expect(result.state.terrain).toMatchObject({
      element: "fire",
      sourceSideId: "player-one",
      activatedTurn: 1,
      expiresAfterTurn: 4,
    });
    expect(result.events.some((event) => event.kind === "terrain_activated")).toBe(true);
  });

  it("terreno do mesmo elemento aumenta o dano de forma determinística", () => {
    const base = prepareAttachedEnergy(1);
    const withTerrain = structuredClone(base);
    withTerrain.terrain = {
      element: "fire",
      sourceSideId: "player-one",
      activatedTurn: 1,
      expiresAfterTurn: 4,
    };

    const baseResult = resolveAttack(
      base,
      "player-one",
      "boitata-1",
      5,
      100,
      "base-damage",
    );
    const terrainResult = resolveAttack(
      withTerrain,
      "player-one",
      "boitata-1",
      5,
      100,
      "terrain-damage",
    );

    const baseDamage = baseResult.events.find((event) => event.kind === "attack_hit")?.damage ?? 0;
    const terrainDamage = terrainResult.events.find((event) => event.kind === "attack_hit")?.damage ?? 0;
    expect(terrainDamage).toBeGreaterThan(baseDamage);
  });

  it("terreno expira por evento autoritativo no turno correto", () => {
    const state = prepareAttachedEnergy(3);
    let working = resolveAttack(
      state,
      "player-one",
      "boitata-3",
      6,
      1,
      "terrain-start",
    ).state;

    working = passTurn(working, working.turn.sideId, "pass-2").state;
    working = passTurn(working, working.turn.sideId, "pass-3").state;
    const expiry = passTurn(working, working.turn.sideId, "pass-4");

    expect(expiry.state.turn.number).toBe(5);
    expect(expiry.state.terrain).toBeUndefined();
    expect(expiry.events.some((event) => event.kind === "terrain_expired")).toBe(true);
  });
});
