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
import { ArpgRaidActionRequestSchema, ArpgRaidLoadoutSchema, ArpgRaidStateSchema } from "./schema";
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
  it("cria uma expedição mítica com 2 a 4 Lendas e dois poderes por jogador", () => {
    const raid = state(4);
    expect(raid.players).toHaveLength(4);
    expect(raid.players.every((player) => player.loadout.abilityIds.length === 2)).toBe(true);
    expect(raid.boss.catalogId).toBe("roc");
    expect(raid.boss.hp).toBe(10_000);
  });

  it("rejeita quantidade de participantes fora de 2–4", () => {
    expect(() => createArpgRaidState(ROOM_ID, EVENT_ID, players(1), ARPG_ROC_RAID_BOSS, START))
      .toThrow(ArpgRaidRuleError);
    expect(() => createArpgRaidState(ROOM_ID, EVENT_ID, players(5), ARPG_ROC_RAID_BOSS, START))
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

  it("aceita reanimação cooperativa como ação estrita e canônica", () => {
    const request = ArpgRaidActionRequestSchema.parse({
      roomId: ROOM_ID.toUpperCase(),
      expectedVersion: 1,
      actionId: "33333333-3333-4333-8333-333333333333",
      action: "revive",
      targetPlayerId: "44444444-4444-4444-8444-444444444444".toUpperCase(),
    });
    expect(request.action).toBe("revive");
    if (request.action === "revive") {
      expect(request.targetPlayerId).toBe("44444444-4444-4444-8444-444444444444");
    }
    expect(ArpgRaidActionRequestSchema.safeParse({
      roomId: ROOM_ID,
      expectedVersion: 1,
      actionId: "33333333-3333-4333-8333-333333333333",
      action: "revive",
      targetPlayerId: "not-a-player-id",
      hp: 120,
    }).success).toBe(false);
  });

  it("adiciona os campos de reanimação ao ler estados de Raid ARPG já persistidos", () => {
    const previousState = createArpgRaidState(
      ROOM_ID,
      EVENT_ID,
      [
        { id: "33333333-3333-4333-8333-333333333333", name: "A", seat: 1, loadout: structuredClone(DEFAULT_ARPG_LOADOUT) },
        { id: "44444444-4444-4444-8444-444444444444", name: "B", seat: 2, loadout: structuredClone(DEFAULT_ARPG_LOADOUT) },
      ],
      ARPG_ROC_RAID_BOSS,
      START,
    );
    const legacySnapshot = structuredClone(previousState) as unknown as Record<string, unknown>;
    delete legacySnapshot.reviveCharges;
    legacySnapshot.players = previousState.players.map((player) => {
      const legacyPlayer = { ...player } as { downedUntilMs?: number; lastInputAtMs?: number };
      delete legacyPlayer.downedUntilMs;
      delete legacyPlayer.lastInputAtMs;
      return legacyPlayer;
    });

    const parsed = ArpgRaidStateSchema.parse(legacySnapshot);
    expect(parsed.reviveCharges).toBe(2);
    expect(parsed.players.every((player) => player.downedUntilMs === 0)).toBe(true);
    expect(parsed.players.every((player) => player.lastInputAtMs === 0)).toBe(true);
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

  it("aplica o proc de arma da Iara e não ativa armaduras legadas", () => {
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
    expect(retaliated.boss.hp).toBe(bossHpBefore);
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

  it("derruba um jogador com janela de resgate e permite que o grupo o reergua uma vez", () => {
    const raid = state();
    raid.boss.x = raid.players[0].x;
    raid.boss.y = raid.players[0].y;
    raid.players[0].hp = 1;
    raid.boss.nextAttackAtMs = START;

    const downed = advanceArpgRaid(raid, START + 50).state;
    const target = downed.players.find((player) => player.id === "player-1")!;
    const source = downed.players.find((player) => player.id === "player-2")!;
    expect(target.alive).toBe(false);
    expect(target.downedUntilMs).toBe(downed.serverTimeMs + 20_000);
    expect(downed.status).toBe("active");

    target.x = source.x;
    target.y = source.y;
    const revived = applyArpgRaidAction(downed, source.id, {
      kind: "revive",
      actionId: "revive-player-1",
      targetPlayerId: target.id,
    }, downed.serverTimeMs);

    expect(revived.state.reviveCharges).toBe(1);
    expect(revived.state.players[0].alive).toBe(true);
    expect(revived.state.players[0].hp).toBe(42);
    expect(revived.state.players[0].downedUntilMs).toBe(0);
    expect(revived.state.players[1].contribution.healing).toBe(42);
    expect(revived.events.at(-1)?.kind).toBe("player_revived");
  });

  it("exige aliado derrubado próximo e uma reanimação restante", () => {
    const raid = state();
    raid.players[0].alive = false;
    raid.players[0].hp = 0;
    raid.players[0].downedUntilMs = START + 10_000;

    expect(() => applyArpgRaidAction(raid, "player-2", {
      kind: "revive",
      actionId: "revive-too-far",
      targetPlayerId: "player-1",
    }, START)).toThrow("Chegue mais perto");

    raid.players[0].x = raid.players[1].x;
    raid.players[0].y = raid.players[1].y;
    raid.reviveCharges = 0;
    expect(() => applyArpgRaidAction(raid, "player-2", {
      kind: "revive",
      actionId: "revive-no-charge",
      targetPlayerId: "player-1",
    }, START)).toThrow("não tem mais reanimações");
  });

  it("elimina um jogador derrubado quando termina a janela de resgate", () => {
    const raid = state();
    raid.players[0].alive = false;
    raid.players[0].hp = 0;
    raid.players[0].downedUntilMs = START + 50;

    const expired = advanceArpgRaid(raid, START + 50);
    expect(expired.state.players[0].downedUntilMs).toBe(0);
    expect(expired.state.status).toBe("active");
    expect(expired.events.some((event) => event.kind === "player_eliminated")).toBe(true);
  });

  it("vitória e elegibilidade de recompensa dependem de contribuição server-side", () => {
    const raid = state();
    raid.boss.hp = 1;
    const result = applyArpgRaidAction(raid, "player-1", { kind: "attack", actionId: "finisher" }, START);
    expect(result.state.status).toBe("victory");
    expect(eligibleArpgRaidRewardPlayerIds(result.state)).toEqual(["player-1"]);
  });
});
