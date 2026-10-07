import { describe, expect, it } from "vitest";
import { ARPG_ABILITY_CARDS, LEGACY_ARPG_ABILITY_CARDS, STARTER_ARPG_ABILITY_IDS } from "../arpg/content/ability-cards";
import { BATTLE_ABILITY_ART, getUnseenPvpAbilityEvents, pixelRowsForAbility, resolveBattleAbilityCast } from "./ability-visuals";
import type { BattlePresentationEvent } from "./presentation-events";
import type { BattleLogEntry } from "./types";

const sides = {
  player: { id: "player-one", abilityIds: [...STARTER_ARPG_ABILITY_IDS] as [string, string] },
  opponent: { id: "npc:kappa", abilityIds: ["kappa-shell-surge", "kappa-river-bind"] as [string, string] },
};

function abilityEvent(overrides: Partial<BattlePresentationEvent> = {}): BattlePresentationEvent {
  return {
    id: "confirmed-ability-1",
    kind: "ability",
    actorId: sides.player.id,
    abilityId: STARTER_ARPG_ABILITY_IDS[0],
    abilitySlot: 0,
    message: "Curupira usou suas raízes.",
    ...overrides,
  };
}

describe("pixel art de poderes em batalha", () => {
  it("reuses the crisp effect glyphs through each Lenda's visual effect id", () => {
    expect(Object.keys(BATTLE_ABILITY_ART).sort()).toEqual(LEGACY_ARPG_ABILITY_CARDS.map((card) => card.id).sort());

    const shapes = ARPG_ABILITY_CARDS.map((card) => pixelRowsForAbility(card.id)?.join("\n"));
    expect(shapes.every((shape) => shape !== undefined)).toBe(true);
    expect(new Set(shapes).size).toBe(new Set(ARPG_ABILITY_CARDS.map((card) => card.visualEffectId)).size);
    expect(shapes.every((shape) => {
      const rows = shape?.split("\n") ?? [];
      return rows.length === 16 && rows.every((row) => row.length > 0 && row.length <= 18);
    })).toBe(true);
  });

  it("resolves a confirmed slot-0 cast to its actor and configured ability", () => {
    expect(resolveBattleAbilityCast(abilityEvent(), sides.player)).toEqual({
      abilityId: STARTER_ARPG_ABILITY_IDS[0],
      slot: 0,
    });
  });

  it("resolves slot 1 for either acting side", () => {
    expect(resolveBattleAbilityCast(abilityEvent({
      actorId: sides.opponent.id,
      abilityId: "kappa-river-bind",
      abilitySlot: 1,
    }), sides.opponent)).toEqual({ abilityId: "kappa-river-bind", slot: 1 });
  });

  it("does not start visuals for unconfirmed, mismatched, or unequipped actions", () => {
    expect(resolveBattleAbilityCast(null, sides.player)).toBeNull();
    expect(resolveBattleAbilityCast(abilityEvent({ kind: "attack" }), sides.player)).toBeNull();
    expect(resolveBattleAbilityCast(abilityEvent({ actorId: "someone-else" }), sides.player)).toBeNull();
    expect(resolveBattleAbilityCast(abilityEvent({ abilitySlot: 1 }), sides.player)).toBeNull();
    expect(resolveBattleAbilityCast(abilityEvent({ abilityId: "iara-enchanting-song", abilitySlot: 0 }), sides.player)).toBeNull();
  });

  it("plays only newly observed opponent casts from the confirmed PVP log", () => {
    const log: BattleLogEntry[] = [
      { id: "old-opponent", turn: 1, actorId: sides.opponent.id, kind: "ability_used", abilityId: "kappa-shell-surge", abilitySlot: 0, message: "Old cast." },
      { id: "cursor", turn: 1, actorId: sides.player.id, kind: "energy_attached", message: "Energy attached." },
      { id: "own-cast", turn: 2, actorId: sides.player.id, kind: "ability_used", abilityId: STARTER_ARPG_ABILITY_IDS[1], abilitySlot: 1, message: "Own cast." },
      { id: "new-opponent", turn: 2, actorId: sides.opponent.id, kind: "ability_used", abilityId: "kappa-river-bind", abilitySlot: 1, message: "New cast." },
    ];

    expect(getUnseenPvpAbilityEvents(log, "cursor", sides.player.id)).toMatchObject([
      { id: "new-opponent", kind: "ability", actorId: sides.opponent.id, abilityId: "kappa-river-bind", abilitySlot: 1 },
    ]);
    expect(getUnseenPvpAbilityEvents(log, "removed-cursor", sides.player.id)).toEqual([]);
  });
});
