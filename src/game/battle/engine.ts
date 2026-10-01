import { CREATURES, CREATURE_BY_ID, ELEMENT_META, NPC_TEAM_IDS, STARTER_TEAM_IDS } from "../content";
import type { AttackDefinition, StatusEffect } from "../domain/creatures";
import {
  ELEMENTS,
  elementMultiplier,
  emptyEnergyPool,
  type EnergyCost,
  type EnergyPool,
} from "../domain/elements";
import {
  ATTACHMENTS_PER_TURN,
  DRAW_PER_TURN,
  ENERGY_DECK_SIZE,
  OPENING_HAND_SIZE,
  POWER_DECK_SIZE,
  POWER_DRAWS_PER_TURN,
  MAX_EQUIPPED_POWERS,
  TEAM_SIZE,
  type BattleActionResult,
  type BattleCreature,
  type BattleLogEntry,
  type BattleSide,
  type BattleState,
  type EnergyCard,
  type PowerCard,
  type RandomSource,
} from "./types";

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

function randomIndex(random: RandomSource, length: number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

function shuffled<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(random, index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function createEnergyDeck(
  sideId: string,
  random: RandomSource,
  inventory?: EnergyPool,
): EnergyCard[] {
  const cards: EnergyCard[] = [];
  if (inventory) {
    for (const element of ELEMENTS) {
      const available = Math.max(0, Math.floor(inventory[element] ?? 0));
      for (let copy = 0; copy < available && cards.length < ENERGY_DECK_SIZE; copy += 1) {
        cards.push({
          id: `${sideId}:energy:${element}:${copy + 1}`,
          element,
          origin: "inventory",
          ownerId: sideId,
          zone: "deck",
          attachedTo: null,
          status: "ready",
        });
      }
      if (cards.length >= ENERGY_DECK_SIZE) break;
    }
  } else {
    const copiesPerElement = ENERGY_DECK_SIZE / ELEMENTS.length;
    for (const element of ELEMENTS) {
      for (let copy = 0; copy < copiesPerElement; copy += 1) {
        cards.push({
          id: `${sideId}:energy:${element}:${copy + 1}`,
          element,
          origin: "battle_deck",
          ownerId: sideId,
          zone: "deck",
          attachedTo: null,
          status: "ready",
        });
      }
    }
  }
  return shuffled(cards, random);
}

export function getAttackById(attackId: string): AttackDefinition | null {
  for (const creature of CREATURES) {
    const attack = creature.attacks.find((candidate) => candidate.id === attackId);
    if (attack) return attack;
  }
  return null;
}

function createPowerDeck(
  sideId: string,
  teamIds: readonly string[],
  random: RandomSource,
): PowerCard[] {
  const teamElements = new Set(
    teamIds
      .map((catalogId) => CREATURE_BY_ID.get(catalogId)?.element)
      .filter((element): element is NonNullable<typeof element> => Boolean(element)),
  );
  const candidates = CREATURES
    .filter((creature) => teamElements.has(creature.element))
    .flatMap((creature) => creature.attacks.map((attack) => ({
      attack,
      element: creature.element,
    })));

  if (candidates.length === 0) return [];

  const cards: PowerCard[] = [];
  let copy = 0;
  while (cards.length < POWER_DECK_SIZE) {
    const candidate = candidates[copy % candidates.length];
    cards.push({
      id: `${sideId}:power:${candidate.attack.id}:${Math.floor(copy / candidates.length) + 1}`,
      attackId: candidate.attack.id,
      element: candidate.element,
    });
    copy += 1;
  }
  return shuffled(cards, random);
}

function drawPower(side: BattleSide, count: number): PowerCard[] {
  const drawn: PowerCard[] = [];
  for (let index = 0; index < count; index += 1) {
    if (side.powerDeck.length === 0 && side.powerDiscard.length > 0) {
      side.powerDeck = [...side.powerDiscard].reverse();
      side.powerDiscard = [];
    }
    const card = side.powerDeck.shift();
    if (!card) break;
    side.powerHand.push(card);
    drawn.push(card);
  }
  return drawn;
}

function energyForTeam(teamIds: readonly string[]): EnergyPool {
  const pool = emptyEnergyPool();
  for (const catalogId of teamIds) {
    const definition = CREATURE_BY_ID.get(catalogId);
    if (definition) pool[definition.element] += 12;
  }
  return pool;
}

export function createBattleCreature(catalogId: string, ownerId: string, index: number): BattleCreature {
  const definition = CREATURE_BY_ID.get(catalogId);
  if (!definition) throw new Error(`Criatura desconhecida: ${catalogId}`);
  return {
    instanceId: `${ownerId}:${catalogId}:${index}`,
    catalogId,
    hp: definition.hp,
    maxHp: definition.hp,
    shield: 0,
    attachedEnergy: [],
    statuses: [],
    defeated: false,
    evolutionStage: 0,
    equippedPowerIds: [definition.attacks[0].id],
  };
}

export function createBattleSide(
  id: string,
  name: string,
  kind: BattleSide["kind"],
  teamIds: readonly string[],
  random: RandomSource,
  energyInventory?: EnergyPool,
): BattleSide {
  if (teamIds.length < 1 || teamIds.length > TEAM_SIZE) {
    throw new GameRuleError("Uma equipe de aventura precisa ter entre uma e seis cartas.");
  }
  const deck = createEnergyDeck(id, random, energyInventory);
  const hand = deck.splice(0, OPENING_HAND_SIZE);
  for (const card of hand) card.zone = "hand";
  const powerDeck = createPowerDeck(id, teamIds, random);
  const powerHand = powerDeck.splice(0, 3);
  return {
    id,
    name,
    kind,
    team: teamIds.map((catalogId, index) => createBattleCreature(catalogId, id, index)),
    activeIndex: 0,
    energyDeck: deck,
    energyHand: hand,
    energyDiscard: [],
    attachmentsRemaining: ATTACHMENTS_PER_TURN,
    powerDeck,
    powerHand,
    powerDiscard: [],
    powerDrawsRemaining: POWER_DRAWS_PER_TURN,
    turnsStarted: 0,
  };
}

export type EncounterBattleSetup = {
  mode: Exclude<BattleState["mode"], "pvp">;
  opponentId: string;
  opponentName: string;
  opponentKind?: Extract<BattleSide["kind"], "npc" | "boss">;
  opponentTeamIds: readonly string[];
  playerTeamIds?: readonly string[];
  playerEnergy?: EnergyPool;
  opponentEnergy?: EnergyPool;
  startMessage?: string;
};

export function createEncounterBattle(
  id: string,
  setup: EncounterBattleSetup,
  random: RandomSource = Math.random,
): BattleState {
  const playerId = "player-one";
  const playerTeamIds = setup.playerTeamIds ?? STARTER_TEAM_IDS;
  const player = createBattleSide(
    playerId,
    "Você",
    "player",
    playerTeamIds,
    random,
    setup.playerEnergy,
  );
  const opponent = createBattleSide(
    setup.opponentId,
    setup.opponentName,
    setup.opponentKind ?? "npc",
    setup.opponentTeamIds,
    random,
    setup.opponentEnergy ?? energyForTeam(setup.opponentTeamIds),
  );
  player.turnsStarted = 1;

  return {
    version: 2,
    id,
    mode: setup.mode,
    status: "active",
    turn: { sideId: playerId, phase: "main", number: 1, round: 1 },
    sides: [player, opponent],
    processedActionIds: [],
    log: [
      {
        id: `${id}:start`,
        turn: 1,
        actorId: "system",
        kind: "battle_start",
        message: setup.startMessage
          ?? `${setup.opponentName} entrou na batalha contra ${playerTeamIds.length} carta${playerTeamIds.length === 1 ? "" : "s"} da sua equipe.`,
      },
    ],
  };
}

export function createDemoBattle(
  id = crypto.randomUUID(),
  random: RandomSource = Math.random,
  playerTeamIds: readonly string[] = STARTER_TEAM_IDS,
  playerEnergy?: EnergyPool,
): BattleState {
  return createEncounterBattle(id, {
    mode: "npc",
    opponentId: "warden-aya",
    opponentName: "Guardiã Aya",
    opponentTeamIds: NPC_TEAM_IDS.slice(0, playerTeamIds.length),
    playerTeamIds,
    playerEnergy,
    startMessage: `A Provação das Raízes começou com ${playerTeamIds.length} carta${playerTeamIds.length === 1 ? "" : "s"} de criatura por lado.`,
  }, random);
}

export type PvpPlayerSetup = {
  id: string;
  name: string;
  teamIds: readonly string[];
  energy?: EnergyPool;
};

export function createPvpBattle(
  id: string,
  challenger: PvpPlayerSetup,
  challenged: PvpPlayerSetup,
  random: RandomSource = Math.random,
): BattleState {
  if (challenger.id === challenged.id) {
    throw new GameRuleError("Uma batalha PVP exige dois jogadores diferentes.");
  }

  const sides: [BattleSide, BattleSide] = [
    createBattleSide(challenger.id, challenger.name, "player", challenger.teamIds, random, challenger.energy),
    createBattleSide(challenged.id, challenged.name, "player", challenged.teamIds, random, challenged.energy),
  ];
  const firstIndex = randomIndex(random, sides.length);
  sides[firstIndex].turnsStarted = 1;

  return {
    version: 2,
    id,
    mode: "pvp",
    status: "active",
    turn: { sideId: sides[firstIndex].id, phase: "main", number: 1, round: 1 },
    sides,
    processedActionIds: [],
    log: [{
      id: `${id}:start`,
      turn: 1,
      actorId: "system",
      kind: "battle_start",
      message: `${challenger.name} e ${challenged.name} iniciaram um duelo com equipes de seis criaturas.`,
    }],
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

export function energyPoolFor(cards: readonly EnergyCard[]): EnergyPool {
  const pool = emptyEnergyPool();
  for (const card of cards) pool[card.element] += 1;
  return pool;
}

export function canPayCost(cards: readonly EnergyCard[], cost: EnergyCost): boolean {
  const pool = energyPoolFor(cards);
  return ELEMENTS.every((element) => pool[element] >= (cost[element] ?? 0));
}

function evolutionStage(creature: BattleCreature) {
  return creature.evolutionStage ?? 0;
}

function sameElementEnergyCount(creature: BattleCreature): number {
  const definition = getDefinition(creature);
  return creature.attachedEnergy.filter((card) => card.element === definition.element).length;
}

export function canEvolveActiveCreature(state: BattleState, sideId: string): boolean {
  if (state.status !== "active" || state.turn.sideId !== sideId || state.turn.phase !== "main") return false;
  const side = getSide(state, sideId);
  const active = getActive(side);
  return !active.defeated
    && evolutionStage(active) === 0
    && state.turn.round >= 2
    && sameElementEnergyCount(active) >= 2;
}

function spendMatchingEnergy(side: BattleSide, creature: BattleCreature, amount: number) {
  const definition = getDefinition(creature);
  for (let count = 0; count < amount; count += 1) {
    const index = creature.attachedEnergy.findIndex((card) => card.element === definition.element);
    if (index < 0) throw new GameRuleError(`São necessárias ${amount} Energias de ${ELEMENT_META[definition.element].name} para evoluir.`);
    const [spent] = creature.attachedEnergy.splice(index, 1);
    spent.zone = "discard";
    spent.attachedTo = null;
    spent.status = "spent";
    side.energyDiscard.push(spent);
  }
}

function terrainMultiplier(state: BattleState, attacker: BattleCreature): number {
  const terrain = state.terrain;
  if (!terrain) return 1;
  return terrain.element === getDefinition(attacker).element ? 1.15 : 1;
}

function evolvedDamageMultiplier(creature: BattleCreature): number {
  return evolutionStage(creature) === 1 ? 1.12 : 1;
}

function evolvedDefenseBonus(creature: BattleCreature): number {
  return evolutionStage(creature) === 1 ? 10 : 0;
}

function signatureAttack(attack: AttackDefinition): boolean {
  return ELEMENTS.reduce((total, element) => total + (attack.cost[element] ?? 0), 0) >= 3;
}

function activateTerrain(
  state: BattleState,
  sideId: string,
  element: (typeof ELEMENTS)[number],
  events: Omit<BattleLogEntry, "id" | "turn">[],
) {
  state.terrain = {
    element,
    sourceSideId: sideId,
    activatedTurn: state.turn.number,
    expiresAfterTurn: state.turn.number + 3,
  };
  events.push({
    actorId: sideId,
    kind: "terrain_activated",
    terrainElement: element,
    terrainTurns: 3,
    message: `O terreno de ${ELEMENT_META[element].name} tomou conta da arena por 3 turnos.`,
  });
}

function expireTerrainIfNeeded(
  state: BattleState,
  events: Omit<BattleLogEntry, "id" | "turn">[],
) {
  if (!state.terrain || state.turn.number <= state.terrain.expiresAfterTurn) return;
  const expired = state.terrain;
  state.terrain = undefined;
  events.push({
    actorId: "system",
    kind: "terrain_expired",
    terrainElement: expired.element,
    message: `O terreno de ${ELEMENT_META[expired.element].name} se dissipou.`,
  });
}

function appendEvents(
  state: BattleState,
  actionId: string,
  events: Omit<BattleLogEntry, "id" | "turn">[],
): BattleLogEntry[] {
  const entries = events.map((event, index) => ({
    ...event,
    id: `${actionId}:${index}`,
    turn: state.turn.number,
  }));
  state.log.push(...entries);
  state.log = state.log.slice(-120);
  return entries;
}

function assertAction(state: BattleState, sideId: string, actionId: string) {
  if (state.status !== "active") throw new GameRuleError("A batalha já terminou.");
  if (state.turn.sideId !== sideId) throw new GameRuleError("Aguarde o seu turno.");
  if (state.processedActionIds.includes(actionId)) throw new GameRuleError("Esta ação já foi processada.");
}

function assertMainPhase(state: BattleState) {
  if (state.turn.phase !== "main") {
    throw new GameRuleError("Escolha uma criatura disponível antes de continuar o turno.");
  }
}

function completeAction(state: BattleState, actionId: string) {
  state.processedActionIds.push(actionId);
  state.processedActionIds = state.processedActionIds.slice(-80);
}

function hasStatus(creature: BattleCreature, effect: StatusEffect): boolean {
  return creature.statuses.some((status) => status.effect === effect && status.turns > 0);
}

function expireActingStatuses(creature: BattleCreature) {
  creature.statuses = creature.statuses
    .map((status) => ({ ...status, turns: status.turns - 1 }))
    .filter((status) => status.turns > 0);
}

function discardAttachedEnergy(side: BattleSide, creature: BattleCreature) {
  for (const card of creature.attachedEnergy) {
    card.zone = "discard";
    card.attachedTo = null;
    card.status = "spent";
    side.energyDiscard.push(card);
  }
  creature.attachedEnergy = [];
}

function drawEnergy(side: BattleSide, count: number): EnergyCard[] {
  const drawn: EnergyCard[] = [];
  for (let index = 0; index < count; index += 1) {
    if (side.energyDeck.length === 0 && side.energyDiscard.length > 0) {
      side.energyDeck = [...side.energyDiscard].reverse();
      side.energyDiscard = [];
      for (const recycled of side.energyDeck) {
        recycled.zone = "deck";
        recycled.attachedTo = null;
        recycled.status = "ready";
      }
    }
    const card = side.energyDeck.shift();
    if (!card) break;
    card.zone = "hand";
    card.attachedTo = null;
    card.status = "ready";
    side.energyHand.push(card);
    drawn.push(card);
  }
  return drawn;
}

function markDefeated(
  state: BattleState,
  defeatedSide: BattleSide,
  winner: BattleSide,
  creature: BattleCreature,
  events: Omit<BattleLogEntry, "id" | "turn">[],
) {
  creature.hp = 0;
  creature.defeated = true;
  creature.shield = 0;
  creature.statuses = [];
  discardAttachedEnergy(defeatedSide, creature);
  events.push({
    actorId: winner.id,
    kind: "defeated",
    message: `${getDefinition(creature).name} foi derrotado; suas energias anexadas foram descartadas.`,
  });
  if (defeatedSide.team.every((candidate) => candidate.defeated)) {
    state.status = "finished";
    state.winnerId = winner.id;
    events.push({
      actorId: winner.id,
      kind: "battle_end",
      message: `${winner.name} venceu a batalha com sua equipe de seis cartas.`,
    });
  }
}

function beginTurn(state: BattleState, side: BattleSide, forcedSwitch: boolean, actionId: string) {
  side.attachmentsRemaining = ATTACHMENTS_PER_TURN;
  side.powerDrawsRemaining = POWER_DRAWS_PER_TURN;
  const shouldDraw = side.turnsStarted > 0;
  side.turnsStarted += 1;
  const drawn = shouldDraw ? drawEnergy(side, DRAW_PER_TURN) : [];
  const events: Omit<BattleLogEntry, "id" | "turn">[] = [];
  expireTerrainIfNeeded(state, events);
  events.push({
    actorId: side.id,
    kind: "turn_started",
    message: `Turno de ${side.name}.`,
  });
  if (drawn.length > 0) {
    for (const card of drawn) {
      events.push({
        actorId: side.id,
        kind: "energy_drawn",
        energyCardId: card.id,
        energyElement: card.element,
        message: `${side.name} comprou uma Energia de ${ELEMENT_META[card.element].name}.`,
      });
    }
  }

  const active = getActive(side);
  const burn = active.statuses.find((status) => status.effect === "burn");
  if (burn && !active.defeated) {
    const damage = burn.amount ?? 7;
    active.hp = Math.max(0, active.hp - damage);
    events.push({
      actorId: side.id,
      kind: "status_tick",
      damage,
      effect: "burn",
      message: `${getDefinition(active).name} sofreu ${damage} de dano de queimadura.`,
    });
    if (active.hp === 0) {
      markDefeated(state, side, getOpponent(state, side.id), active, events);
      forcedSwitch = state.status === "active";
    }
  }

  state.turn.phase = forcedSwitch ? "forced_switch" : "main";
  return appendEvents(state, actionId, events);
}

function advanceTurn(state: BattleState, nextSide: BattleSide, forcedSwitch: boolean, actionId: string) {
  const actingSide = getSide(state, state.turn.sideId);
  expireActingStatuses(getActive(actingSide));
  const previousIndex = state.sides.findIndex((side) => side.id === state.turn.sideId);
  const nextIndex = state.sides.findIndex((side) => side.id === nextSide.id);
  state.turn.number += 1;
  if (nextIndex <= previousIndex) state.turn.round += 1;
  state.turn.sideId = nextSide.id;
  return beginTurn(state, nextSide, forcedSwitch, actionId);
}

export function attachEnergy(
  input: BattleState,
  sideId: string,
  creatureIndex: number,
  cardId: string,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  assertMainPhase(state);
  const side = getSide(state, sideId);
  const creature = side.team[creatureIndex];
  const cardIndex = side.energyHand.findIndex((card) => card.id === cardId);
  if (!creature || creature.defeated) throw new GameRuleError("Escolha uma carta de criatura disponível.");
  if (side.attachmentsRemaining < 1) throw new GameRuleError("O limite normal é de uma Energia anexada por turno.");
  if (cardIndex < 0) throw new GameRuleError("Essa carta de energia não está na sua mão.");

  const [card] = side.energyHand.splice(cardIndex, 1);
  card.zone = "attached";
  card.attachedTo = creature.instanceId;
  card.status = "ready";
  creature.attachedEnergy.push(card);
  side.attachmentsRemaining -= 1;
  const events = appendEvents(state, actionId, [{
    actorId: sideId,
    kind: "energy_attached",
    energyCardId: card.id,
    energyElement: card.element,
    creatureIndex,
    message: `${side.name} anexou Energia de ${ELEMENT_META[card.element].name} a ${getDefinition(creature).name}.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

export function drawPowerCard(
  input: BattleState,
  sideId: string,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  assertMainPhase(state);
  const side = getSide(state, sideId);
  if (side.powerDrawsRemaining < 1) {
    throw new GameRuleError("Você já comprou uma Carta de Poder neste turno.");
  }
  const [card] = drawPower(side, 1);
  if (!card) throw new GameRuleError("O Baralho de Poder está vazio.");
  side.powerDrawsRemaining -= 1;
  const attack = getAttackById(card.attackId);
  const events = appendEvents(state, actionId, [{
    actorId: sideId,
    kind: "power_drawn",
    powerCardId: card.id,
    attackId: card.attackId,
    message: `${side.name} comprou a Carta de Poder ${attack?.name ?? card.attackId}.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

export function equipPowerCard(
  input: BattleState,
  sideId: string,
  creatureIndex: number,
  cardId: string,
  slot: number | undefined,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  assertMainPhase(state);
  const side = getSide(state, sideId);
  const creature = side.team[creatureIndex];
  if (!creature || creature.defeated) throw new GameRuleError("Escolha uma criatura disponível.");
  const cardIndex = side.powerHand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new GameRuleError("Essa Carta de Poder não está na sua mão.");

  const card = side.powerHand[cardIndex];
  const definition = getDefinition(creature);
  const attack = getAttackById(card.attackId);
  if (!attack) throw new GameRuleError("A Carta de Poder não possui um ataque válido.");
  if (card.element !== definition.element) {
    throw new GameRuleError(`Este poder exige uma criatura de ${ELEMENT_META[card.element].name}.`);
  }
  if (creature.equippedPowerIds.includes(card.attackId)) {
    throw new GameRuleError("Esta criatura já possui esse poder.");
  }

  let targetSlot = slot;
  if (creature.equippedPowerIds.length < MAX_EQUIPPED_POWERS) {
    targetSlot = creature.equippedPowerIds.length;
  } else if (targetSlot === undefined || targetSlot < 0 || targetSlot >= MAX_EQUIPPED_POWERS) {
    throw new GameRuleError("Escolha qual dos quatro poderes será substituído.");
  }

  const [spentCard] = side.powerHand.splice(cardIndex, 1);
  side.powerDiscard.push(spentCard);
  creature.equippedPowerIds[targetSlot] = card.attackId;

  const events = appendEvents(state, actionId, [{
    actorId: sideId,
    kind: "power_equipped",
    powerCardId: card.id,
    powerSlot: targetSlot,
    attackId: card.attackId,
    creatureIndex,
    message: `${definition.name} aprendeu ${attack.name} no espaço ${targetSlot + 1}.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

function payCost(side: BattleSide, creature: BattleCreature, cost: EnergyCost) {
  if (!canPayCost(creature.attachedEnergy, cost)) throw new GameRuleError("A carta ativa não possui as energias exigidas.");
  const remaining = [...creature.attachedEnergy];
  for (const element of ELEMENTS) {
    const amount = cost[element] ?? 0;
    for (let count = 0; count < amount; count += 1) {
      const index = remaining.findIndex((card) => card.element === element);
      const [spent] = remaining.splice(index, 1);
      spent.zone = "discard";
      spent.attachedTo = null;
      spent.status = "spent";
      side.energyDiscard.push(spent);
    }
  }
  creature.attachedEnergy = remaining;
}

function applyDamage(target: BattleCreature, amount: number): number {
  const absorbed = Math.min(target.shield, amount);
  target.shield -= absorbed;
  const healthDamage = amount - absorbed;
  target.hp = Math.max(0, target.hp - healthDamage);
  return healthDamage;
}

function applyEffect(
  attacker: BattleCreature,
  defender: BattleCreature,
  attack: AttackDefinition,
  effectRoll: number,
  actorId: string,
  events: Omit<BattleLogEntry, "id" | "turn">[],
) {
  const effect = attack.effect;
  if (!effect || effectRoll > (effect.chance ?? 100)) return;
  if (effect.type === "heal") {
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + (effect.amount ?? 0));
    const healed = attacker.hp - before;
    if (healed > 0) events.push({ actorId, kind: "healed", effect: "heal", message: `${getDefinition(attacker).name} recuperou ${healed} PV.` });
    return;
  }
  if (effect.type === "shield") {
    const amount = effect.amount ?? 0;
    attacker.shield += amount;
    events.push({ actorId, kind: "shielded", effect: "shield", message: `${getDefinition(attacker).name} recebeu ${amount} de escudo.` });
    return;
  }

  const target = effect.type === "warded" ? attacker : defender;
  target.statuses = target.statuses.filter((status) => status.effect !== effect.type);
  target.statuses.push({
    effect: effect.type,
    turns: effect.duration ?? 1,
    amount: effect.amount,
    sourceAttackId: attack.id,
  });
  events.push({
    actorId,
    kind: "status_applied",
    effect: effect.type,
    message: `${getDefinition(target).name} recebeu o estado ${effect.type}.`,
  });
}

export function evolveActiveCreature(
  input: BattleState,
  sideId: string,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  assertMainPhase(state);
  const side = getSide(state, sideId);
  const creature = getActive(side);
  const definition = getDefinition(creature);
  if (creature.defeated) throw new GameRuleError("Uma criatura derrotada não pode evoluir.");
  if (evolutionStage(creature) > 0) throw new GameRuleError("Esta criatura já evoluiu nesta batalha.");
  if (state.turn.round < 2) throw new GameRuleError("A Evolução só fica disponível a partir da segunda rodada.");
  if (sameElementEnergyCount(creature) < 2) {
    throw new GameRuleError(`Anexe duas Energias de ${ELEMENT_META[definition.element].name} para evoluir.`);
  }

  const staged: Omit<BattleLogEntry, "id" | "turn">[] = [{
    actorId: sideId,
    kind: "evolution_started",
    creatureIndex: side.activeIndex,
    evolutionStage: 0,
    message: `${definition.name} iniciou sua Evolução de Vínculo.`,
  }];

  spendMatchingEnergy(side, creature, 2);
  const previousMax = creature.maxHp;
  const bonus = Math.max(18, Math.floor(definition.hp * 0.25));
  creature.evolutionStage = 1;
  creature.maxHp = previousMax + bonus;
  creature.hp = Math.min(creature.maxHp, creature.hp + bonus);
  creature.shield += 12;

  staged.push({
    actorId: sideId,
    kind: "evolution_completed",
    creatureIndex: side.activeIndex,
    evolutionStage: 1,
    message: `${definition.name} evoluiu: +${bonus} PV máximos, 12 de escudo e poder ampliado.`,
  });

  const events = appendEvents(state, actionId, staged);
  completeAction(state, actionId);
  return { state, events };
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
  const current = getActive(side);
  const next = side.team[nextIndex];
  if (!next || next.defeated) throw new GameRuleError("Essa carta não pode entrar em campo.");
  if (nextIndex === side.activeIndex) throw new GameRuleError("Essa carta já está ativa.");
  const forced = state.turn.phase === "forced_switch";
  if (!forced && hasStatus(current, "rooted")) throw new GameRuleError("A carta ativa está enraizada e não pode ser trocada neste turno.");

  side.activeIndex = nextIndex;
  const events = appendEvents(state, actionId, [{
    actorId: sideId,
    kind: forced ? "forced_switch" : "creature_switched",
    message: forced
      ? `${side.name} escolheu ${getDefinition(next).name} para continuar a batalha.`
      : `${side.name} colocou ${getDefinition(next).name} em campo e encerrou o turno.`,
  }]);
  completeAction(state, actionId);
  if (forced) {
    state.turn.phase = "main";
    return { state, events };
  }
  const turnEvents = advanceTurn(state, getOpponent(state, sideId), false, `${actionId}:turn`);
  return { state, events: [...events, ...turnEvents] };
}

export function resolveAttack(
  input: BattleState,
  sideId: string,
  attackId: string,
  die: number,
  effectRoll: number,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  assertMainPhase(state);
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new GameRuleError("Resultado de dado inválido.");
  if (!Number.isInteger(effectRoll) || effectRoll < 1 || effectRoll > 100) throw new GameRuleError("Resultado de efeito inválido.");

  const side = getSide(state, sideId);
  const opponent = getOpponent(state, sideId);
  const attacker = getActive(side);
  const defender = getActive(opponent);
  const attackerDefinition = getDefinition(attacker);
  const defenderDefinition = getDefinition(defender);
  if (!attacker.equippedPowerIds.includes(attackId)) {
    throw new GameRuleError("Esse poder não está equipado na criatura ativa.");
  }
  const selectedAttack = getAttackById(attackId);
  if (!selectedAttack) throw new GameRuleError("Ataque inválido para a criatura ativa.");
  payCost(side, attacker, selectedAttack.cost);

  const shockedPenalty = hasStatus(attacker, "shocked") ? 1 : 0;
  const speedDelta = attackerDefinition.speed - defenderDefinition.speed;
  const speedModifier = speedDelta >= 30 ? -1 : speedDelta <= -30 ? 1 : 0;
  const requiredRoll = Math.max(2, Math.min(6, selectedAttack.minRoll + shockedPenalty + speedModifier));
  const success = die >= requiredRoll;
  const critical = die === 6 && success;
  const staged: Omit<BattleLogEntry, "id" | "turn">[] = [];

  if (!success) {
    staged.push({
      actorId: sideId,
      kind: "attack_miss",
      attackId,
      die,
      damage: 0,
      message: `${attackerDefinition.name} falhou ao usar ${selectedAttack.name}. As energias foram descartadas.`,
    });
  } else {
    let multiplier = elementMultiplier(attackerDefinition.element, defenderDefinition.element)
      * terrainMultiplier(state, attacker)
      * evolvedDamageMultiplier(attacker);
    if (attackerDefinition.element === "storm" && hasStatus(defender, "soaked")) {
      multiplier *= 1.25;
      defender.statuses = defender.statuses.filter((status) => status.effect !== "soaked");
    }
    if (hasStatus(attacker, "haunted")) multiplier *= 0.85;
    if (hasStatus(defender, "warded")) multiplier *= 0.8;
    const effectiveDefense = defenderDefinition.defense + evolvedDefenseBonus(defender);
    const defenseFactor = 100 / (100 + effectiveDefense * 0.35);
    const rawDamage = Math.max(1, Math.floor(selectedAttack.damage * multiplier * defenseFactor * (critical ? 1.5 : 1)));
    const damage = applyDamage(defender, rawDamage);
    staged.push({
      actorId: sideId,
      kind: critical ? "critical" : "attack_hit",
      attackId,
      die,
      damage,
      message: critical
        ? `Acerto crítico! ${attackerDefinition.name} causou ${damage} de dano com ${selectedAttack.name}.`
        : `${attackerDefinition.name} causou ${damage} de dano com ${selectedAttack.name}.`,
    });
    if (defender.hp === 0) markDefeated(state, opponent, side, defender, staged);
    else applyEffect(attacker, defender, selectedAttack, effectRoll, sideId, staged);
    if (signatureAttack(selectedAttack) && state.status === "active") {
      activateTerrain(state, sideId, attackerDefinition.element, staged);
    }
  }

  const events = appendEvents(state, actionId, staged);
  completeAction(state, actionId);
  if (state.status === "finished") return { state, events };
  const forcedSwitch = defender.defeated;
  const turnEvents = advanceTurn(state, opponent, forcedSwitch, `${actionId}:turn`);
  return { state, events: [...events, ...turnEvents] };
}

export function concedeBattle(
  input: BattleState,
  sideId: string,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  if (state.status !== "active") throw new GameRuleError("A batalha já terminou.");
  if (state.processedActionIds.includes(actionId)) throw new GameRuleError("Esta ação já foi processada.");
  const side = getSide(state, sideId);
  const opponent = getOpponent(state, sideId);
  state.status = "finished";
  state.winnerId = opponent.id;
  const events = appendEvents(state, actionId, [
    {
      actorId: sideId,
      kind: "conceded",
      message: `${side.name} desistiu da batalha.`,
    },
    {
      actorId: opponent.id,
      kind: "battle_end",
      message: `${opponent.name} venceu por desistência.`,
    },
  ]);
  completeAction(state, actionId);
  return { state, events };
}

export function passTurn(input: BattleState, sideId: string, actionId: string): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  assertMainPhase(state);
  const side = getSide(state, sideId);
  const events = appendEvents(state, actionId, [{
    actorId: sideId,
    kind: "passed",
    message: `${side.name} encerrou o turno sem usar uma ação principal.`,
  }]);
  completeAction(state, actionId);
  const turnEvents = advanceTurn(state, getOpponent(state, sideId), false, `${actionId}:turn`);
  return { state, events: [...events, ...turnEvents] };
}

