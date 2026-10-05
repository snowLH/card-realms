import { describe, expect, it } from "vitest";
import { BATTLE_BOARDS, resolveBattleBoard } from "./presentation";
import { presentationDuration, toBattlePresentationEvents } from "./presentation-events";
import type { BattleLogEntry } from "./types";

describe("apresentação da batalha", () => {
  it("mantém exatamente seis tabuleiros cosméticos distintos", () => {
    expect(BATTLE_BOARDS).toHaveLength(6);
    expect(new Set(BATTLE_BOARDS.map((board) => board.id)).size).toBe(6);
    expect(resolveBattleBoard("ashes")).toBe("ashes");
    expect(resolveBattleBoard("desconhecido")).toBe("cartographer");
  });

  it("traduz eventos confirmados pelo motor em uma fila visual", () => {
    const events: BattleLogEntry[] = [
      {
        id: "energy-1",
        turn: 1,
        actorId: "player-one",
        kind: "energy_attached",
        message: "Energia anexada.",
      },
      {
        id: "attack-1",
        turn: 1,
        actorId: "player-one",
        kind: "attack_hit",
        message: "Ataque acertou.",
        die: 5,
        damage: 70,
        abilityId: "iara-song",
        abilitySlot: 0,
      },
      {
        id: "ko-1",
        turn: 1,
        actorId: "opponent",
        kind: "defeated",
        message: "Criatura nocauteada.",
      },
    ];

    const sequence = toBattlePresentationEvents(events);
    expect(sequence.map((event) => event.kind)).toEqual(["energy", "roll", "attack", "ko"]);
    expect(sequence[1]).toMatchObject({ kind: "roll", die: 5, abilityId: "iara-song", abilitySlot: 0 });
    expect(sequence[2]).toMatchObject({ die: 5, damage: 70, abilityId: "iara-song", abilitySlot: 0 });
  });

  it("modo rápido reduz duração sem eliminar feedback", () => {
    expect(presentationDuration("attack", "fast")).toBeLessThan(
      presentationDuration("attack", "normal"),
    );
    expect(presentationDuration("critical", "very-fast")).toBeGreaterThanOrEqual(180);
  });
});
