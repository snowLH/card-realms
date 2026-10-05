import { describe, expect, it } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { ARPG_ROC_RAID_BOSS } from "./content";
import {
  ArpgRaidRuleError,
  advanceArpgRaid,
  applyArpgRaidAction,
  createArpgRaidState,
  eligibleArpgRaidRewardPlayerIds,
} from "./engine";
import { ArpgRaidActionRequestSchema, ArpgRaidLoadoutSchema } from "./schema";
import type { ArpgRaidPlayerSetup } from "./types";

const START = 1_000_000;
const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function players(count = 2): ArpgRaidPlayerSetup[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Cartógrafo ${index + 1}`,
    seat: index + 1,
    loadout: structuredClone(DEFAULT_ARPG_LOADOUT),
  }));
}

function state(count = 2) {
  return createArpgRaidState(ROOM_ID, EVENT_ID, players(count), ARPG_ROC_RAID_BOSS, START);
}

describe("ARPG Raid authoritative foundation", () => {
  it("cria uma Raid Mítica com 2 a 5 loadouts ARPG, sem equipes de seis", () => {
    const raid = state(5);
    expect(raid.players).toHaveLength(5);
    expect(raid.players.every((player) => player.loadout.abilityIds.length === 2)).toBe(true);
    expect(raid.boss.catalogId).toBe("roc");
    expect(raid.boss.hp).toBe(10_000);
  });

  it("rejeita quantidade de participantes fora de 2–5", () => {
    expect(() => createArpgRaidState(ROOM_ID, EVENT_ID, players(1), ARPG_ROC_RAID_BOSS, START))
      .toThrow(ArpgRaidRuleError);
    expect(() => createArpgRaidState(ROOM_ID, EVENT_ID, players(6), ARPG_ROC_RAID_BOSS, START))
      .toThrow(ArpgRaidRuleError);
  });

  it("contrato HTTP estrito não aceita dano, HP ou vitória enviados pelo cliente", () => {
    const payload = {
      action: "attack",
      roomId: ROOM_ID,
      expectedVersion: 1,
      actionId: "33333333-3333-4333-8333-333333333333",
      damage: 999_999,
      victory: true,
      bossHp: 0,
    };
    expect(ArpgRaidActionRequestSchema.safeParse(payload).success).toBe(false);
  });

  it("recusa snapshots antigos com quatro poderes ou apoiadores ativos", () => {
    expect(ArpgRaidLoadoutSchema.safeParse({
      ...DEFAULT_ARPG_LOADOUT,
      abilityIds: ["ancestral-roots", "boitata-flame", "saci-whirlwind", "iara-song"],
    }).success).toBe(false);
    expect(ArpgRaidLoadoutSchema.safeParse({
      ...DEFAULT_ARPG_LOADOUT,
      supportIds: ["support-curupira", "support-boitata"],
    }).success).toBe(false);
    expect(ArpgRaidLoadoutSchema.safeParse({
      ...DEFAULT_ARPG_LOADOUT,
      abilityIds: ["ancestral-roots", "ancestral-roots"],
    }).success).toBe(false);
  });

  it("aceita apenas dois slots de ataque e não aceita ações de supporter", () => {
    const common = {
      roomId: ROOM_ID,
      expectedVersion: 1,
      actionId: "33333333-3333-4333-8333-333333333333",
    };
    expect(ArpgRaidActionRequestSchema.safeParse({ ...common, action: "ability", slot: 0 }).success).toBe(true);
    expect(ArpgRaidActionRequestSchema.safeParse({ ...common, action: "ability", slot: 1 }).success).toBe(true);
    expect(ArpgRaidActionRequestSchema.safeParse({ ...common, action: "ability", slot: 2 }).success).toBe(false);
    expect(ArpgRaidActionRequestSchema.safeParse({ ...common, action: "support" }).success).toBe(false);
    expect(ArpgRaidActionRequestSchema.safeParse({ ...common, action: "swap_support" }).success).toBe(false);
    const uppercase = ArpgRaidActionRequestSchema.parse({
      ...common,
      roomId: ROOM_ID.toUpperCase(),
      actionId: common.actionId.toUpperCase(),
      action: "attack",
    });
    expect(uppercase.roomId).toBe(ROOM_ID);
    expect(uppercase.actionId).toBe(common.actionId);
  });

  it("integra movimento no servidor e limita o avanço máximo por requisição", () => {
    const raid = state();
    const withInput = applyArpgRaidAction(raid, "player-1", {
      kind: "input",
      actionId: "move-1",
      moveX: 0,
      moveY: -1,
      aimX: 0,
      aimY: -1,
    }, START).state;
    const initialY = withInput.players[0].y;
    const advanced = advanceArpgRaid(withInput, START + 5_000).state;
    expect(advanced.serverTimeMs).toBe(START + 1_000);
    expect(advanced.players[0].y).toBeLessThan(initialY);
    expect(initialY - advanced.players[0].y).toBeLessThanOrEqual(250);
  });

  it("calcula dano do ataque básico no servidor e respeita cooldown", () => {
    const raid = state();
    const result = applyArpgRaidAction(raid, "player-1", { kind: "attack", actionId: "attack-1" }, START);
    expect(result.state.boss.hp).toBeLessThan(raid.boss.hp);
    expect(result.state.players[0].contribution.damage).toBeGreaterThan(0);
    expect(() => applyArpgRaidAction(result.state, "player-1", { kind: "attack", actionId: "attack-2" }, START + 10))
      .toThrow("recarga");
  });

  it("usa os dois ataques do próprio jogador com cooldowns independentes", () => {
    const raid = state();
    const player = raid.players[0];
    player.x = raid.boss.x;
    player.y = raid.boss.y + 100;
    player.input = { moveX: 0, moveY: 0, aimX: 0, aimY: -1 };
    const first = applyArpgRaidAction(raid, "player-1", {
      kind: "ability",
      slot: 0,
      actionId: "root-attack",
    }, START);
    const hpAfterFirst = first.state.boss.hp;
    const second = applyArpgRaidAction(first.state, "player-1", {
      kind: "ability",
      slot: 1,
      actionId: "flame-attack",
    }, START + 10);
    expect(hpAfterFirst).toBeLessThan(raid.boss.hp);
    expect(second.state.boss.hp).toBeLessThan(hpAfterFirst);
    expect(() => applyArpgRaidAction(second.state, "player-1", {
      kind: "ability",
      slot: 0,
      actionId: "root-repeat",
    }, START + 20)).toThrow("recarga");
  });

  it("usa os mesmos procs de arma do singleplayer na Raid", () => {
    const setups = players();
    setups[0].loadout.weaponId = "ritual-staff";
    let raid = createArpgRaidState(ROOM_ID, EVENT_ID, setups, ARPG_ROC_RAID_BOSS, START);
    const deltas: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const beforeHp = raid.boss.hp;
      const result = applyArpgRaidAction(
        raid,
        "player-1",
        { kind: "attack", actionId: `ritual-${index}` },
        START + index * 510,
      );
      raid = result.state;
      deltas.push(beforeHp - raid.boss.hp);
    }
    expect(deltas[3]).toBeGreaterThan(deltas[0]);
  });

  it("aplica cura periódica da Iara e contra-ataque do Ahuízotl no servidor", () => {
    const healingSetups = players();
    healingSetups[0].loadout.weaponId = "iara-song-staff";
    const healingRaid = createArpgRaidState(ROOM_ID, EVENT_ID, healingSetups, ARPG_ROC_RAID_BOSS, START);
    healingRaid.players[0].hp -= 10;
    healingRaid.players[0].basicAttackCounter = 3;
    const hpBefore = healingRaid.players[0].hp;
    const healed = applyArpgRaidAction(
      healingRaid,
      "player-1",
      { kind: "attack", actionId: "iara-fourth" },
      START,
    ).state;
    expect(healed.players[0].hp).toBe(hpBefore + 4);

    const armorSetups = players();
    armorSetups[0].loadout.armorId = "ahuizotl-guard-armor";
    const retaliationRaid = createArpgRaidState(ROOM_ID, EVENT_ID, armorSetups, ARPG_ROC_RAID_BOSS, START);
    retaliationRaid.boss.x = retaliationRaid.players[0].x;
    retaliationRaid.boss.y = retaliationRaid.players[0].y - 50;
    retaliationRaid.boss.nextAttackAtMs = START;
    const bossHpBefore = retaliationRaid.boss.hp;
    const retaliated = advanceArpgRaid(retaliationRaid, START + 50).state;
    expect(retaliated.boss.hp).toBe(bossHpBefore - 10);
  });

  it("retry do mesmo actionId é idempotente e não avança o relógio", () => {
    const raid = state();
    const first = applyArpgRaidAction(raid, "player-1", { kind: "attack", actionId: "same-action" }, START).state;
    const replay = applyArpgRaidAction(first, "player-1", { kind: "attack", actionId: "same-action" }, START + 900).state;
    expect(replay.boss.hp).toBe(first.boss.hp);
    expect(replay.serverTimeMs).toBe(first.serverTimeMs);
    expect(replay.log).toHaveLength(first.log.length);
  });

  it("boss muda de fase pelo HP e ataca usando o relógio do servidor", () => {
    const raid = state();
    raid.boss.hp = 6_500;
    const phaseTwo = advanceArpgRaid(raid, START + 100).state;
    expect(phaseTwo.boss.phase).toBe(2);
    const beforeHp = phaseTwo.players.map((player) => player.hp);
    const stepped = advanceArpgRaid(phaseTwo, START + 1_100).state;
    const attacked = advanceArpgRaid(stepped, START + 1_600).state;
    expect(attacked.players.some((player, index) => player.hp < beforeHp[index])).toBe(true);
  });

  it("vitória e elegibilidade de recompensa dependem de contribuição server-side", () => {
    const raid = state();
    raid.boss.hp = 1;
    const result = applyArpgRaidAction(raid, "player-1", { kind: "attack", actionId: "finisher" }, START);
    expect(result.state.status).toBe("victory");
    expect(eligibleArpgRaidRewardPlayerIds(result.state)).toEqual(["player-1"]);
  });
});
