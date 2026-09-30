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

  it("sincroniza Evolução e Terreno sem revelar recursos ocultos", () => {
    const state = createPvpBattle(
      "00000000-0000-4000-8000-000000000001",
      { id: "player-a", name: "Ana", teamIds: firstTeam },
      { id: "player-b", name: "Beto", teamIds: secondTeam },
      () => 0.25,
    );
    state.sides[0].team[0].evolutionStage = 1;
    state.terrain = {
      element: "fire",
      sourceSideId: "player-a",
      activatedTurn: 2,
      expiresAfterTurn: 5,
    };

    const visible = visiblePvpState(state, "player-b");

    expect(visible.state.sides[0].team[0].evolutionStage).toBe(1);
    expect(visible.state.terrain).toEqual(state.terrain);
    expect(visible.state.sides[0].energyHand).toEqual([]);
    expect(visible.state.sides[0].energyDeck).toEqual([]);
  });

  it("remove tokens internos de replay e IDs derivados da resposta serializada", () => {
    const state = createPvpBattle(
      "00000000-0000-4000-8000-000000000001",
      { id: "player-a", name: "Ana", teamIds: firstTeam },
      { id: "player-b", name: "Beto", teamIds: secondTeam },
      () => 0.25,
    );
    state.processedActionIds = ["private-action-token"];
    state.log[0].id = "private-action-token:0";

    const visible = visiblePvpState(state, "player-a");
    const serialized = JSON.stringify(visible);

    expect(visible.state.processedActionIds).toEqual([]);
    expect(serialized).not.toContain("private-action-token");
    expect(state.processedActionIds).toEqual(["private-action-token"]);
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
