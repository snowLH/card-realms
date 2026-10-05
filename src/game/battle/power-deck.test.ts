import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "../save/local-progress";
import { createDemoBattle, getSide, resolveAbility } from "./engine";

const fixedRandom = () => 0.27;
const abilityIds = ["boitata-flame", "ancestral-roots"] as const;

describe("poderes permanentes do personagem", () => {
  it("mantém exatamente dois poderes distintos nos espaços fixos", () => {
    const state = createDemoBattle("two-powers", fixedRandom, DEFAULT_AVATAR_CONFIG, abilityIds);
    const player = getSide(state, "player-one");

    expect(player.abilityIds).toEqual(["boitata-flame", "ancestral-roots"]);
    expect(player.abilityCooldowns).toEqual([0, 0]);
    expect("powerHand" in player).toBe(false);
    expect("powerDeck" in player).toBe(false);
  });

  it("não cria batalha com menos de dois poderes, duplicatas ou IDs desconhecidos", () => {
    expect(() => createDemoBattle("one-power", fixedRandom, DEFAULT_AVATAR_CONFIG, ["boitata-flame"]))
      .toThrow("exatamente dois poderes válidos e diferentes");
    expect(() => createDemoBattle("duplicate-power", fixedRandom, DEFAULT_AVATAR_CONFIG, ["boitata-flame", "boitata-flame"]))
      .toThrow("exatamente dois poderes válidos e diferentes");
    expect(() => createDemoBattle("unknown-power", fixedRandom, DEFAULT_AVATAR_CONFIG, ["boitata-flame", "missing-power"]))
      .toThrow("exatamente dois poderes válidos e diferentes");
  });

  it("resolve somente um dos dois espaços e registra o poder usado", () => {
    const state = createDemoBattle("ability-slot", fixedRandom, DEFAULT_AVATAR_CONFIG, abilityIds);
    const result = resolveAbility(state, "player-one", 1, 5, 100, "roots");
    const player = getSide(result.state, "player-one");

    expect(result.events[0]).toMatchObject({
      kind: "ability_used",
      abilityId: "ancestral-roots",
      abilitySlot: 1,
    });
    expect(player.abilityCooldowns[1]).toBeGreaterThan(0);
    expect(() => resolveAbility(state, "player-one", 2, 5, 100, "invalid-slot"))
      .toThrow("Escolha um dos dois poderes equipados");
  });
});
