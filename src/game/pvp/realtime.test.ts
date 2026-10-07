import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import {
  PvpRealtimeActionSchema,
  PvpRealtimeRuleError,
  PvpRealtimeStateSchema,
  applyPvpRealtimeAction,
  createPvpRealtimeDuel,
  visiblePvpRealtimeState,
} from "./realtime";

const PLAYER_ONE = "10000000-0000-4000-8000-000000000001";
const PLAYER_TWO = "20000000-0000-4000-8000-000000000002";
const DUEL_ID = "30000000-0000-4000-8000-000000000003";

function duel() {
  return createPvpRealtimeDuel(DUEL_ID, [
    {
      id: PLAYER_ONE,
      name: "Curupira",
      avatarConfig: { ...DEFAULT_AVATAR_CONFIG, legendId: "curupira" },
      abilityIds: ["curupira-root-snare", "curupira-ember-arrow"],
    },
    {
      id: PLAYER_TWO,
      name: "Iara",
      avatarConfig: { ...DEFAULT_AVATAR_CONFIG, legendId: "iara", favoriteLegendId: "iara" },
      abilityIds: ["iara-enchanting-song", "iara-living-spring"],
    },
  ], 1_000);
}

describe("combate PVP em tempo real", () => {
  it("cria um estado autoritativo com dois avatares e exatamente dois poderes por jogador", () => {
    const state = duel();

    expect(PvpRealtimeStateSchema.parse(state)).toEqual(state);
    expect(state.players.map(({ id, abilityIds }) => ({ id, abilityIds }))).toEqual([
      { id: PLAYER_ONE, abilityIds: ["curupira-root-snare", "curupira-ember-arrow"] },
      { id: PLAYER_TWO, abilityIds: ["iara-enchanting-song", "iara-living-spring"] },
    ]);
    expect(state.players.map((player) => [player.x, player.y])).toEqual([[250, 360], [1_030, 360]]);
    expect(JSON.stringify(state)).not.toMatch(/team|creatures|energyDeck|energyHand/);
  });

  it("avança movimento pelo relógio do servidor e ignora coordenadas de cliente", () => {
    const initial = duel();
    const input = applyPvpRealtimeAction(initial, PLAYER_ONE, {
      kind: "input",
      actionId: "move-1",
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }, 1_000).state;
    const moved = applyPvpRealtimeAction(input, PLAYER_ONE, {
      kind: "input",
      actionId: "move-2",
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }, 2_000).state;

    expect(moved.players[0].x).toBe(500);
    expect(moved.players[0].y).toBe(360);
    expect(moved.serverTimeMs).toBe(2_000);
  });

  it("checks range and facing on basic attacks", () => {
    const state = duel();
    const input = applyPvpRealtimeAction(state, PLAYER_ONE, {
      kind: "input",
      actionId: "aim-right",
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }, 1_000).state;
    const miss = applyPvpRealtimeAction(input, PLAYER_ONE, { kind: "attack", actionId: "shot-one" }, 2_000);
    expect(miss.events.some((event) => event.kind === "attack_missed")).toBe(true);

    const closing = applyPvpRealtimeAction(miss.state, PLAYER_ONE, {
      kind: "input",
      actionId: "move-closer",
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }, 2_000).state;
    const hit = applyPvpRealtimeAction(closing, PLAYER_ONE, { kind: "attack", actionId: "shot-two" }, 2_600);
    expect(hit.state.players[1].hp).toBe(102);
    expect(hit.events.some((event) => event.kind === "player_hit" && event.damage === 18)).toBe(true);
  });

  it("usa um poder equipado, aplica controle e respeita a recarga", () => {
    const initial = duel();
    const moving = applyPvpRealtimeAction(initial, PLAYER_ONE, {
      kind: "input",
      actionId: "move-and-aim",
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }, 1_000).state;
    const cast = applyPvpRealtimeAction(moving, PLAYER_ONE, { kind: "ability", actionId: "root-cast", slot: 0 }, 2_000);

    expect(cast.state.players[1].hp).toBe(92);
    expect(cast.state.players[1].rootedUntilMs).toBeGreaterThan(cast.state.serverTimeMs);
    expect(cast.events.some((event) => event.kind === "ability_cast" && event.abilityId === "curupira-root-snare")).toBe(true);
    expect(() => applyPvpRealtimeAction(cast.state, PLAYER_ONE, {
      kind: "ability",
      actionId: "root-too-soon",
      slot: 0,
    }, 2_100)).toThrow(PvpRealtimeRuleError);
  });

  it("faz dash de esquiva, trata desistência no servidor e oculta IDs de ação internos", () => {
    const initial = duel();
    initial.players[0].x = 560;
    initial.players[0].input = { moveX: 0, moveY: 0, aimX: 1, aimY: 0 };
    initial.players[1].x = 700;
    initial.players[1].input = { moveX: -1, moveY: 0, aimX: -1, aimY: 0 };

    const dash = applyPvpRealtimeAction(initial, PLAYER_TWO, { kind: "dash", actionId: "dodge" }, 1_000);
    const attack = applyPvpRealtimeAction(dash.state, PLAYER_ONE, { kind: "attack", actionId: "swing" }, 1_100);
    expect(attack.state.players[1].hp).toBe(120);

    const conceded = applyPvpRealtimeAction(attack.state, PLAYER_TWO, { kind: "concede", actionId: "yield" }, 1_100);
    expect(conceded.state).toMatchObject({ status: "finished", winnerId: PLAYER_ONE, finishReason: "concede" });
    expect(visiblePvpRealtimeState(conceded.state, PLAYER_ONE).processedActionIds).toEqual([]);
    expect(() => visiblePvpRealtimeState(conceded.state, "30000000-0000-4000-8000-000000000004")).toThrow(PvpRealtimeRuleError);
  });

  it("rejeita comandos com dados do resultado ou valores de movimento fora do contrato", () => {
    expect(PvpRealtimeActionSchema.safeParse({
      action: "input",
      battleId: DUEL_ID,
      expectedVersion: 1,
      actionId: "40000000-0000-4000-8000-000000000004",
      moveX: 2,
      moveY: 0,
      aimX: 1,
      aimY: 0,
      x: 999_999,
    }).success).toBe(false);
    expect(PvpRealtimeActionSchema.safeParse({
      action: "concede",
      battleId: DUEL_ID,
      expectedVersion: 1,
      actionId: "40000000-0000-4000-8000-000000000004",
      winnerId: PLAYER_TWO,
    }).success).toBe(false);
  });
});
