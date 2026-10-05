import { describe, expect, it } from "vitest";
import { BattleStateSchema } from "./battle/schema";
import {
  GameRuleError,
  attachEnergy,
  concedeBattle,
  createDemoBattle,
  createPvpBattle,
  getSide,
  passTurn,
  planNpcTurn,
  resolveAbility,
} from "./engine";
import { DEFAULT_AVATAR_CONFIG } from "./save/local-progress";
import { ELEMENTS } from "./types";

const fixedRandom = () => 0.417;
const abilities = ["boitata-flame", "ancestral-roots"] as const;

function battle(id: string) {
  return createDemoBattle(id, fixedRandom, DEFAULT_AVATAR_CONFIG, abilities);
}

function ensureCardInHand(state: ReturnType<typeof battle>, sideId: string, element?: (typeof ELEMENTS)[number]) {
  const side = getSide(state, sideId);
  const inHand = side.energyHand.find((card) => element === undefined || card.element === element);
  if (inHand) return inHand.id;
  const deckIndex = side.energyDeck.findIndex((card) => element === undefined || card.element === element);
  const [card] = deckIndex >= 0 ? side.energyDeck.splice(deckIndex, 1) : [];
  if (!card) throw new Error("No energy card available");
  card.zone = "hand";
  side.energyHand.push(card);
  return card.id;
}

const pvpPlayers = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Ana",
    avatarConfig: DEFAULT_AVATAR_CONFIG,
    abilityIds: ["boitata-flame", "ancestral-roots"] as const,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Beto",
    avatarConfig: { ...DEFAULT_AVATAR_CONFIG, outfit: "ranger" as const },
    abilityIds: ["iara-song", "kelpie-surge"] as const,
  },
] as const;

