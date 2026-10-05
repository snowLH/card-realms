import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "../save/local-progress";
import { createPvpBattle } from "../battle";
import { visiblePvpState } from "./visibility";

const firstPlayer = {
  id: "player-a",
  name: "Ana",
  avatarConfig: DEFAULT_AVATAR_CONFIG,
  abilityIds: ["boitata-flame", "ancestral-roots"] as const,
};
const secondPlayer = {
  id: "player-b",
  name: "Beto",
  avatarConfig: { ...DEFAULT_AVATAR_CONFIG, outfit: "ranger" as const },
  abilityIds: ["iara-song", "kelpie-surge"] as const,
};

function battle() {
  return createPvpBattle(
    "00000000-0000-4000-8000-000000000001",
    firstPlayer,
    secondPlayer,
    () => 0.25,
  );
}

describe("visibilidade do estado PVP", () => {
  it("oculta mão e baralho do adversário sem alterar o estado autoritativo", () => {
    const state = battle();
    const visible = visiblePvpState(state, "player-a");
    const visibleOpponent = visible.state.sides.find((side) => side.id === "player-b")!;
    const authoritativeOpponent = state.sides.find((side) => side.id === "player-b")!;

    expect(visible.hidden).toEqual({ opponentHandCount: 5, opponentDeckCount: 25 });
    expect(visibleOpponent.energyHand).toEqual([]);
    expect(visibleOpponent.energyDeck).toEqual([]);
    expect(visibleOpponent.abilityIds).toEqual(secondPlayer.abilityIds);
    expect(authoritativeOpponent.energyHand).toHaveLength(5);
    expect(authoritativeOpponent.energyDeck).toHaveLength(25);
  });

  it("sincroniza avatar, poderes e terreno sem revelar recursos ocultos", () => {
    const state = battle();
    state.sides[0].abilityCooldowns[1] = 2;
    state.terrain = {
      element: "fire",
      sourceSideId: "player-a",
      activatedTurn: 2,
      expiresAfterTurn: 5,
    };

    const visible = visiblePvpState(state, "player-b");
    const visibleOpponent = visible.state.sides.find((side) => side.id === "player-a")!;

    expect(visibleOpponent.avatarConfig).toEqual(firstPlayer.avatarConfig);
    expect(visibleOpponent.abilityIds).toEqual(firstPlayer.abilityIds);
    expect(visibleOpponent.abilityCooldowns).toEqual([0, 2]);
    expect(visible.state.terrain).toEqual(state.terrain);
    expect(visibleOpponent.energyHand).toEqual([]);
    expect(visibleOpponent.energyDeck).toEqual([]);
    expect("team" in visibleOpponent).toBe(false);
  });

  it("remove tokens internos de replay e IDs derivados da resposta serializada", () => {
    const state = battle();
    state.processedActionIds = ["private-action-token"];
    state.log[0].id = "private-action-token:0";

    const visible = visiblePvpState(state, "player-a");
    const serialized = JSON.stringify(visible);

    expect(visible.state.processedActionIds).toEqual([]);
    expect(serialized).not.toContain("private-action-token");
    expect(state.processedActionIds).toEqual(["private-action-token"]);
  });

  it("recusa projetar uma batalha para quem não participa", () => {
    expect(() => visiblePvpState(battle(), "intruso")).toThrow("não participa");
  });
});
