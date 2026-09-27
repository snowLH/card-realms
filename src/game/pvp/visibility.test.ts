import { describe, expect, it } from "vitest";
import { createPvpBattle } from "../battle";
import { visiblePvpState } from "./visibility";

const firstTeam = [
  "boitata", "iara", "curupira", "saci-perere", "black-shuck", "boto-cor-de-rosa",
] as const;
const secondTeam = [
  "fenix", "kelpie", "caipora", "raiju", "domovoi", "carbunclo",
] as const;

describe("visibilidade do estado PVP", () => {
  it("oculta mão e baralho do adversário sem alterar o estado autoritativo", () => {
    const state = createPvpBattle(
      "00000000-0000-4000-8000-000000000001",
      { id: "player-a", name: "Ana", teamIds: firstTeam },
      { id: "player-b", name: "Beto", teamIds: secondTeam },
      () => 0.25,
    );

    const visible = visiblePvpState(state, "player-a");
    const visibleOpponent = visible.state.sides.find((side) => side.id === "player-b")!;
    const authoritativeOpponent = state.sides.find((side) => side.id === "player-b")!;

    expect(visible.hidden).toEqual({ opponentHandCount: 5, opponentDeckCount: 25 });
    expect(visibleOpponent.energyHand).toEqual([]);
    expect(visibleOpponent.energyDeck).toEqual([]);
    expect(authoritativeOpponent.energyHand).toHaveLength(5);
    expect(authoritativeOpponent.energyDeck).toHaveLength(25);
  });

  it("recusa projetar uma batalha para quem não participa", () => {
    const state = createPvpBattle(
      "00000000-0000-4000-8000-000000000001",
      { id: "player-a", name: "Ana", teamIds: firstTeam },
      { id: "player-b", name: "Beto", teamIds: secondTeam },
      () => 0.25,
    );

    expect(() => visiblePvpState(state, "intruso")).toThrow("não participa");
  });
});
