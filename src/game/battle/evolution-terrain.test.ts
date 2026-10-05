import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "../save/local-progress";
import { createDemoBattle, getSide, passTurn, resolveAbility } from "./engine";

const fixedRandom = () => 0.12;
const abilities = ["boitata-flame", "ancestral-roots"] as const;

function battle() {
  return createDemoBattle("terrain-test", fixedRandom, DEFAULT_AVATAR_CONFIG, abilities);
}

describe("terreno da batalha por avatar", () => {
  it("um crítico de um dos poderes ativa o terreno do seu elemento", () => {
    const result = resolveAbility(battle(), "player-one", 0, 6, 100, "critical");

    expect(result.state.terrain).toMatchObject({
      element: "fire",
      sourceSideId: "player-one",
      activatedTurn: 1,
      expiresAfterTurn: 4,
    });
    expect(result.events.some((event) => event.kind === "terrain_activated")).toBe(true);
    expect(result.events.find((event) => event.kind === "critical")?.abilityId).toBe("boitata-flame");
  });

  it("o terreno do mesmo elemento aumenta o dano de forma determinística", () => {
    const base = battle();
    const withTerrain = structuredClone(base);
    withTerrain.terrain = {
      element: "fire",
      sourceSideId: "player-one",
      activatedTurn: 1,
      expiresAfterTurn: 4,
    };

    const baseResult = resolveAbility(base, "player-one", 0, 5, 100, "base-damage");
    const terrainResult = resolveAbility(withTerrain, "player-one", 0, 5, 100, "terrain-damage");
    const baseDamage = baseResult.events.find((event) => event.kind === "attack_hit")?.damage ?? 0;
    const terrainDamage = terrainResult.events.find((event) => event.kind === "attack_hit")?.damage ?? 0;

    expect(terrainDamage).toBeGreaterThan(baseDamage);
  });

  it("o terreno expira quando o turno ultrapassa seu limite", () => {
    let state = resolveAbility(battle(), "player-one", 0, 6, 100, "terrain-start").state;
    const expiryEvents = [] as ReturnType<typeof passTurn>["events"];

    for (let index = 0; index < 3; index += 1) {
      const result = passTurn(state, state.turn.sideId, `pass-${index + 1}`);
      state = result.state;
      expiryEvents.push(...result.events);
    }

    expect(state.turn.number).toBe(5);
    expect(state.terrain).toBeUndefined();
    expect(expiryEvents.some((event) => event.kind === "terrain_expired")).toBe(true);
    expect(getSide(state, "player-one").abilityIds).toEqual(abilities);
  });
});
