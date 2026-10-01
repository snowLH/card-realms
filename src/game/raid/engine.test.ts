import { describe, expect, it } from "vitest";
import { STARTER_TEAM_IDS } from "../content";
import {
  attachRaidEnergy,
  createRaidState,
  eligibleRaidRewardPlayerIds,
  resolveRaidAttack,
  resolveRaidBossTurn,
} from "./engine";
import { RAID_BOSS_ID } from "./types";

const energy = { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 } as const;

function players(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `Jogador ${index + 1}`,
    seat: index + 1,
    teamIds: STARTER_TEAM_IDS,
    energy: { ...energy },
  }));
}

function raid(count = 5) {
  return createRaidState(
    "10000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    players(count),
    { catalogId: "roc", maxHp: 10000, speed: 0, maxRounds: 30 },
    () => 0.27,
  );
}

describe("Raid Mítica cooperativa", () => {
  it.each([2, 3, 4, 5])("inicia corretamente com %i jogadores", (count) => {
    const state = raid(count);
    expect(state.players).toHaveLength(count);
    expect(state.players.every((player) => player.side.team.length === 6)).toBe(true);
    expect(state.turnOrder).toHaveLength(count + 1);
    expect(state.turnOrder).toContain(RAID_BOSS_ID);
    expect(state.boss.catalogId).toBe("roc");
    expect(state.boss.hp).toBe(10000);
    expect(state.status).toBe("active");
  });

  it("mantém uma única vida compartilhada do boss", () => {
    const state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    const fireCard = actor.side.energyHand.find((card) => card.element === "fire")
      ?? actor.side.energyDeck.find((card) => card.element === "fire")!;
    if (!actor.side.energyHand.some((card) => card.id === fireCard.id)) {
      actor.side.energyDeck = actor.side.energyDeck.filter((card) => card.id !== fireCard.id);
      fireCard.zone = "hand";
      actor.side.energyHand.push(fireCard);
    }

    state = attachRaidEnergy(state, actor.id, 0, fireCard.id, "attach").state;
    const before = state.boss.hp;
    const result = resolveRaidAttack(state, actor.id, "boitata-1", 6, "attack");

    expect(result.state.boss.hp).toBeLessThan(before);
    expect(result.events.some((event) => event.kind === "die_rolled")).toBe(true);
    expect(result.events.some((event) => event.kind === "critical")).toBe(true);
  });

  it("muda para a fase 2 e ativa Terreno compartilhado ao cruzar 70%", () => {
    let state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    state.boss.hp = 6999;
    const fireCard = actor.side.energyHand.find((card) => card.element === "fire")
      ?? actor.side.energyDeck.find((card) => card.element === "fire")!;
    if (!actor.side.energyHand.some((card) => card.id === fireCard.id)) {
      actor.side.energyDeck = actor.side.energyDeck.filter((card) => card.id !== fireCard.id);
      fireCard.zone = "hand";
      actor.side.energyHand.push(fireCard);
    }
    state = attachRaidEnergy(state, actor.id, 0, fireCard.id, "phase-attach").state;
    const result = resolveRaidAttack(state, actor.id, "boitata-1", 6, "phase-hit");

    expect(result.state.boss.phase).toBe(2);
    expect(result.state.terrain?.sourceSideId).toBe(RAID_BOSS_ID);
    expect(result.events.some((event) => event.kind === "phase_changed")).toBe(true);
  });

  it("ataque de área do boss atinge todos os jogadores ativos", () => {
    const state = raid(5);
    state.boss.phase = 2;
    state.turn.actorId = RAID_BOSS_ID;
    state.turn.actorKind = "boss";
    state.turn.index = state.turnOrder.indexOf(RAID_BOSS_ID);
    const before = new Map(state.players.map((player) => [player.id, player.side.team[0].hp]));

    const result = resolveRaidBossTurn(state, 0, "boss-area");

    for (const player of result.state.players) {
      expect(player.side.team[0].hp).toBeLessThan(before.get(player.id)!);
    }
    expect(result.events.some((event) => event.kind === "boss_area_attack")).toBe(true);
  });

  it("recompensa Mítica considera ação válida e não apenas dano", () => {
    const state = raid(3);
    state.status = "victory";
    state.players[0].contribution.actions = 2;
    state.players[0].contribution.damage = 0;
    state.players[0].contribution.shield = 20;
    state.players[1].contribution.actions = 1;
    state.players[1].contribution.damage = 50;
    state.players[2].contribution.actions = 0;

    expect(eligibleRaidRewardPlayerIds(state)).toEqual([
      state.players[0].id,
      state.players[1].id,
    ]);
  });

  it("mantém Energia como carta real vinculada à criatura", () => {
    let state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    const card = actor.side.energyHand[0];

    const result = attachRaidEnergy(state, actor.id, 0, card.id, "energy-card");
    const updated = result.state.players.find((player) => player.id === actor.id)!;
    const attached = updated.side.team[0].attachedEnergy[0];

    expect(attached).toMatchObject({
      id: card.id,
      ownerId: actor.id,
      zone: "attached",
      attachedTo: updated.side.team[0].instanceId,
      status: "ready",
    });
    expect(updated.side.attachmentsRemaining).toBe(0);
  });
});
