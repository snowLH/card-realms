import {
  CREATURE_BY_ID,
  ELEMENT_META,
  NPC_TEAM_IDS,
  STARTER_TEAM_IDS,
  emptyEnergyPool,
} from "./catalog";
import {
  ELEMENTS,
  type AttackDefinition,
  type BattleActionResult,
  type BattleCreature,
  type BattleLogEntry,
  type BattleSide,
  type BattleState,
  type Element,
  type EnergyCost,
  type EnergyPool,
} from "./types";

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

export const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  fire: "ice",
  ice: "nature",
  nature: "electric",
  electric: "water",
  water: "fire",
  shadow: "neutral",
  neutral: "shadow",
};

const initialAvailable = (): EnergyPool => ({
  fire: 2,
  water: 2,
  nature: 2,
  electric: 2,
  ice: 2,
  shadow: 2,
  neutral: 2,
});

const initialReserve = (): EnergyPool => ({
  fire: 4,
  water: 4,
  nature: 4,
  electric: 4,
  ice: 4,
  shadow: 4,
  neutral: 4,
});

const makeBattleCreature = (catalogId: string, ownerId: string, index: number): BattleCreature => {
  const definition = CREATURE_BY_ID.get(catalogId);
  if (!definition) throw new Error(`Criatura desconhecida: ${catalogId}`);

  return {
    instanceId: `${ownerId}:${catalogId}:${index}`,
    catalogId,
    hp: definition.hp,
    maxHp: definition.hp,
    attachedEnergy: emptyEnergyPool(),
    statuses: [],
    defeated: false,
  };
};

const makeSide = (
  id: string,
  name: string,
  kind: BattleSide["kind"],
  teamIds: readonly [string, string, string, string, string, string],
): BattleSide => ({
  id,
  name,
  kind,
  team: teamIds.map((catalogId, index) =>
    makeBattleCreature(catalogId, id, index),
  ) as BattleSide["team"],
  activeIndex: 0,
  energyAvailable: initialAvailable(),
  energyReserve: initialReserve(),
  acquiredThisTurn: 0,
  attachmentsThisTurn: 0,
  discard: emptyEnergyPool(),
});

export function createDemoBattle(id = crypto.randomUUID()): BattleState {
  const playerId = "player-one";
  const npcId = "warden-aya";

  return {
    id,
    mode: "npc",
    status: "active",
    round: 1,
    turnNumber: 1,
    currentSideId: playerId,
    sides: [
      makeSide(playerId, "Você", "player", STARTER_TEAM_IDS),
      makeSide(npcId, "Guardiã Aya", "npc", NPC_TEAM_IDS),
    ],
    processedActionIds: [],
    log: [
      {
        id: `${id}:start`,
        turn: 1,
        actorId: "system",
        kind: "battle_start",
        message: "A Provação das Raízes começou. Escolha energias e prepare sua carta ativa.",
      },
    ],
  };
}

export function getSide(state: BattleState, sideId: string): BattleSide {
  const side = state.sides.find((candidate) => candidate.id === sideId);
  if (!side) throw new GameRuleError("Participante não encontrado.");
  return side;
}

export function getOpponent(state: BattleState, sideId: string): BattleSide {
  const side = state.sides.find((candidate) => candidate.id !== sideId);
  if (!side) throw new GameRuleError("Adversário não encontrado.");
  return side;
}

export function getActive(side: BattleSide): BattleCreature {
  return side.team[side.activeIndex];
}

export function getDefinition(creature: BattleCreature) {
  const definition = CREATURE_BY_ID.get(creature.catalogId);
  if (!definition) throw new GameRuleError("Carta de criatura inválida.");
  return definition;
}

export function energyTotal(pool: EnergyPool): number {
  return ELEMENTS.reduce((total, element) => total + pool[element], 0);
}

export function canPayCost(pool: EnergyPool, cost: EnergyCost): boolean {
  return ELEMENTS.every((element) => pool[element] >= (cost[element] ?? 0));
}

function appendEvents(
  state: BattleState,
  actionId: string,
  events: Omit<BattleLogEntry, "id" | "turn">[],
): BattleLogEntry[] {
  const entries = events.map((event, index) => ({
    ...event,
    id: `${actionId}:${index}`,
    turn: state.turnNumber,
  }));
  state.log.push(...entries);
  return entries;
}