describe("motor de batalha por avatar", () => {
  it("possui exatamente cinco elementos-base", () => {
    expect(ELEMENTS).toEqual(["fire", "water", "nature", "storm", "spirit"]);
  });

  it("cria dois lados avatar com exatamente dois poderes permanentes", () => {
    const state = battle("avatar-battle");

    expect(state.version).toBe(3);
    expect(state.sides).toHaveLength(2);
    expect(state.sides.every((side) => side.abilityIds.length === 2)).toBe(true);
    expect(state.sides.every((side) => side.avatarConfig.skin === "copper")).toBe(true);
    expect(state.sides.every((side) => !("team" in side))).toBe(true);
    expect(getSide(state, "player-one").abilityIds).toEqual(abilities);
  });

  it("monta um baralho equilibrado com a energia disponível no inventário", () => {
    const inventory = { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 };
    const state = createDemoBattle("balanced-inventory", fixedRandom, DEFAULT_AVATAR_CONFIG, abilities, inventory);
    const cards = [...state.sides[0].energyHand, ...state.sides[0].energyDeck];

    expect(cards).toHaveLength(30);
    for (const element of ELEMENTS) {
      expect(cards.filter((card) => card.element === element)).toHaveLength(6);
    }
  });

  it("só anexa uma carta da mão ao personagem por turno", () => {
    const initial = battle("attachment-limit");
    const firstCardId = ensureCardInHand(initial, "player-one");
    const first = attachEnergy(initial, "player-one", firstCardId, "attach-1");
    const player = getSide(first.state, "player-one");
    const secondCardId = ensureCardInHand(first.state, "player-one");

    expect(player.attachedEnergy).toHaveLength(1);
    expect(player.attachedEnergy[0]).toMatchObject({
      ownerId: "player-one",
      zone: "attached",
      attachedTo: "player-one",
      status: "ready",
    });
    expect(() => attachEnergy(first.state, "player-one", secondCardId, "attach-2"))
      .toThrow("Você já vinculou Energia neste turno");
  });

  it("resolve um poder equipado e gasta Energia focada mesmo quando o dado falha", () => {
    const initial = battle("failed-roll");
    const fireCardId = ensureCardInHand(initial, "player-one", "fire");
    const attached = attachEnergy(initial, "player-one", fireCardId, "attach-fire").state;
    const result = resolveAbility(attached, "player-one", 0, 1, 100, "miss");
    const player = getSide(result.state, "player-one");

    expect(result.events.some((event) => event.kind === "attack_miss" && event.abilityId === "boitata-flame")).toBe(true);
    expect(player.attachedEnergy).toHaveLength(0);
    expect(player.energyDiscard.some((card) => card.element === "fire")).toBe(true);
  });

  it("rejeita ações fora do turno e não repete um ID já processado", () => {
    const initial = battle("turn-and-replay");
    expect(() => passTurn(initial, "warden-aya", "out-of-turn")).toThrow("Aguarde o seu turno");
    const passed = passTurn(initial, "player-one", "pass-action");

    expect(passed.state.turn.sideId).toBe("warden-aya");
    expect(passed.events.some((event) => event.kind === "passed")).toBe(true);
    expect(() => passTurn(passed.state, "warden-aya", "pass-action")).toThrow(GameRuleError);
  });

  it("planeja jogadas da IA somente usando os dois poderes e a Energia em sua mão", () => {
    const state = battle("npc-plan");
    state.turn.sideId = "warden-aya";
    const plan = planNpcTurn(state, "warden-aya");

    expect(plan.attachEnergyCardId).toBe(getSide(state, "warden-aya").energyHand[0]?.id);
    expect([0, 1]).toContain(plan.abilitySlot);
  });

  it("encerra PVP por desistência mesmo fora do turno do desistente", () => {
    const state = createPvpBattle("pvp-concede", pvpPlayers[0], pvpPlayers[1], () => 0.9);
    const quitter = state.sides.find((side) => side.id !== state.turn.sideId)!;
    const winner = state.sides.find((side) => side.id === state.turn.sideId)!;
    const result = concedeBattle(state, quitter.id, "concede-test");

    expect(result.state.status).toBe("finished");
    expect(result.state.winnerId).toBe(winner.id);
    expect(result.events.map((event) => event.kind)).toEqual(["conceded", "battle_end"]);
  });

  it("inicia PVP com avatares, dois poderes por participante e primeiro turno sorteado", () => {
    const state = createPvpBattle("pvp-start", pvpPlayers[0], pvpPlayers[1], () => 0.75);

    expect(state.mode).toBe("pvp");
    expect(state.sides.map((side) => side.id)).toEqual([pvpPlayers[0].id, pvpPlayers[1].id]);
    expect(state.sides.map((side) => side.abilityIds)).toEqual([
      ["boitata-flame", "ancestral-roots"],
      ["iara-song", "kelpie-surge"],
    ]);
    expect(state.sides.every((side) => side.kind === "player" && side.abilityIds.length === 2)).toBe(true);
    expect(state.turn.sideId).toBe(pvpPlayers[1].id);
    expect(state.log[0].message).toContain("um personagem e dois poderes cada");
  });

  it("impede loadouts repetidos/incompletos e o mesmo jogador nos dois lados", () => {
    expect(() => createPvpBattle("pvp-duplicate", {
      ...pvpPlayers[0], abilityIds: ["boitata-flame", "boitata-flame"],
    }, pvpPlayers[1], fixedRandom)).toThrow(GameRuleError);
    expect(() => createPvpBattle("pvp-incomplete", {
      ...pvpPlayers[0], abilityIds: ["boitata-flame"],
    }, pvpPlayers[1], fixedRandom)).toThrow(GameRuleError);
    expect(() => createPvpBattle("pvp-self", pvpPlayers[0], pvpPlayers[0], fixedRandom)).toThrow(GameRuleError);
  });

  it("o estado de combate rejeita campos de equipe legada", () => {
    const state = createPvpBattle("pvp-no-team", pvpPlayers[0], pvpPlayers[1], fixedRandom);
    const forged = {
      ...state,
      sides: state.sides.map((side) => ({ ...side, team: [] })),
    };

    expect(BattleStateSchema.safeParse(forged).success).toBe(false);
  });
});
