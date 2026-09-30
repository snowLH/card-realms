import { describe, expect, it } from "vitest";
import { createDemoBattle, createEncounterBattle, getSide } from "./engine";

const fixedRandom = () => 0.417;

describe("regressões de encontro e energia", () => {
  it("uma conta com Iara e 12 Águas só recebe cartas de Água", () => {
    const state = createDemoBattle(
      "owned-energy",
      fixedRandom,
      ["iara"],
      { fire: 0, water: 12, nature: 0, storm: 0, spirit: 0 },
    );
    const player = getSide(state, "player-one");
    const cards = [...player.energyHand, ...player.energyDeck];

    expect(player.energyHand).toHaveLength(5);
    expect(player.energyDeck).toHaveLength(7);
    expect(cards).toHaveLength(12);
    expect(cards.every((card) => card.element === "water")).toBe(true);
  });

  it("um Boto encontrado permanece o adversário da batalha", () => {
    const state = createEncounterBattle(
      "boto-encounter",
      {
        mode: "wild",
        opponentId: "wild:boto-cor-de-rosa",
        opponentName: "Boto-cor-de-rosa",
        opponentTeamIds: ["boto-cor-de-rosa"],
        playerTeamIds: ["iara"],
        playerEnergy: { fire: 0, water: 12, nature: 0, storm: 0, spirit: 0 },
      },
      fixedRandom,
    );
    const opponent = getSide(state, "wild:boto-cor-de-rosa");

    expect(state.mode).toBe("wild");
    expect(opponent.name).toBe("Boto-cor-de-rosa");
    expect(opponent.team.map((card) => card.catalogId)).toEqual(["boto-cor-de-rosa"]);
  });
});