function assertAction(state: BattleState, sideId: string, actionId: string) {
  if (state.status !== "active") throw new GameRuleError("A batalha já terminou.");
  if (state.currentSideId !== sideId) throw new GameRuleError("Aguarde o seu turno.");
  if (state.processedActionIds.includes(actionId)) {
    throw new GameRuleError("Esta ação já foi processada.");
  }
}

function completeAction(state: BattleState, actionId: string) {
  state.processedActionIds.push(actionId);
  state.processedActionIds = state.processedActionIds.slice(-80);
}

export function acquireEnergy(
  input: BattleState,
  sideId: string,
  choices: Element[],
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  const side = getSide(state, sideId);

  if (choices.length < 1 || choices.length > 2) {
    throw new GameRuleError("Escolha uma ou duas energias.");
  }
  if (side.acquiredThisTurn + choices.length > 2) {
    throw new GameRuleError("O limite é de duas energias adquiridas por turno.");
  }

  for (const element of choices) {
    if (side.energyReserve[element] < 1) {
      throw new GameRuleError(`Não há mais Energia de ${ELEMENT_META[element].name} na reserva.`);
    }
  }

  for (const element of choices) {
    side.energyReserve[element] -= 1;
    side.energyAvailable[element] += 1;
  }
  side.acquiredThisTurn += choices.length;

  const grouped = choices
    .map((element) => ELEMENT_META[element].name)
    .join(" e ");
  const events = appendEvents(state, actionId, [
    {
      actorId: sideId,
      kind: "energy_acquired",
      message: `${side.name} trouxe Energia de ${grouped} da reserva.`,
    },
  ]);
  completeAction(state, actionId);
  return { state, events };
}

export function attachEnergy(
  input: BattleState,
  sideId: string,
  creatureIndex: number,
  element: Element,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  const side = getSide(state, sideId);
  const creature = side.team[creatureIndex];

  if (!creature || creature.defeated) {
    throw new GameRuleError("Escolha uma carta de criatura disponível.");
  }
  if (side.attachmentsThisTurn >= 2) {
    throw new GameRuleError("Você pode vincular até duas energias por turno.");
  }
  if (side.energyAvailable[element] < 1) {
    throw new GameRuleError(`Você não possui Energia de ${ELEMENT_META[element].name} disponível.`);
  }

  side.energyAvailable[element] -= 1;
  creature.attachedEnergy[element] += 1;
  side.attachmentsThisTurn += 1;
  const definition = getDefinition(creature);
  const events = appendEvents(state, actionId, [
    {
      actorId: sideId,
      kind: "energy_attached",
      message: `${side.name} vinculou Energia de ${ELEMENT_META[element].name} a ${definition.name}.`,
    },
  ]);
  completeAction(state, actionId);
  return { state, events };
}

function payCost(side: BattleSide, creature: BattleCreature, cost: EnergyCost) {
  if (!canPayCost(creature.attachedEnergy, cost)) {
    throw new GameRuleError("A carta ativa não possui as energias exigidas.");
  }

  for (const element of ELEMENTS) {
    const amount = cost[element] ?? 0;
    creature.attachedEnergy[element] -= amount;
    side.discard[element] += amount;
  }
}

function multiplierFor(attacker: Element, defender: Element): number {
  if (ELEMENT_ADVANTAGE[attacker] === defender) return 1.25;
  if (ELEMENT_ADVANTAGE[defender] === attacker) return 0.8;
  return 1;
}

function startNextTurn(state: BattleState, nextSide: BattleSide) {
  const previousSideIndex = state.sides.findIndex((side) => side.id === state.currentSideId);
  const nextSideIndex = state.sides.findIndex((side) => side.id === nextSide.id);
  if (nextSideIndex <= previousSideIndex) state.round += 1;
  state.turnNumber += 1;
  state.currentSideId = nextSide.id;
  nextSide.acquiredThisTurn = 0;
  nextSide.attachmentsThisTurn = 0;

  // Long battles never become permanently stuck: after exhausting the full
  // reserve and the available pool, two discarded energies return to hand.
  if (energyTotal(nextSide.energyReserve) === 0 && energyTotal(nextSide.energyAvailable) === 0) {
    let recovered = 0;
    for (const element of ELEMENTS) {
      while (nextSide.discard[element] > 0 && recovered < 2) {
        nextSide.discard[element] -= 1;
        nextSide.energyAvailable[element] += 1;
        recovered += 1;
      }
    }
  }
}

