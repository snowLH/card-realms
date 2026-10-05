import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "../save/local-progress";
import { RaidActionSchema } from "./contracts";
import {
  attachRaidEnergy,
  createRaidState,
  eligibleRaidRewardPlayerIds,
  passRaidTurn,
  resolveRaidAbility,
  resolveRaidBossTurn,
} from "./engine";
import { RaidStateSchema } from "./schema";
import { RAID_BOSS_ID } from "./types";

const energy = { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 } as const;
const abilities: [string, string] = ["ancestral-roots", "boitata-flame"];

function players(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `Jogador ${index + 1}`,
    seat: index + 1,
    avatarConfig: { ...DEFAULT_AVATAR_CONFIG },
    abilityIds: [...abilities] as [string, string],
    energy: { ...energy },
  }));
}

function raid(count = 5) {
  return createRaidState(
    "10000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    players(count),
    { catalogId: "roc", maxHp: 10000, speed: 62, maxRounds: 30 },
    () => 0.27,
  );
}

describe("Raid cooperativa com avatar e dois poderes", () => {
  it.each([2, 3, 4, 5])("inicia com %i avatares e dois poderes fixos por pessoa", (count) => {
    const state = raid(count);

    expect(state.players).toHaveLength(count);
    for (const player of state.players) {
      expect(player.side.avatarConfig).toEqual(DEFAULT_AVATAR_CONFIG);
      expect(player.side.abilityIds).toEqual(abilities);
      expect(player.side.abilityIds).toHaveLength(2);
      expect(player.side).not.toHaveProperty("team");
    }
    expect(state.turnOrder).toHaveLength(count + 1);
    expect(state.turnOrder).toContain(RAID_BOSS_ID);
    expect(state.boss.catalogId).toBe("roc");
    expect(state.boss.hp).toBe(10000);
    expect(state.status).toBe("active");
    expect(RaidStateSchema.safeParse(state).success).toBe(true);
  });

  it("recusa um boss cujo catálogo não corresponde ao evento da Raid", () => {
    const state = raid(2);
    state.boss.catalogId = "iara";

    expect(RaidStateSchema.safeParse(state).success).toBe(false);
  });

  it("usa um dos dois poderes contra a vida compartilhada do boss", () => {
    const state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    const before = state.boss.hp;

    const result = resolveRaidAbility(state, actor.id, 1, 6, 1, "ability-hit");

    expect(result.state.boss.hp).toBeLessThan(before);
    expect(result.events.some((event) => event.kind === "ability_used" && event.abilitySlot === 1)).toBe(true);
    expect(result.events.some((event) => event.kind === "critical")).toBe(true);
    expect(result.state.players.find((player) => player.id === actor.id)?.contribution.damage).toBeGreaterThan(0);
  });

  it("recusa IDs de ação repetidos e slots além dos dois poderes", () => {
    const state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    const used = resolveRaidAbility(state, actor.id, 0, 6, 50, "duplicate-ability").state;

    expect(() => resolveRaidAbility(used, actor.id, 1, 6, 50, "duplicate-ability")).toThrow(/já foi processada/i);
    expect(RaidActionSchema.safeParse({
      roomId: state.roomId,
      expectedVersion: 1,
      actionId: "30000000-0000-4000-8000-000000000003",
      action: "ability",
      slot: 2,
    }).success).toBe(false);
    expect(RaidActionSchema.safeParse({
      roomId: state.roomId,
      expectedVersion: 1,
      actionId: "30000000-0000-4000-8000-000000000003",
      action: "ability",
      slot: 0,
      creatureIndex: 4,
    }).success).toBe(false);
  });

  it("normaliza UUIDs de ações antes de persistir ou comparar retries", () => {
    const parsed = RaidActionSchema.parse({
      roomId: "10000000-0000-4000-8000-000000000001".toUpperCase(),
      expectedVersion: 1,
      actionId: "30000000-0000-4000-8000-000000000003".toUpperCase(),
      action: "pass",
    });

    expect(parsed.roomId).toBe("10000000-0000-4000-8000-000000000001");
    expect(parsed.actionId).toBe("30000000-0000-4000-8000-000000000003");
  });

  it("registra Energia no avatar sem anexá-la a uma criatura", () => {
    const state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    const card = actor.side.energyHand[0];

    const result = attachRaidEnergy(state, actor.id, card.id, "energy-card");
    const updated = result.state.players.find((player) => player.id === actor.id)!;

    expect(updated.side.attachedEnergy[0]).toMatchObject({
      id: card.id,
      ownerId: actor.id,
      zone: "attached",
      attachedTo: actor.id,
      status: "ready",
    });
    expect(updated.side.attachmentsRemaining).toBe(0);
    expect(updated.side).not.toHaveProperty("team");
  });

  it("avança as fases e ativa o Terreno quando o boss cruza 70%", () => {
    const state = raid(2);
    const actor = state.players.find((player) => player.id === state.turn.actorId)!;
    state.boss.hp = 6999;

    const result = resolveRaidAbility(state, actor.id, 1, 6, 50, "phase-hit");

    expect(result.state.boss.phase).toBe(2);
    expect(result.state.terrain?.sourceSideId).toBe(RAID_BOSS_ID);
    expect(result.events.some((event) => event.kind === "phase_changed")).toBe(true);
  });

  it("ataque em área do boss atinge todos os avatares ativos", () => {
    const state = raid(5);
    state.boss.phase = 2;
    state.turn.actorId = RAID_BOSS_ID;
    state.turn.actorKind = "boss";
    state.turn.index = state.turnOrder.indexOf(RAID_BOSS_ID);
    const before = new Map(state.players.map((player) => [player.id, player.side.hp]));

    const result = resolveRaidBossTurn(state, 0, "boss-area");

    for (const player of result.state.players) {
      expect(player.side.hp).toBeLessThan(before.get(player.id)!);
    }
    expect(result.events.some((event) => event.kind === "boss_area_attack")).toBe(true);
  });

  it("não concede recompensa a quem não fez ação válida", () => {
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

  it("mantém a sequência de eventos crescente mesmo com o log limitado", () => {
    let state = raid(2);
    state.maxRounds = 200;
    for (const player of state.players) {
      player.side.hp = 100_000;
      player.side.maxHp = 100_000;
    }
    for (let index = 0; index < 125 && state.status === "active"; index += 1) {
      const actor = state.players.find((player) => player.id === state.turn.actorId)!;
      state = passRaidTurn(state, actor.id, `pass-${index}`).state;
      if (state.status !== "active") break;
      if (state.turn.actorKind === "boss") {
        state = resolveRaidBossTurn(state, index, `boss-${index}`).state;
      }
    }

    expect(state.log.length).toBeLessThanOrEqual(240);
    expect(state.eventSequence).toBeGreaterThan(state.log.length);
    expect(RaidStateSchema.safeParse(state).success).toBe(true);
  });
});
