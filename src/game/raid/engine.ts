import { CREATURE_BY_ID, ELEMENT_META } from "../content";
import {
  ATTACHMENTS_PER_TURN,
  DRAW_PER_TURN,
  MAX_EQUIPPED_POWERS,
  POWER_DRAWS_PER_TURN,
  type BattleCreature,
  type BattleSide,
  type EnergyCard,
  type PowerCard,
  type RandomSource,
} from "../battle/types";
import {
  canPayCost,
  createBattleSide,
  getActive,
  getAttackById,
  getDefinition,
} from "../battle/engine";
import { ELEMENTS, elementMultiplier, type Element, type EnergyCost } from "../domain/elements";
import { RAID_BOSS_ATTACKS, RAID_PHASE_NAMES } from "./content";
import {
  RAID_BOSS_ID,
  RAID_MAX_PLAYERS,
  RAID_MIN_PLAYERS,
  type RaidActionResult,
  type RaidBossSetup,
  type RaidContribution,
  type RaidLogEntry,
  type RaidPhase,
  type RaidPlayerSetup,
  type RaidPlayerState,
  type RaidState,
} from "./types";

export class RaidRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaidRuleError";
  }
}

const emptyContribution = (): RaidContribution => ({
  actions: 0,
  damage: 0,
  healing: 0,
  shield: 0,
  buffs: 0,
  debuffs: 0,
  terrain: 0,
});

function playerFor(state: RaidState, playerId: string): RaidPlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new RaidRuleError("Jogador não participa desta Raid.");
  return player;
}

function alivePlayers(state: RaidState) {
  return state.players.filter((player) => !player.eliminated);
}

function actorKind(actorId: string): "player" | "boss" {
  return actorId === RAID_BOSS_ID ? "boss" : "player";
}

function activeSpeed(player: RaidPlayerState) {
  const active = getActive(player.side);
  return getDefinition(active).speed;
}

function buildTurnOrder(state: RaidState): string[] {
  return [
    ...alivePlayers(state).map((player) => ({
      id: player.id,
      speed: activeSpeed(player),
      seat: player.seat,
    })),
    { id: RAID_BOSS_ID, speed: state.boss.speed, seat: 99 },
  ]
    .sort((left, right) => right.speed - left.speed || left.seat - right.seat)
    .map((entry) => entry.id);
}

