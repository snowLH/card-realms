import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "../save/local-progress";
import { createDemoBattle, createEncounterBattle, getSide } from "./engine";

const fixedRandom = () => 0.417;
const waterEnergy = { fire: 0, water: 12, nature: 0, storm: 0, spirit: 0 } as const;

describe("regressões de encontro e energia", () => {
  it("preserva apenas a Energia de Água possuída no baralho do personagem", () => {
    const state = createDemoBattle(
      "owned-energy",
      fixedRandom,
      DEFAULT_AVATAR_CONFIG,
      ["iara-song", "kelpie-surge"],
      waterEnergy,
    );
    const player = getSide(state, "player-one");
    const cards = [...player.energyHand, ...player.energyDeck];

    expect(player.energyHand).toHaveLength(5);
    expect(player.energyDeck).toHaveLength(7);
    expect(cards).toHaveLength(12);
    expect(cards.every((card) => card.element === "water")).toBe(true);
    expect(player.abilityIds).toEqual(["iara-song", "kelpie-surge"]);
  });

  it("usa uma criatura encontrada como referência para o adversário avatar", () => {
    const state = createEncounterBattle(
      "boto-encounter",
      {
        mode: "wild",
        opponentId: "wild:boto-cor-de-rosa",
        opponentName: "Boto-cor-de-rosa",
        opponentAbilityIds: ["kappa-splash", "iara-song"],
        opponentHp: 180,
        playerAvatarConfig: DEFAULT_AVATAR_CONFIG,
        playerAbilityIds: ["iara-song", "kelpie-surge"],
        playerEnergy: waterEnergy,
      },
      fixedRandom,
    );
    const opponent = getSide(state, "wild:boto-cor-de-rosa");

    expect(state.mode).toBe("wild");
    expect(opponent.name).toBe("Boto-cor-de-rosa");
    expect(opponent.kind).toBe("npc");
    expect(opponent.abilityIds).toEqual(["kappa-splash", "iara-song"]);
    expect(opponent.avatarConfig.outfit).toBe("ranger");
    expect("team" in opponent).toBe(false);
  });
});
