import { describe, expect, it } from "vitest";
import {
  createDemoBattle,
  drawPowerCard,
  equipPowerCard,
  getSide,
  resolveAttack,
} from "./engine";

const fixedRandom = () => 0.27;
const fireEnergy = { fire: 12, water: 0, nature: 0, storm: 0, spirit: 0 };

describe("Baralho de Poder autoritativo", () => {
  it("permite uma compra por turno e registra o evento", () => {
    const state = createDemoBattle("power-draw", fixedRandom, ["boitata"], fireEnergy);
    const before = getSide(state, "player-one");

    const first = drawPowerCard(state, "player-one", "draw-one");
    const after = getSide(first.state, "player-one");

    expect(before.powerHand).toHaveLength(3);
    expect(after.powerHand).toHaveLength(4);
    expect(after.powerDrawsRemaining).toBe(0);
    expect(first.events.map((event) => event.kind)).toEqual(["power_drawn"]);
    expect(() => drawPowerCard(first.state, "player-one", "draw-two")).toThrow(
      "já comprou uma Carta de Poder",
    );
  });

  it("equipa um poder compatível e o remove da mão", () => {
    let state = createDemoBattle("power-equip", fixedRandom, ["boitata"], fireEnergy);
    state = drawPowerCard(state, "player-one", "draw").state;
    const player = getSide(state, "player-one");
    const candidate = player.powerHand.find(
      (card) => !player.team[0].equippedPowerIds.includes(card.attackId),
    );
    expect(candidate).toBeTruthy();

    const result = equipPowerCard(
      state,
      "player-one",
      0,
      candidate!.id,
      undefined,
      "equip",
    );
    const updated = getSide(result.state, "player-one");

    expect(updated.team[0].equippedPowerIds).toContain(candidate!.attackId);
    expect(updated.powerHand.some((card) => card.id === candidate!.id)).toBe(false);
    expect(updated.powerDiscard.some((card) => card.id === candidate!.id)).toBe(true);
    expect(result.events[0].kind).toBe("power_equipped");
  });

  it("rejeita ataque que não está equipado", () => {
    const state = createDemoBattle("power-attack", fixedRandom, ["boitata"], fireEnergy);
    const player = getSide(state, "player-one");
    const unequipped = player.powerHand.find(
      (card) => !player.team[0].equippedPowerIds.includes(card.attackId),
    );
    expect(unequipped).toBeTruthy();

    expect(() =>
      resolveAttack(
        state,
        "player-one",
        unequipped!.attackId,
        6,
        1,
        "forged-attack",
      ),
    ).toThrow("não está equipado");
  });

  it("exige escolher um slot quando a criatura já possui quatro poderes", () => {
    let state = createDemoBattle("power-slots", fixedRandom, ["boitata"], fireEnergy);
    const player = getSide(state, "player-one");
    const distinct = [player.team[0].equippedPowerIds[0]];
    for (const card of [...player.powerHand, ...player.powerDeck]) {
      if (!distinct.includes(card.attackId)) distinct.push(card.attackId);
      if (distinct.length === 5) break;
    }
    expect(distinct).toHaveLength(5);
    player.team[0].equippedPowerIds = distinct.slice(0, 4);

    const targetCard = [...player.powerHand, ...player.powerDeck].find(
      (card) => card.attackId === distinct[4],
    )!;
    if (!player.powerHand.some((card) => card.id === targetCard.id)) {
      player.powerDeck = player.powerDeck.filter((card) => card.id !== targetCard.id);
      player.powerHand.push(targetCard);
    }

    expect(() =>
      equipPowerCard(state, "player-one", 0, targetCard.id, undefined, "equip-full"),
    ).toThrow("qual dos quatro poderes");

    const replaced = equipPowerCard(
      state,
      "player-one",
      0,
      targetCard.id,
      2,
      "equip-replace",
    );
    expect(getSide(replaced.state, "player-one").team[0].equippedPowerIds[2]).toBe(distinct[4]);
  });
});