function drawEnergy(side: BattleSide, count: number): EnergyCard[] {
  const drawn: EnergyCard[] = [];
  for (let index = 0; index < count; index += 1) {
    if (side.energyDeck.length === 0 && side.energyDiscard.length > 0) {
      side.energyDeck = [...side.energyDiscard].reverse();
      side.energyDiscard = [];
      for (const card of side.energyDeck) {
        card.zone = "deck";
        card.attachedTo = null;
        card.status = "ready";
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

function appendEvents(
  state: RaidState,
  actionId: string,
  events: Array<Omit<RaidLogEntry, "id" | "sequence" | "round">>,
): RaidLogEntry[] {
  const start = state.log.length;
  const entries = events.map((event, index) => ({
    ...event,
    id: `${actionId}:${index}`,
    sequence: start + index + 1,
    round: state.turn.round,
  }));
  state.log.push(...entries);
  state.log = state.log.slice(-240);
  return entries;
}

function completeAction(state: RaidState, actionId: string) {
  state.processedActionIds.push(actionId);
  state.processedActionIds = state.processedActionIds.slice(-120);
}

function assertPlayerAction(state: RaidState, playerId: string, actionId: string) {
  if (state.status !== "active") throw new RaidRuleError("A Raid já terminou.");
  if (state.processedActionIds.includes(actionId)) {
    throw new RaidRuleError("Esta ação já foi processada.");
  }
  if (state.turn.actorKind !== "player" || state.turn.actorId !== playerId) {
    throw new RaidRuleError("Aguarde o seu turno na Raid.");
  }
  return playerFor(state, playerId);
}

function beginPlayerTurn(
  state: RaidState,
  player: RaidPlayerState,
  actionId: string,
): RaidLogEntry[] {
  player.side.attachmentsRemaining = ATTACHMENTS_PER_TURN;
  player.side.powerDrawsRemaining = POWER_DRAWS_PER_TURN;
  const shouldDraw = player.side.turnsStarted > 0;
  player.side.turnsStarted += 1;
  const drawn = shouldDraw ? drawEnergy(player.side, DRAW_PER_TURN) : [];
  const staged: Array<Omit<RaidLogEntry, "id" | "sequence" | "round">> = [{
    actorId: player.id,
    kind: "turn_started",
    message: player.needsSwitch
      ? `Vez de ${player.name}: escolha a próxima criatura.`
      : `Vez de ${player.name}.`,
  }];
  for (const card of drawn) {
    staged.push({
      actorId: player.id,
      kind: "energy_drawn",
      energyCardId: card.id,
      energyElement: card.element,
      message: `${player.name} comprou uma Energia de ${ELEMENT_META[card.element].name}.`,
    });
  }
  return appendEvents(state, actionId, staged);
}

function expireTerrainAtRoundBoundary(
  state: RaidState,
  actionId: string,
): RaidLogEntry[] {
  if (!state.terrain || state.turn.round <= state.terrain.expiresAfterTurn) return [];
  const element = state.terrain.element;
  state.terrain = undefined;
  return appendEvents(state, actionId, [{
    actorId: "system",
    kind: "terrain_expired",
    terrainElement: element,
    message: `O Terreno de ${ELEMENT_META[element].name} se dissipou.`,
  }]);
}

function advanceTurn(state: RaidState, actionId: string): RaidLogEntry[] {
  if (state.status !== "active") return [];
  let nextIndex = state.turn.index + 1;
  if (nextIndex >= state.turnOrder.length) {
    state.turn.round += 1;
    if (state.turn.round > state.maxRounds) {
      state.status = "defeat";
      return appendEvents(state, actionId, [{
        actorId: RAID_BOSS_ID,
        kind: "raid_defeat",
        message: "O limite de rodadas foi atingido. A Raid terminou em derrota.",
      }]);
    }
    state.turnOrder = buildTurnOrder(state);
    nextIndex = 0;
  }

  while (
    nextIndex < state.turnOrder.length
    && state.turnOrder[nextIndex] !== RAID_BOSS_ID
    && playerFor(state, state.turnOrder[nextIndex]).eliminated
  ) {
    nextIndex += 1;
  }
  if (nextIndex >= state.turnOrder.length) {
    state.turn.round += 1;
    state.turnOrder = buildTurnOrder(state);
    nextIndex = 0;
  }

  state.turn.index = nextIndex;
  state.turn.actorId = state.turnOrder[nextIndex];
  state.turn.actorKind = actorKind(state.turn.actorId);

  const events = expireTerrainAtRoundBoundary(state, `${actionId}:terrain`);
  if (state.turn.actorKind === "boss") {
    return [
      ...events,
      ...appendEvents(state, `${actionId}:turn`, [{
        actorId: RAID_BOSS_ID,
        kind: "turn_started",
        message: `Vez de ${state.boss.name}.`,
      }]),
    ];
  }

  return [
    ...events,
    ...beginPlayerTurn(state, playerFor(state, state.turn.actorId), `${actionId}:turn`),
  ];
}

export function createRaidState(
  roomId: string,
  eventId: string,
  players: readonly RaidPlayerSetup[],
  bossSetup: RaidBossSetup,
  random: RandomSource = Math.random,
): RaidState {
  if (players.length < RAID_MIN_PLAYERS || players.length > RAID_MAX_PLAYERS) {
    throw new RaidRuleError("Uma Raid precisa de 2 a 5 jogadores.");
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new RaidRuleError("Cada participante da Raid precisa ser único.");
  }

  const bossDefinition = CREATURE_BY_ID.get(bossSetup.catalogId);
  if (!bossDefinition) throw new RaidRuleError("Boss Mítico desconhecido.");
  if (bossDefinition.rarity !== "mythic") {
    throw new RaidRuleError("A Raid principal exige uma criatura de raridade Mítica.");
  }

  const raidPlayers: RaidPlayerState[] = players
    .slice()
    .sort((left, right) => left.seat - right.seat)
    .map((setup) => {
      if (setup.teamIds.length !== 6) {
        throw new RaidRuleError("Cada jogador da Raid precisa levar exatamente seis criaturas.");
      }
      return {
        id: setup.id,
        name: setup.name,
        seat: setup.seat,
        side: createBattleSide(
          setup.id,
          setup.name,
          "player",
          setup.teamIds,
          random,
          setup.energy,
        ),
        eliminated: false,
        needsSwitch: false,
        contribution: emptyContribution(),
      };
    });

  const state: RaidState = {
    version: 1,
    roomId,
    eventId,
    bossCreatureId: bossSetup.catalogId,
    status: "active",
    maxRounds: bossSetup.maxRounds,
    players: raidPlayers,
    boss: {
      id: RAID_BOSS_ID,
      catalogId: bossSetup.catalogId,
      name: bossDefinition.name,
      element: bossDefinition.element,
      hp: bossSetup.maxHp,
      maxHp: bossSetup.maxHp,
      shield: 0,
      phase: 1,
      speed: bossSetup.speed,
      enraged: false,
    },
    turnOrder: [],
    turn: { actorId: "", actorKind: "player", round: 1, index: 0 },
    processedActionIds: [],
    log: [],
  };

  state.turnOrder = buildTurnOrder(state);
  state.turn.actorId = state.turnOrder[0];
  state.turn.actorKind = actorKind(state.turn.actorId);

  appendEvents(state, "raid-start", [{
    actorId: "system",
    kind: "raid_started",
    message: `A Raid Mítica contra ${state.boss.name} começou com ${players.length} jogadores.`,
  }]);

  if (state.turn.actorKind === "player") {
    const first = playerFor(state, state.turn.actorId);
    first.side.turnsStarted = 1;
    appendEvents(state, "raid-first-turn", [{
      actorId: first.id,
      kind: "turn_started",
      message: `Vez de ${first.name}.`,
    }]);
  } else {
    appendEvents(state, "raid-first-turn", [{
      actorId: RAID_BOSS_ID,
      kind: "turn_started",
      message: `Vez de ${state.boss.name}.`,
    }]);
  }

  return state;
}

function spendEnergy(side: BattleSide, creature: BattleCreature, cost: EnergyCost) {
  if (!canPayCost(creature.attachedEnergy, cost)) {
    throw new RaidRuleError("A criatura ativa não possui as Energias exigidas.");
  }
  const remaining = [...creature.attachedEnergy];
  for (const element of ELEMENTS) {
    for (let count = 0; count < (cost[element] ?? 0); count += 1) {
      const index = remaining.findIndex((card) => card.element === element);
      if (index < 0) throw new RaidRuleError("Energia insuficiente.");
      const [spent] = remaining.splice(index, 1);
      spent.zone = "discard";
      spent.attachedTo = null;
      spent.status = "spent";
      side.energyDiscard.push(spent);
    }
  }
  creature.attachedEnergy = remaining;
}

export function attachRaidEnergy(
  input: RaidState,
  playerId: string,
  creatureIndex: number,
  cardId: string,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.needsSwitch) throw new RaidRuleError("Escolha a próxima criatura antes de anexar Energia.");
  const creature = player.side.team[creatureIndex];
  const cardIndex = player.side.energyHand.findIndex((card) => card.id === cardId);
  if (!creature || creature.defeated) throw new RaidRuleError("Escolha uma criatura disponível.");
  if (player.side.attachmentsRemaining < 1) {
    throw new RaidRuleError("O limite normal é de uma Energia anexada por turno.");
  }
  if (cardIndex < 0) throw new RaidRuleError("Essa Energia não está na sua mão.");

  const [card] = player.side.energyHand.splice(cardIndex, 1);
  card.zone = "attached";
  card.attachedTo = creature.instanceId;
  card.status = "ready";
  creature.attachedEnergy.push(card);
  player.side.attachmentsRemaining -= 1;
  player.contribution.actions += 1;

  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "energy_attached",
    creatureIndex,
    energyCardId: card.id,
    energyElement: card.element,
    message: `${player.name} vinculou Energia de ${ELEMENT_META[card.element].name} a ${getDefinition(creature).name}.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

export function drawRaidPower(
  input: RaidState,
  playerId: string,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.needsSwitch) throw new RaidRuleError("Escolha a próxima criatura antes de comprar Poder.");
  if (player.side.powerDrawsRemaining < 1) {
    throw new RaidRuleError("Você já comprou uma Carta de Poder neste turno.");
  }
  const [card] = drawPower(player.side, 1);
  if (!card) throw new RaidRuleError("O Baralho de Poder está vazio.");
  player.side.powerDrawsRemaining -= 1;
  player.contribution.actions += 1;
  const attack = getAttackById(card.attackId);
  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "power_drawn",
    powerCardId: card.id,
    attackId: card.attackId,
    message: `${player.name} comprou ${attack?.name ?? "uma Carta de Poder"}.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

export function equipRaidPower(
  input: RaidState,
  playerId: string,
  creatureIndex: number,
  cardId: string,
  slot: number | undefined,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.needsSwitch) throw new RaidRuleError("Escolha a próxima criatura antes de equipar Poder.");
  const creature = player.side.team[creatureIndex];
  if (!creature || creature.defeated) throw new RaidRuleError("Escolha uma criatura disponível.");
  const cardIndex = player.side.powerHand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new RaidRuleError("Essa Carta de Poder não está na sua mão.");
  const card = player.side.powerHand[cardIndex];
  const definition = getDefinition(creature);
  const attack = getAttackById(card.attackId);
  if (!attack) throw new RaidRuleError("Carta de Poder inválida.");
  if (definition.element !== card.element) {
    throw new RaidRuleError(`Este poder exige uma criatura de ${ELEMENT_META[card.element].name}.`);
  }
  if (creature.equippedPowerIds.includes(card.attackId)) {
    throw new RaidRuleError("Esta criatura já possui esse poder.");
  }

  let targetSlot = slot;
  if (creature.equippedPowerIds.length < MAX_EQUIPPED_POWERS) {
    targetSlot = creature.equippedPowerIds.length;
  } else if (targetSlot === undefined || targetSlot < 0 || targetSlot >= MAX_EQUIPPED_POWERS) {
    throw new RaidRuleError("Escolha qual dos quatro poderes será substituído.");
  }

  const [spent] = player.side.powerHand.splice(cardIndex, 1);
  player.side.powerDiscard.push(spent);
  creature.equippedPowerIds[targetSlot] = card.attackId;
  player.contribution.actions += 1;

  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "power_equipped",
    powerCardId: card.id,
    attackId: card.attackId,
    creatureIndex,
    message: `${definition.name} aprendeu ${attack.name}.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

function phaseForHp(hp: number, maxHp: number): RaidPhase {
  const ratio = hp / maxHp;
  if (ratio <= 0.35) return 3;
  if (ratio <= 0.70) return 2;
  return 1;
}

function updateBossPhase(
  state: RaidState,
  actionId: string,
): RaidLogEntry[] {
  const nextPhase = phaseForHp(state.boss.hp, state.boss.maxHp);
  if (nextPhase <= state.boss.phase) return [];
  state.boss.phase = nextPhase;
  state.boss.enraged = nextPhase === 3;
  const staged: Array<Omit<RaidLogEntry, "id" | "sequence" | "round">> = [{
    actorId: RAID_BOSS_ID,
    kind: "phase_changed",
    phase: nextPhase,
    message: `FASE ${nextPhase}: ${RAID_PHASE_NAMES[nextPhase]}.`,
  }];
  if (nextPhase >= 2) {
    state.terrain = {
      element: state.boss.element,
      sourceSideId: RAID_BOSS_ID,
      activatedTurn: state.turn.round,
      expiresAfterTurn: state.turn.round + 4,
    };
    staged.push({
      actorId: RAID_BOSS_ID,
      kind: "terrain_activated",
      terrainElement: state.boss.element,
      message: `${state.boss.name} transformou a arena em Terreno de ${ELEMENT_META[state.boss.element].name}.`,
    });
  }
  return appendEvents(state, actionId, staged);
}

function activatePlayerTerrain(
  state: RaidState,
  player: RaidPlayerState,
  element: Element,
  actionId: string,
) {
  state.terrain = {
    element,
    sourceSideId: player.id,
    activatedTurn: state.turn.round,
    expiresAfterTurn: state.turn.round + 3,
  };
  player.contribution.terrain += 1;
  return appendEvents(state, actionId, [{
    actorId: player.id,
    kind: "terrain_activated",
    terrainElement: element,
    message: `${player.name} ativou Terreno de ${ELEMENT_META[element].name}.`,
  }]);
}

export function resolveRaidAttack(
  input: RaidState,
  playerId: string,
  attackId: string,
  die: number,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.needsSwitch) throw new RaidRuleError("Escolha a próxima criatura antes de atacar.");
  if (!Number.isInteger(die) || die < 1 || die > 6) {
    throw new RaidRuleError("Resultado de dado inválido.");
  }

  const attacker = getActive(player.side);
  if (attacker.defeated) throw new RaidRuleError("A criatura ativa está nocauteada.");
  if (!attacker.equippedPowerIds.includes(attackId)) {
    throw new RaidRuleError("Esse poder não está equipado na criatura ativa.");
  }
  const definition = getDefinition(attacker);
  const attack = getAttackById(attackId);
  if (!attack) throw new RaidRuleError("Ataque inválido.");
  spendEnergy(player.side, attacker, attack.cost);

  const bossDefinition = CREATURE_BY_ID.get(state.boss.catalogId)!;
  const speedDelta = definition.speed - state.boss.speed;
  const speedModifier = speedDelta >= 30 ? -1 : speedDelta <= -30 ? 1 : 0;
  const requiredRoll = Math.max(2, Math.min(6, attack.minRoll + speedModifier));
  const success = die >= requiredRoll;
  const critical = success && die === 6;
  player.contribution.actions += 1;

  const staged: Array<Omit<RaidLogEntry, "id" | "sequence" | "round">> = [{
    actorId: playerId,
    kind: "die_rolled",
    die,
    attackId,
    message: `${player.name} rolou D6 = ${die} para ${attack.name}.`,
  }];

  if (!success) {
    staged.push({
      actorId: playerId,
      kind: "attack_miss",
      die,
      attackId,
      damage: 0,
      targetIds: [RAID_BOSS_ID],
      message: `${definition.name} falhou ao usar ${attack.name}.`,
    });
  } else {
    let multiplier = elementMultiplier(definition.element, bossDefinition.element);
    if (state.terrain?.element === definition.element) multiplier *= 1.15;
    const defenseFactor = 100 / (100 + bossDefinition.defense * 0.3);
    const raw = Math.max(1, Math.floor(attack.damage * multiplier * defenseFactor * (critical ? 1.5 : 1)));
    const absorbed = Math.min(state.boss.shield, raw);
    state.boss.shield -= absorbed;
    const damage = raw - absorbed;
    state.boss.hp = Math.max(0, state.boss.hp - damage);
    player.contribution.damage += damage;
    staged.push({
      actorId: playerId,
      kind: critical ? "critical" : "attack_hit",
      die,
      damage,
      attackId,
      targetIds: [RAID_BOSS_ID],
      message: critical
        ? `CRÍTICO! ${definition.name} causou ${damage} de dano em ${state.boss.name}.`
        : `${definition.name} causou ${damage} de dano em ${state.boss.name}.`,
    });
  }

  const events = appendEvents(state, actionId, staged);
  completeAction(state, actionId);

  if (state.boss.hp <= 0) {
    state.status = "victory";
    const victory = appendEvents(state, `${actionId}:victory`, [{
      actorId: "system",
      kind: "raid_victory",
      message: `${state.boss.name} foi derrotado. RAID CONCLUÍDA!`,
    }]);
    return { state, events: [...events, ...victory] };
  }

  const phaseEvents = updateBossPhase(state, `${actionId}:phase`);
  const totalCost = ELEMENTS.reduce((sum, element) => sum + (attack.cost[element] ?? 0), 0);
  const terrainEvents = success && totalCost >= 3
    ? activatePlayerTerrain(state, player, definition.element, `${actionId}:terrain`)
    : [];
  const turnEvents = advanceTurn(state, actionId);
  return { state, events: [...events, ...phaseEvents, ...terrainEvents, ...turnEvents] };
}

function discardAttached(side: BattleSide, creature: BattleCreature) {
  for (const card of creature.attachedEnergy) {
    card.zone = "discard";
    card.attachedTo = null;
    card.status = "spent";
    side.energyDiscard.push(card);
  }
  creature.attachedEnergy = [];
}

function damagePlayerActive(
  state: RaidState,
  player: RaidPlayerState,
  amount: number,
  events: Array<Omit<RaidLogEntry, "id" | "sequence" | "round">>,
) {
  const creature = getActive(player.side);
  if (creature.defeated) return;
  const definition = getDefinition(creature);
  const defenseFactor = 100 / (100 + definition.defense * 0.3);
  const raw = Math.max(1, Math.floor(amount * defenseFactor));
  const absorbed = Math.min(creature.shield, raw);
  creature.shield -= absorbed;
  const damage = raw - absorbed;
  creature.hp = Math.max(0, creature.hp - damage);
  if (creature.hp > 0) return;

  creature.defeated = true;
  creature.statuses = [];
  discardAttached(player.side, creature);
  events.push({
    actorId: RAID_BOSS_ID,
    kind: "creature_ko",
    damage,
    targetIds: [player.id],
    message: `${definition.name}, de ${player.name}, foi nocauteado.`,
  });

  const nextIndex = player.side.team.findIndex((candidate) => !candidate.defeated);
  if (nextIndex < 0) {
    player.eliminated = true;
    player.needsSwitch = false;
    events.push({
      actorId: RAID_BOSS_ID,
      kind: "player_eliminated",
      targetIds: [player.id],
      message: `${player.name} perdeu suas seis criaturas e agora assiste como espectador.`,
    });
  } else {
    player.needsSwitch = true;
  }
}

export function resolveRaidBossTurn(
  input: RaidState,
  targetRoll: number,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  if (state.status !== "active") throw new RaidRuleError("A Raid já terminou.");
  if (state.turn.actorKind !== "boss" || state.turn.actorId !== RAID_BOSS_ID) {
    throw new RaidRuleError("Ainda não é o turno do boss.");
  }
  if (state.processedActionIds.includes(actionId)) {
    throw new RaidRuleError("Esta ação já foi processada.");
  }

  const attack = RAID_BOSS_ATTACKS[state.boss.phase];
  const targets = alivePlayers(state);
  if (targets.length === 0) throw new RaidRuleError("Não há alvos disponíveis.");
  const selected = attack.target === "all"
    ? targets
    : [targets[Math.abs(targetRoll) % targets.length]];

  const staged: Array<Omit<RaidLogEntry, "id" | "sequence" | "round">> = [{
    actorId: RAID_BOSS_ID,
    kind: attack.target === "all" ? "boss_area_attack" : "boss_attack",
    attackId: attack.id,
    damage: attack.damage,
    targetIds: selected.map((player) => player.id),
    message: attack.target === "all"
      ? `${state.boss.name} usou ${attack.name} contra todos os jogadores!`
      : `${state.boss.name} usou ${attack.name} contra ${selected[0].name}.`,
  }];

  for (const player of selected) {
    damagePlayerActive(state, player, attack.damage, staged);
  }

  const events = appendEvents(state, actionId, staged);
  completeAction(state, actionId);

  if (alivePlayers(state).length === 0) {
    state.status = "defeat";
    const defeat = appendEvents(state, `${actionId}:defeat`, [{
      actorId: RAID_BOSS_ID,
      kind: "raid_defeat",
      message: `${state.boss.name} derrotou todo o grupo.`,
    }]);
    return { state, events: [...events, ...defeat] };
  }

  const turnEvents = advanceTurn(state, actionId);
  return { state, events: [...events, ...turnEvents] };
}

export function switchRaidCreature(
  input: RaidState,
  playerId: string,
  nextIndex: number,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  const current = getActive(player.side);
  const next = player.side.team[nextIndex];
  if (!next || next.defeated) throw new RaidRuleError("Essa criatura não pode entrar em campo.");
  if (nextIndex === player.side.activeIndex) throw new RaidRuleError("Essa criatura já está ativa.");
  if (!player.needsSwitch && current.statuses.some((status) => status.effect === "rooted")) {
    throw new RaidRuleError("A criatura ativa está enraizada.");
  }

  const forced = player.needsSwitch;
  player.side.activeIndex = nextIndex;
  player.needsSwitch = false;
  player.contribution.actions += 1;
  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "creature_switched",
    creatureIndex: nextIndex,
    message: forced
      ? `${player.name} enviou ${getDefinition(next).name} para continuar.`
      : `${player.name} recuou e enviou ${getDefinition(next).name}.`,
  }]);
  completeAction(state, actionId);

  if (forced) return { state, events };
  const turnEvents = advanceTurn(state, actionId);
  return { state, events: [...events, ...turnEvents] };
}

export function evolveRaidCreature(
  input: RaidState,
  playerId: string,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.needsSwitch) throw new RaidRuleError("Escolha a próxima criatura antes de evoluir.");
  const creature = getActive(player.side);
  const definition = getDefinition(creature);
  if ((creature.evolutionStage ?? 0) > 0) throw new RaidRuleError("Esta criatura já evoluiu.");
  if (state.turn.round < 2) throw new RaidRuleError("Evolução disponível a partir da segunda rodada.");
  const matching = creature.attachedEnergy.filter((card) => card.element === definition.element);
  if (matching.length < 2) {
    throw new RaidRuleError(`São necessárias duas Energias de ${ELEMENT_META[definition.element].name}.`);
  }

  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "evolution_started",
    creatureIndex: player.side.activeIndex,
    message: `${definition.name} iniciou sua Evolução de Vínculo.`,
  }]);

  for (let count = 0; count < 2; count += 1) {
    const index = creature.attachedEnergy.findIndex((card) => card.element === definition.element);
    const [spent] = creature.attachedEnergy.splice(index, 1);
    spent.zone = "discard";
    spent.attachedTo = null;
    spent.status = "spent";
    player.side.energyDiscard.push(spent);
  }
  const bonus = Math.max(18, Math.floor(definition.hp * 0.25));
  creature.evolutionStage = 1;
  creature.maxHp += bonus;
  creature.hp = Math.min(creature.maxHp, creature.hp + bonus);
  creature.shield += 12;
  player.contribution.actions += 1;
  player.contribution.shield += 12;

  const completed = appendEvents(state, `${actionId}:done`, [{
    actorId: playerId,
    kind: "evolution_completed",
    creatureIndex: player.side.activeIndex,
    message: `${definition.name} evoluiu durante a Raid.`,
  }]);
  completeAction(state, actionId);
  return { state, events: [...events, ...completed] };
}

export function passRaidTurn(
  input: RaidState,
  playerId: string,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.needsSwitch) throw new RaidRuleError("Escolha a próxima criatura antes de passar.");
  player.contribution.actions += 1;
  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "passed",
    message: `${player.name} encerrou o turno.`,
  }]);
  completeAction(state, actionId);
  const turnEvents = advanceTurn(state, actionId);
  return { state, events: [...events, ...turnEvents] };
}

export function eligibleRaidRewardPlayerIds(state: RaidState): string[] {
  if (state.status !== "victory") return [];
  return state.players
    .filter((player) => player.contribution.actions > 0)
    .map((player) => player.id);
}
