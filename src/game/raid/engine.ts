import { CREATURE_BY_ID, ELEMENT_META } from "../content";
import {
  BATTLE_VERSION,
  createBattleSide,
  getDefaultOpponentAbilityIds,
  resolveAbility,
  type BattleSide,
  type BattleState,
  type RandomSource,
} from "../battle";
import { DEFAULT_AVATAR_CONFIG } from "../save/local-progress";
import {
  RAID_BOSS_ATTACKS,
  RAID_PHASE_NAMES,
} from "./content";
import {
  RAID_BOSS_ID,
  RAID_MAX_PLAYERS,
  RAID_MIN_PLAYERS,
  RAID_STATE_VERSION,
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

type RaidEventInput = Omit<RaidLogEntry, "id" | "sequence" | "round">;

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

function activePlayers(state: RaidState) {
  return state.players.filter((player) => !player.eliminated && player.side.hp > 0);
}

function actorKind(actorId: string): "player" | "boss" {
  return actorId === RAID_BOSS_ID ? "boss" : "player";
}

function appendEvents(state: RaidState, actionId: string, entries: RaidEventInput[]): RaidLogEntry[] {
  const events = entries.map((event, index) => ({
    ...event,
    id: `${actionId}:${index + 1}`,
    sequence: ++state.eventSequence,
    round: state.turn.round,
  }));
  state.log.push(...events);
  state.log = state.log.slice(-240);
  return events;
}

function completeAction(state: RaidState, actionId: string) {
  state.processedActionIds.push(actionId);
  state.processedActionIds = state.processedActionIds.slice(-120);
}

function assertPlayerAction(state: RaidState, playerId: string, actionId: string) {
  if (state.status !== "active") throw new RaidRuleError("A Raid já terminou.");
  if (!actionId || state.processedActionIds.includes(actionId)) {
    throw new RaidRuleError("Esta ação já foi processada.");
  }
  if (state.turn.actorKind !== "player" || state.turn.actorId !== playerId) {
    throw new RaidRuleError("Aguarde o seu turno na Raid.");
  }
  const player = playerFor(state, playerId);
  if (player.eliminated || player.side.hp <= 0) throw new RaidRuleError("Seu personagem foi derrotado nesta Raid.");
  return player;
}

function drawEnergy(side: BattleSide, count: number) {
  const drawn = [];
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

function beginPlayerTurn(state: RaidState, player: RaidPlayerState, actionId: string) {
  const shouldDraw = player.side.turnsStarted > 0;
  player.side.turnsStarted += 1;
  player.side.attachmentsRemaining = 1;
  player.side.abilityCooldowns = [
    Math.max(0, player.side.abilityCooldowns[0] - 1),
    Math.max(0, player.side.abilityCooldowns[1] - 1),
  ];
  const entries: RaidEventInput[] = [{
    actorId: player.id,
    kind: "turn_started",
    message: `Vez de ${player.name}.`,
  }];
  const drawn = shouldDraw ? drawEnergy(player.side, 2) : [];
  for (const card of drawn) {
    entries.push({
      actorId: player.id,
      kind: "energy_drawn",
      energyCardId: card.id,
      energyElement: card.element,
      message: `${player.name} comprou Energia de ${ELEMENT_META[card.element].name}.`,
    });
  }
  return appendEvents(state, actionId, entries);
}

function advanceTurn(state: RaidState, actionId: string) {
  if (state.status !== "active") return [] as RaidLogEntry[];
  const previousRound = state.turn.round;
  let nextIndex = state.turn.index + 1;
  if (nextIndex >= state.turnOrder.length) {
    nextIndex = 0;
    state.turn.round += 1;
    if (state.turn.round > state.maxRounds) {
      state.status = "defeat";
      return appendEvents(state, `${actionId}:limit`, [{
        actorId: RAID_BOSS_ID,
        kind: "raid_defeat",
        message: "O limite de rodadas foi atingido. A Raid terminou em derrota.",
      }]);
    }
  }

  for (let attempt = 0; attempt < state.turnOrder.length; attempt += 1) {
    const candidateId = state.turnOrder[nextIndex];
    if (candidateId === RAID_BOSS_ID || activePlayers(state).some((player) => player.id === candidateId)) break;
    nextIndex = (nextIndex + 1) % state.turnOrder.length;
    if (nextIndex === 0 && state.turn.index !== state.turnOrder.length - 1) state.turn.round += 1;
  }

  state.turn.index = nextIndex;
  state.turn.actorId = state.turnOrder[nextIndex];
  state.turn.actorKind = actorKind(state.turn.actorId);

  const events: RaidLogEntry[] = [];
  if (state.turn.round > previousRound && state.terrain && state.turn.round > state.terrain.expiresAfterTurn) {
    const element = state.terrain.element;
    state.terrain = undefined;
    events.push(...appendEvents(state, `${actionId}:terrain`, [{
      actorId: "system",
      kind: "terrain_expired",
      terrainElement: element,
      message: `O Terreno de ${ELEMENT_META[element].name} se dissipou.`,
    }]));
  }

  if (state.turn.actorKind === "boss") {
    events.push(...appendEvents(state, `${actionId}:turn`, [{
      actorId: RAID_BOSS_ID,
      kind: "turn_started",
      message: `Vez de ${state.boss.name}.`,
    }]));
  } else {
    events.push(...beginPlayerTurn(state, playerFor(state, state.turn.actorId), `${actionId}:turn`));
  }
  return events;
}

function updateBossPhase(state: RaidState, actionId: string) {
  const ratio = state.boss.hp / state.boss.maxHp;
  const nextPhase: RaidPhase = ratio <= 0.35 ? 3 : ratio <= 0.7 ? 2 : 1;
  if (nextPhase <= state.boss.phase) return [] as RaidLogEntry[];
  state.boss.phase = nextPhase;
  state.boss.enraged = nextPhase === 3;
  const entries: RaidEventInput[] = [{
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
    entries.push({
      actorId: RAID_BOSS_ID,
      kind: "terrain_activated",
      terrainElement: state.boss.element,
      terrainTurns: 4,
      message: `${state.boss.name} transformou a arena em Terreno de ${ELEMENT_META[state.boss.element].name}.`,
    });
  }
  return appendEvents(state, actionId, entries);
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
  if (new Set(players.map((player) => player.seat)).size !== players.length
    || players.some((player) => !Number.isInteger(player.seat) || player.seat < 1 || player.seat > RAID_MAX_PLAYERS)) {
    throw new RaidRuleError("Cada participante precisa de um assento válido e único.");
  }
  if (!Number.isInteger(bossSetup.maxHp) || bossSetup.maxHp < 1
    || !Number.isInteger(bossSetup.maxRounds) || bossSetup.maxRounds < 1
    || !Number.isFinite(bossSetup.speed) || bossSetup.speed < 0) {
    throw new RaidRuleError("A configuração do boss é inválida.");
  }
  const bossDefinition = CREATURE_BY_ID.get(bossSetup.catalogId);
  if (!bossDefinition || bossDefinition.rarity !== "mythic") {
    throw new RaidRuleError("Boss Mítico desconhecido.");
  }

  const raidPlayers: RaidPlayerState[] = players
    .slice()
    .sort((left, right) => left.seat - right.seat)
    .map((setup) => {
      const side = createBattleSide(
        setup.id,
        setup.name,
        "player",
        setup.avatarConfig,
        setup.abilityIds,
        random,
        setup.energy,
        190,
      );
      side.turnsStarted = 1;
      return {
        id: setup.id,
        name: setup.name,
        seat: setup.seat,
        side,
        eliminated: false,
        contribution: emptyContribution(),
      };
    });

  const state: RaidState = {
    version: RAID_STATE_VERSION,
    eventSequence: 0,
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
      statuses: [],
      phase: 1,
      speed: bossSetup.speed,
      enraged: false,
    },
    turnOrder: [...raidPlayers.map((player) => player.id), RAID_BOSS_ID],
    turn: { actorId: raidPlayers[0].id, actorKind: "player", round: 1, index: 0 },
    processedActionIds: [],
    log: [],
  };
  appendEvents(state, "raid-start", [{
    actorId: "system",
    kind: "raid_started",
    message: `A Raid Mítica contra ${state.boss.name} começou com um avatar e dois poderes por jogador.`,
  }]);
  appendEvents(state, "raid-first-turn", [{
    actorId: state.turn.actorId,
    kind: "turn_started",
    message: `Vez de ${state.players[0].name}.`,
  }]);
  return state;
}

export function attachRaidEnergy(
  input: RaidState,
  playerId: string,
  cardId: string,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  if (player.side.attachmentsRemaining < 1) {
    throw new RaidRuleError("O limite normal é de uma Energia anexada por turno.");
  }
  const cardIndex = player.side.energyHand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new RaidRuleError("Essa Energia não está na sua mão.");
  const [card] = player.side.energyHand.splice(cardIndex, 1);
  card.zone = "attached";
  card.attachedTo = player.side.id;
  card.status = "ready";
  player.side.attachedEnergy.push(card);
  player.side.attachmentsRemaining -= 1;
  player.contribution.actions += 1;
  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "energy_attached",
    energyCardId: card.id,
    energyElement: card.element,
    message: `${player.name} vinculou Energia de ${ELEMENT_META[card.element].name} ao personagem.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

function toBossBattleSide(state: RaidState): BattleSide {
  return {
    id: RAID_BOSS_ID,
    name: state.boss.name,
    kind: "boss",
    avatarConfig: DEFAULT_AVATAR_CONFIG,
    abilityIds: getDefaultOpponentAbilityIds(state.boss.catalogId),
    abilityCooldowns: [0, 0],
    element: state.boss.element,
    hp: state.boss.hp,
    maxHp: state.boss.maxHp,
    shield: state.boss.shield,
    statuses: structuredClone(state.boss.statuses),
    attachedEnergy: [],
    energyDeck: [],
    energyHand: [],
    energyDiscard: [],
    attachmentsRemaining: 0,
    turnsStarted: 0,
  };
}

function battleEventsToRaid(events: BattleState["log"]): RaidEventInput[] {
  const allowed = new Set<RaidLogEntry["kind"]>([
    "turn_started", "energy_drawn", "energy_attached", "ability_used", "attack_hit",
    "attack_miss", "critical", "healed", "shielded", "status_applied", "status_tick",
    "defeated", "terrain_activated", "terrain_expired",
  ]);
  return events
    .filter((event) => allowed.has(event.kind as RaidLogEntry["kind"]) && event.kind !== "turn_started")
    .map((event) => ({
      actorId: event.actorId,
      kind: event.kind as RaidLogEntry["kind"],
      message: event.message,
      ...(event.die === undefined ? {} : { die: event.die }),
      ...(event.damage === undefined ? {} : { damage: event.damage }),
      ...(event.abilityId === undefined ? {} : { abilityId: event.abilityId }),
      ...(event.abilitySlot === undefined ? {} : { abilitySlot: event.abilitySlot }),
      ...(event.effect === undefined ? {} : { effect: event.effect }),
      ...(event.terrainElement === undefined ? {} : { terrainElement: event.terrainElement }),
      ...(event.terrainTurns === undefined ? {} : { terrainTurns: event.terrainTurns }),
      ...(event.energyCardId === undefined ? {} : { energyCardId: event.energyCardId }),
      ...(event.energyElement === undefined ? {} : { energyElement: event.energyElement }),
    }));
}

export function resolveRaidAbility(
  input: RaidState,
  playerId: string,
  slot: 0 | 1,
  die: number,
  effectRoll: number,
  actionId: string,
): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  const beforeHp = player.side.hp;
  const beforeShield = player.side.shield;
  const beforeBossHp = state.boss.hp;
  const beforeBossShield = state.boss.shield;
  const battle: BattleState = {
    version: BATTLE_VERSION,
    id: `${state.roomId}:raid:${actionId}`,
    mode: "boss",
    status: "active",
    turn: { sideId: player.id, number: state.turn.round, round: state.turn.round },
    sides: [structuredClone(player.side), toBossBattleSide(state)],
    terrain: structuredClone(state.terrain),
    processedActionIds: [],
    log: [],
  };
  const resolved = resolveAbility(battle, playerId, slot, die, effectRoll, actionId);
  const [updatedPlayer, updatedBoss] = resolved.state.sides;
  player.side = updatedPlayer;
  state.boss.hp = updatedBoss.hp;
  state.boss.shield = updatedBoss.shield;
  state.boss.statuses = updatedBoss.statuses;
  state.terrain = resolved.state.terrain;
  player.contribution.actions += 1;
  player.contribution.damage += Math.max(0, beforeBossHp - state.boss.hp);
  player.contribution.healing += Math.max(0, player.side.hp - beforeHp);
  player.contribution.shield += Math.max(0, player.side.shield - beforeShield);

  const events = appendEvents(state, actionId, battleEventsToRaid(resolved.events));
  completeAction(state, actionId);
  if (state.boss.hp <= 0 || resolved.state.status === "finished") {
    state.boss.hp = 0;
    state.status = "victory";
    events.push(...appendEvents(state, `${actionId}:victory`, [{
      actorId: "system",
      kind: "raid_victory",
      message: `${state.boss.name} foi derrotado. RAID CONCLUÍDA!`,
    }]));
    return { state, events };
  }
  if (state.boss.shield > beforeBossShield) {
    player.contribution.shield += state.boss.shield - beforeBossShield;
  }
  events.push(...updateBossPhase(state, `${actionId}:phase`));
  events.push(...advanceTurn(state, actionId));
  return { state, events };
}

function damagePlayer(player: RaidPlayerState, amount: number) {
  const absorbed = Math.min(player.side.shield, amount);
  player.side.shield -= absorbed;
  const damage = amount - absorbed;
  player.side.hp = Math.max(0, player.side.hp - damage);
  if (player.side.hp <= 0) player.eliminated = true;
  return damage;
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
  if (!actionId || state.processedActionIds.includes(actionId)) {
    throw new RaidRuleError("Esta ação já foi processada.");
  }
  const attack = RAID_BOSS_ATTACKS[state.boss.phase];
  const targets = activePlayers(state);
  if (!targets.length) throw new RaidRuleError("Não há alvos disponíveis.");
  const selected = attack.target === "all"
    ? targets
    : [targets[Math.abs(targetRoll) % targets.length]];
  const events = appendEvents(state, actionId, [{
    actorId: RAID_BOSS_ID,
    kind: attack.target === "all" ? "boss_area_attack" : "boss_attack",
    damage: attack.damage,
    targetIds: selected.map((player) => player.id),
    message: attack.target === "all"
      ? `${state.boss.name} usou ${attack.name} contra todos os jogadores!`
      : `${state.boss.name} usou ${attack.name} contra ${selected[0].name}.`,
  }]);
  for (const player of selected) {
    const actual = damagePlayer(player, attack.damage);
    const entry = events[0];
    if (selected.length === 1) entry.damage = actual;
    if (player.eliminated) {
      events.push(...appendEvents(state, `${actionId}:ko:${player.id}`, [{
        actorId: RAID_BOSS_ID,
        kind: "player_eliminated",
        damage: actual,
        targetIds: [player.id],
        message: `${player.name} foi derrotado nesta Raid.`,
      }]));
    }
  }
  completeAction(state, actionId);
  if (activePlayers(state).length === 0) {
    state.status = "defeat";
    events.push(...appendEvents(state, `${actionId}:defeat`, [{
      actorId: RAID_BOSS_ID,
      kind: "raid_defeat",
      message: `${state.boss.name} derrotou todos os avatares.`,
    }]));
    return { state, events };
  }
  events.push(...advanceTurn(state, actionId));
  return { state, events };
}

export function passRaidTurn(input: RaidState, playerId: string, actionId: string): RaidActionResult {
  const state = structuredClone(input);
  const player = assertPlayerAction(state, playerId, actionId);
  player.contribution.actions += 1;
  const events = appendEvents(state, actionId, [{
    actorId: playerId,
    kind: "passed",
    message: `${player.name} encerrou o turno.`,
  }]);
  completeAction(state, actionId);
  events.push(...advanceTurn(state, actionId));
  return { state, events };
}

export function eligibleRaidRewardPlayerIds(state: RaidState): string[] {
  if (state.status !== "victory") return [];
  return state.players
    .filter((player) => player.contribution.actions > 0)
    .map((player) => player.id);
}
