import { describe, expect, it } from "vitest";
import { ELEMENTS, type BattleState, type Element } from "./types";
import {
  GameRuleError,
  attachEnergy,
  createDemoBattle,
  createPvpBattle,
  getActive,
  getSide,
  passTurn,
  planNpcTurn,
  resolveAttack,
  switchActiveCreature,
} from "./engine";

const fixedRandom = () => 0.417;

function battle(id: string) {
  return createDemoBattle(id, fixedRandom);
}

function ensureCardInHand(state: BattleState, sideId: string, element: Element) {
  const side = getSide(state, sideId);
  const inHand = side.energyHand.find((card) => card.element === element);
  if (inHand) return inHand.id;
  const deckIndex = side.energyDeck.findIndex((card) => card.element === element);
  if (deckIndex < 0) throw new Error(`No ${element} card available`);
  const [card] = side.energyDeck.splice(deckIndex, 1);
  side.energyHand.push(card);
  return card.id;
}

function attachElement(
  state: BattleState,
  sideId: string,
  creatureIndex: number,
  element: Element,
  actionId: string,
) {
  const cardId = ensureCardInHand(state, sideId, element);
  return attachEnergy(state, sideId, creatureIndex, cardId, actionId).state;
}

describe("motor de combate Card Realms v2", () => {
  it("possui exatamente cinco elementos-base", () => {
    expect(ELEMENTS).toEqual(["fire", "water", "nature", "storm", "spirit"]);
  });

  it("mantém exatamente seis cartas de criatura em cada lado", () => {
    const state = battle("six-card-team");
    expect(state.sides[0].team).toHaveLength(6);
    expect(state.sides[1].team).toHaveLength(6);
  });

  it("inicia cada lado com um baralho real de 30 energias e mão de cinco", () => {
    const state = battle("energy-deck");
    for (const side of state.sides) {
      expect(side.energyHand).toHaveLength(5);
      expect(side.energyDeck).toHaveLength(25);
      const all = [...side.energyHand, ...side.energyDeck];
      for (const element of ELEMENTS) {
        expect(all.filter((card) => card.element === element)).toHaveLength(6);
      }
    }
  });

  it("só anexa cartas presentes na mão e limita dois anexos por turno", () => {
    let state = battle("attachment-limit");
    state = attachElement(state, "player-one", 0, "fire", "attach-1");
    state = attachElement(state, "player-one", 0, "fire", "attach-2");
    const unavailable = getSide(state, "player-one").energyDeck[0];
    expect(() => attachEnergy(state, "player-one", 0, unavailable.id, "attach-3")).toThrow(GameRuleError);
    expect(getActive(getSide(state, "player-one")).attachedEnergy).toHaveLength(2);
    expect(state.turn.sideId).toBe("player-one");
  });

  it("consome energia mesmo quando o ataque falha", () => {
    let state = battle("failed-roll");
    state = attachElement(state, "player-one", 0, "fire", "attach");
    const result = resolveAttack(state, "player-one", "boitata-1", 1, 100, "attack");
    const player = getSide(result.state, "player-one");
    expect(player.team[0].attachedEnergy).toHaveLength(0);
    expect(player.energyDiscard.some((card) => card.element === "fire")).toBe(true);
  });

  it("aplica defesa ao dano e crítico no resultado seis", () => {
    let normal = battle("defense");
    normal = attachElement(normal, "player-one", 0, "fire", "attach-normal");
    const before = getActive(getSide(normal, "warden-aya")).hp;
    const normalResult = resolveAttack(normal, "player-one", "boitata-1", 5, 100, "normal");
    const normalDamage = before - getActive(getSide(normalResult.state, "warden-aya")).hp;
    expect(normalDamage).toBeGreaterThan(0);
    expect(normalDamage).toBeLessThan(22);

    let critical = battle("critical");
    critical = attachElement(critical, "player-one", 0, "fire", "attach-critical");
    const criticalBefore = getActive(getSide(critical, "warden-aya")).hp;
    const criticalResult = resolveAttack(critical, "player-one", "boitata-1", 6, 100, "critical");
    const criticalDamage = criticalBefore - getActive(getSide(criticalResult.state, "warden-aya")).hp;
    expect(criticalDamage).toBeGreaterThan(normalDamage);
    expect(criticalResult.events.some((event) => event.kind === "critical")).toBe(true);
  });

  it("executa efeitos de ataque em vez de deixá-los apenas no texto", () => {
    let state = battle("status-effect");
    state = attachElement(state, "player-one", 0, "fire", "attach");
    const result = resolveAttack(state, "player-one", "boitata-1", 5, 1, "burn");
    const target = getActive(getSide(result.state, "warden-aya"));
    expect(target.statuses.some((status) => status.effect === "burn")).toBe(true);
    expect(result.events.some((event) => event.kind === "status_applied")).toBe(true);
  });

  it("faz a troca voluntária consumir a ação principal e encerrar o turno", () => {
    const state = battle("voluntary-switch");
    const result = switchActiveCreature(state, "player-one", 1, "switch");
    expect(getSide(result.state, "player-one").activeIndex).toBe(1);
    expect(result.state.turn.sideId).toBe("warden-aya");
    expect(() => switchActiveCreature(result.state, "player-one", 2, "switch-again")).toThrow("Aguarde o seu turno.");
  });

  it("exige escolha explícita após derrota e não cobra a ação principal da troca forçada", () => {
    let state = battle("forced-switch");
    state = attachElement(state, "player-one", 0, "fire", "attach");
    getActive(getSide(state, "warden-aya")).hp = 1;
    const defeated = resolveAttack(state, "player-one", "boitata-1", 6, 100, "knockout");
    expect(defeated.state.turn.sideId).toBe("warden-aya");
    expect(defeated.state.turn.phase).toBe("forced_switch");

    const switched = switchActiveCreature(defeated.state, "warden-aya", 1, "forced-choice");
    expect(switched.state.turn.sideId).toBe("warden-aya");
    expect(switched.state.turn.phase).toBe("main");
    expect(switched.events[0].kind).toBe("forced_switch");
  });

  it("bloqueia troca voluntária quando a criatura está enraizada", () => {
    const state = battle("rooted-switch");
    getActive(getSide(state, "player-one")).statuses.push({
      effect: "rooted",
      turns: 1,
      sourceAttackId: "test",
    });
    expect(() => switchActiveCreature(state, "player-one", 1, "switch")).toThrow("enraizada");
  });

  it("oferece a ação de passar para nunca travar um turno", () => {
    const result = passTurn(battle("pass"), "player-one", "pass-action");
    expect(result.state.turn.sideId).toBe("warden-aya");
    expect(result.events.some((event) => event.kind === "passed")).toBe(true);
  });

  it("planeja anexos e ataque da IA a partir das cartas que ela realmente possui", () => {
    const state = battle("npc-plan");
    state.turn.sideId = "warden-aya";
    const side = getSide(state, "warden-aya");
    side.turnsStarted = 1;
    ensureCardInHand(state, side.id, "fire");
    const plan = planNpcTurn(state, side.id);
    expect(plan.attachments.length).toBeLessThanOrEqual(2);
    expect(plan.attackId).toBeTruthy();
  });

  it("rejeita uma ação idempotente já processada", () => {
    let state = battle("idempotency");
    state = attachElement(state, "player-one", 0, "fire", "same-action");
    expect(() => passTurn(state, "player-one", "same-action")).toThrow(GameRuleError);
  });

  it("inicia PVP com dois jogadores, seis criaturas e primeiro turno sorteado no servidor", () => {
    const state = createPvpBattle(
      "00000000-0000-4000-8000-000000000001",
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Ana",
        teamIds: ["boitata", "iara", "curupira", "saci-perere", "black-shuck", "boto-cor-de-rosa"],
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        name: "Beto",
        teamIds: ["fenix", "kelpie", "caipora", "raiju", "domovoi", "carbunclo"],
      },
      () => 0.75,
    );

    expect(state.mode).toBe("pvp");
    expect(state.sides.every((side) => side.kind === "player" && side.team.length === 6)).toBe(true);
    expect(state.turn.sideId).toBe("00000000-0000-4000-8000-000000000003");
  });

  it("impede que o PVP seja criado com o mesmo jogador nos dois lados", () => {
    const setup = {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Ana",
      teamIds: ["boitata", "iara", "curupira", "saci-perere", "black-shuck", "boto-cor-de-rosa"] as const,
    };

    expect(() => createPvpBattle("pvp-self", setup, setup, fixedRandom)).toThrow(GameRuleError);
  });
});