export function switchActiveCreature(
  input: BattleState,
  sideId: string,
  nextIndex: number,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  const side = getSide(state, sideId);
  const next = side.team[nextIndex];
  if (!next || next.defeated) throw new GameRuleError("Essa carta não pode entrar em campo.");
  if (nextIndex === side.activeIndex) throw new GameRuleError("Essa carta já está ativa.");

  side.activeIndex = nextIndex;
  const definition = getDefinition(next);
  const events = appendEvents(state, actionId, [
    {
      actorId: sideId,
      kind: "creature_switched",
      message: `${side.name} colocou ${definition.name} em campo.`,
    },
  ]);
  completeAction(state, actionId);
  startNextTurn(state, getOpponent(state, sideId));
  return { state, events };
}

export function resolveAttack(
  input: BattleState,
  sideId: string,
  attackId: string,
  die: number,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  if (!Number.isInteger(die) || die < 1 || die > 6) {
    throw new GameRuleError("Resultado de dado inválido.");
  }

  const side = getSide(state, sideId);
  const opponent = getOpponent(state, sideId);
  const attacker = getActive(side);
  const defender = getActive(opponent);
  const attackerDefinition = getDefinition(attacker);
  const defenderDefinition = getDefinition(defender);
  const selectedAttack = attackerDefinition.attacks.find((candidate) => candidate.id === attackId);
  if (!selectedAttack) throw new GameRuleError("Ataque inválido para a carta ativa.");

  payCost(side, attacker, selectedAttack.cost);
  const success = die >= selectedAttack.minRoll;
  const critical = die === 6 && success;
  let damage = 0;
  const stagedEvents: Omit<BattleLogEntry, "id" | "turn">[] = [];

  if (!success) {
    stagedEvents.push({
      actorId: sideId,
      kind: "attack_miss",
      attackId,
      die,
      damage: 0,
      message: `${attackerDefinition.name} falhou ao usar ${selectedAttack.name}. As energias foram descartadas.`,
    });
  } else {
    const elemental = multiplierFor(attackerDefinition.element, defenderDefinition.element);
    damage = Math.max(1, Math.floor(selectedAttack.damage * elemental * (critical ? 1.5 : 1)));
    defender.hp = Math.max(0, defender.hp - damage);
    stagedEvents.push({
      actorId: sideId,
      kind: critical ? "critical" : "attack_hit",
      attackId,
      die,
      damage,
      message: critical
        ? `Acerto crítico! ${attackerDefinition.name} causou ${damage} de dano com ${selectedAttack.name}.`
        : `${attackerDefinition.name} causou ${damage} de dano com ${selectedAttack.name}.`,
    });

    if (defender.hp === 0) {
      defender.defeated = true;
      stagedEvents.push({
        actorId: sideId,
        kind: "defeated",
        damage,
        message: `${defenderDefinition.name} foi derrotado e sua carta ficou indisponível.`,
      });

      if (opponent.team.every((creature) => creature.defeated)) {
        state.status = "finished";
        state.winnerId = sideId;
        stagedEvents.push({
          actorId: sideId,
          kind: "battle_end",
          message: `${side.name} venceu a batalha com sua equipe de seis cartas.`,
        });
      } else {
        opponent.activeIndex = opponent.team.findIndex((creature) => !creature.defeated);
      }
    }
  }

  const events = appendEvents(state, actionId, stagedEvents);
  completeAction(state, actionId);
  if (state.status === "active") startNextTurn(state, opponent);
  return { state, events };
}

export function chooseNpcMove(state: BattleState, sideId: string): {
  energyToAttach?: Element;
  attack?: AttackDefinition;
} {
  const side = getSide(state, sideId);
  const active = getActive(side);
  const definition = getDefinition(active);
  const affordable = definition.attacks
    .filter((candidate) => canPayCost(active.attachedEnergy, candidate.cost))
    .sort((a, b) => b.damage - a.damage);
  if (affordable[0]) return { attack: affordable[0] };

  const desired = definition.element;
  if (side.energyAvailable[desired] > 0) return { energyToAttach: desired };
  return {};
}
