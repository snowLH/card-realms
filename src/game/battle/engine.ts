import { ARPG_ABILITY_CARD_BY_ID, STARTER_ARPG_ABILITY_IDS } from "../arpg/content/ability-cards";
import type { ArpgAbilityCardDefinition } from "../arpg/domain/types";
import { CREATURE_BY_ID, ELEMENT_META } from "../content";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "../save/local-progress";
import type { StatusEffect } from "../domain/creatures";
import {
  ELEMENTS,
  elementMultiplier,
  emptyEnergyPool,
  type EnergyPool,
} from "../domain/elements";
import {
  ATTACHMENTS_PER_TURN,
  BATTLE_VERSION,
  DRAW_PER_TURN,
  ENERGY_DECK_SIZE,
  OPENING_HAND_SIZE,
  type AbilityIds,
  type BattleActionResult,
  type BattleLogEntry,
  type BattleSide,
  type BattleState,
  type EnergyCard,
  type RandomSource,
} from "./types";
import { planNpcTurn } from "./ai";

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

function cloneAbilityIds(ids: readonly string[]): AbilityIds {
  if (ids.length !== 2 || ids[0] === ids[1] || ids.some((id) => !ARPG_ABILITY_CARD_BY_ID.has(id))) {
    throw new GameRuleError("O personagem precisa de exatamente dois poderes válidos e diferentes.");
  }
  return [ids[0], ids[1]];
}

function ability(id: string): ArpgAbilityCardDefinition {
  const definition = ARPG_ABILITY_CARD_BY_ID.get(id);
  if (!definition) throw new GameRuleError("Poder de batalha inválido.");
  return definition;
}

function createEnergyDeck(sideId: string, random: RandomSource, inventory?: EnergyPool): EnergyCard[] {
  const cards: EnergyCard[] = [];
  const used = new Map(ELEMENTS.map((element) => [element, 0]));
  if (inventory) {
    const balancedTarget = Math.floor(ENERGY_DECK_SIZE / ELEMENTS.length);
    const push = (element: (typeof ELEMENTS)[number]) => {
      const copy = (used.get(element) ?? 0) + 1;
      used.set(element, copy);
      cards.push({ id: `${sideId}:energy:${element}:${copy}`, element, origin: "inventory", ownerId: sideId, zone: "deck", attachedTo: null, status: "ready" });
    };
    for (const element of ELEMENTS) {
      const count = Math.max(0, Math.floor(inventory[element] ?? 0));
      for (let copy = 0; copy < Math.min(count, balancedTarget); copy += 1) push(element);
    }
    while (cards.length < ENERGY_DECK_SIZE && ELEMENTS.some((element) => (used.get(element) ?? 0) < Math.max(0, Math.floor(inventory[element] ?? 0)))) {
      for (const element of ELEMENTS) {
        if (cards.length >= ENERGY_DECK_SIZE) break;
        if ((used.get(element) ?? 0) < Math.max(0, Math.floor(inventory[element] ?? 0))) push(element);
      }
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

export function createBattleSide(
  id: string,
  name: string,
  kind: BattleSide["kind"],
  avatarConfig: AvatarConfig,
  abilityIds: readonly string[],
  random: RandomSource,
  energyInventory?: EnergyPool,
  maxHp = 140,
): BattleSide {
  const abilities = cloneAbilityIds(abilityIds);
  const deck = createEnergyDeck(id, random, energyInventory);
  const hand = deck.splice(0, OPENING_HAND_SIZE);
  for (const card of hand) card.zone = "hand";
  return {
    id,
    name,
    kind,
    avatarConfig: { ...avatarConfig },
    abilityIds: abilities,
    abilityCooldowns: [0, 0],
    element: ability(abilities[0]).element,
    hp: maxHp,
    maxHp,
    shield: 0,
    statuses: [],
    attachedEnergy: [],
    energyDeck: deck,
    energyHand: hand,
    energyDiscard: [],
    attachmentsRemaining: ATTACHMENTS_PER_TURN,
    turnsStarted: 0,
  };
}

export function getAbilityById(abilityId: string): ArpgAbilityCardDefinition | null {
  return ARPG_ABILITY_CARD_BY_ID.get(abilityId) ?? null;
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

export type EncounterBattleSetup = {
  mode: Exclude<BattleState["mode"], "pvp">;
  regionId?: string;
  opponentId: string;
  opponentName: string;
  opponentKind?: Extract<BattleSide["kind"], "npc" | "boss">;
  opponentAbilityIds?: readonly string[];
  opponentAvatarConfig?: AvatarConfig;
  opponentHp?: number;
  playerAvatarConfig?: AvatarConfig;
  playerAbilityIds?: readonly string[];
  playerEnergy?: EnergyPool;
  startMessage?: string;
};

export function createEncounterBattle(
  id: string,
  setup: EncounterBattleSetup,
  random: RandomSource = Math.random,
): BattleState {
  const playerId = "player-one";
  const playerAbilityIds = setup.playerAbilityIds ?? STARTER_ARPG_ABILITY_IDS;
  const opponentAbilityIds = setup.opponentAbilityIds ?? ["caipora-arrow", "tengu-gust"];
  const player = createBattleSide(
    playerId,
    "Você",
    "player",
    setup.playerAvatarConfig ?? DEFAULT_AVATAR_CONFIG,
    playerAbilityIds,
    random,
    setup.playerEnergy,
  );
  const opponent = createBattleSide(
    setup.opponentId,
    setup.opponentName,
    setup.opponentKind ?? "npc",
    setup.opponentAvatarConfig ?? { ...DEFAULT_AVATAR_CONFIG, outfit: "ranger", accent: "crimson" },
    opponentAbilityIds,
    random,
    undefined,
    setup.opponentHp ?? 140,
  );
  player.turnsStarted = 1;
  const state: BattleState = {
    version: BATTLE_VERSION,
    id,
    mode: setup.mode,
    status: "active",
    regionId: setup.regionId,
    turn: { sideId: playerId, number: 1, round: 1 },
    sides: [player, opponent],
    processedActionIds: [],
    log: [],
  };
  state.log.push({
    id: `${id}:start`,
    turn: 1,
    actorId: "system",
    kind: "battle_start",
    message: setup.startMessage ?? `${setup.opponentName} entrou na arena contra ${player.name}.`,
  });
  return state;
}

const DEMO_OPPONENTS = [
  { id: "warden-aya", name: "Guardiã Aya", abilities: ["ancestral-roots", "saci-whirlwind"], hp: 150 },
  { id: "warden-tupã", name: "Guardião Tupã", abilities: ["boitata-flame", "tengu-gust"], hp: 165 },
] as const;

export function createDemoBattle(
  id = crypto.randomUUID(),
  random: RandomSource = Math.random,
  playerAvatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
  playerAbilityIds: readonly string[] = STARTER_ARPG_ABILITY_IDS,
  playerEnergy?: EnergyPool,
): BattleState {
  const pick = DEMO_OPPONENTS[randomIndex(random, DEMO_OPPONENTS.length)];
  return createEncounterBattle(id, {
    mode: "npc",
    opponentId: pick.id,
    opponentName: pick.name,
    opponentAbilityIds: pick.abilities,
    opponentHp: pick.hp,
    playerAvatarConfig,
    playerAbilityIds,
    playerEnergy,
    startMessage: `O duelo de cartas começou: ${pick.name} contra seu personagem e seus dois poderes.`,
  }, random);
}

export type PvpPlayerSetup = {
  id: string;
  name: string;
  avatarConfig: AvatarConfig;
  abilityIds: readonly string[];
  energy?: EnergyPool;
};

export function createPvpBattle(
  id: string,
  challenger: PvpPlayerSetup,
  challenged: PvpPlayerSetup,
  random: RandomSource = Math.random,
): BattleState {
  if (challenger.id === challenged.id) throw new GameRuleError("Uma batalha PVP exige dois jogadores diferentes.");
  const sides: [BattleSide, BattleSide] = [
    createBattleSide(challenger.id, challenger.name, "player", challenger.avatarConfig, challenger.abilityIds, random, challenger.energy),
    createBattleSide(challenged.id, challenged.name, "player", challenged.avatarConfig, challenged.abilityIds, random, challenged.energy),
  ];
  const first = randomIndex(random, sides.length);
  sides[first].turnsStarted = 1;
  return {
    version: BATTLE_VERSION,
    id,
    mode: "pvp",
    status: "active",
    turn: { sideId: sides[first].id, number: 1, round: 1 },
    sides,
    processedActionIds: [],
    log: [{
      id: `${id}:start`,
      turn: 1,
      actorId: "system",
      kind: "battle_start",
      message: `${challenger.name} e ${challenged.name} iniciaram um duelo de cartas com um personagem e dois poderes cada.`,
    }],
  };
}

function makeEvent(state: BattleState, actionId: string, index: number, event: Omit<BattleLogEntry, "id" | "turn">): BattleLogEntry {
  return { ...event, id: `${actionId}:${index}`, turn: state.turn.number };
}

function appendEvents(state: BattleState, actionId: string, staged: Omit<BattleLogEntry, "id" | "turn">[]) {
  const events = staged.map((event, index) => makeEvent(state, actionId, index, event));
  state.log.push(...events);
  state.log = state.log.slice(-120);
  return events;
}

function completeAction(state: BattleState, actionId: string) {
  state.processedActionIds.push(actionId);
  state.processedActionIds = state.processedActionIds.slice(-80);
}

function assertAction(state: BattleState, sideId: string, actionId: string) {
  if (state.status !== "active") throw new GameRuleError("A batalha já terminou.");
  if (state.turn.sideId !== sideId) throw new GameRuleError("Aguarde o seu turno.");
  if (!actionId || state.processedActionIds.includes(actionId)) throw new GameRuleError("Esta ação já foi processada.");
}

function statusOn(side: BattleSide, effect: StatusEffect) {
  return side.statuses.find((status) => status.effect === effect && status.turns > 0);
}

function statusForAbility(card: ArpgAbilityCardDefinition): StatusEffect {
  if (card.element === "fire") return "burn";
  if (card.element === "water") return "soaked";
  if (card.element === "nature") return "rooted";
  if (card.element === "storm") return "shocked";
  return "haunted";
}

function abilityCooldownTurns(card: ArpgAbilityCardDefinition) {
  return Math.max(1, Math.min(4, Math.ceil(card.cooldownMs / 4500)));
}

function activateTerrain(state: BattleState, side: BattleSide, element: BattleSide["element"], staged: Omit<BattleLogEntry, "id" | "turn">[]) {
  state.terrain = {
    element,
    sourceSideId: side.id,
    activatedTurn: state.turn.number,
    expiresAfterTurn: state.turn.number + 3,
  };
  staged.push({
    actorId: side.id,
    kind: "terrain_activated",
    terrainElement: element,
    terrainTurns: 3,
    message: `O terreno de ${ELEMENT_META[element].name} tomou conta da arena por 3 turnos.`,
  });
}

function drawEnergyForTurn(side: BattleSide, sideId: string, turn: number, staged: Omit<BattleLogEntry, "id" | "turn">[]) {
  const drawn = side.turnsStarted === 0 ? [] : drawEnergy(side, DRAW_PER_TURN);
  side.turnsStarted += 1;
  side.attachmentsRemaining = ATTACHMENTS_PER_TURN;
  side.abilityCooldowns = [Math.max(0, side.abilityCooldowns[0] - 1), Math.max(0, side.abilityCooldowns[1] - 1)];
  for (const card of drawn) {
    staged.push({
      actorId: sideId,
      kind: "energy_drawn",
      energyCardId: card.id,
      energyElement: card.element,
      message: `${side.name} comprou Energia de ${ELEMENT_META[card.element].name}.`,
    });
  }
}

function tickStatuses(state: BattleState, side: BattleSide, staged: Omit<BattleLogEntry, "id" | "turn">[]) {
  const remaining: BattleSide["statuses"] = [];
  for (const status of side.statuses) {
    if (status.effect === "burn") {
      const damage = status.amount ?? 5;
      const absorbed = Math.min(side.shield, damage);
      side.shield -= absorbed;
      const applied = damage - absorbed;
      side.hp = Math.max(0, side.hp - applied);
      staged.push({ actorId: status.sourceAbilityId, kind: "status_tick", effect: status.effect, damage: applied, message: `${side.name} sofreu ${applied} de dano de queimadura.` });
    }
    if (status.turns > 1) remaining.push({ ...status, turns: status.turns - 1 });
  }
  side.statuses = remaining;
  if (side.hp <= 0) {
    const winner = getOpponent(state, side.id);
    state.status = "finished";
    state.winnerId = winner.id;
    staged.push({ actorId: side.id, kind: "defeated", message: `${side.name} foi derrotado pelo efeito persistente.` });
    staged.push({ actorId: winner.id, kind: "battle_end", message: `${winner.name} venceu a batalha.` });
  }
}

function advanceTurn(state: BattleState, previousSideId: string, actionId: string): BattleLogEntry[] {
  if (state.status !== "active") return [];
  const next = getOpponent(state, previousSideId);
  state.turn.sideId = next.id;
  state.turn.number += 1;
  state.turn.round = Math.ceil(state.turn.number / 2);
  const staged: Omit<BattleLogEntry, "id" | "turn">[] = [];
  if (state.terrain && state.turn.number > state.terrain.expiresAfterTurn) {
    const oldElement = state.terrain.element;
    state.terrain = undefined;
    staged.push({ actorId: "system", kind: "terrain_expired", terrainElement: oldElement, message: `O terreno de ${ELEMENT_META[oldElement].name} se dissipou.` });
  }
  tickStatuses(state, next, staged);
  if (state.status === "active") {
    drawEnergyForTurn(next, next.id, state.turn.number, staged);
    staged.push({ actorId: next.id, kind: "turn_started", message: `Vez de ${next.name}.` });
  }
  return appendEvents(state, `${actionId}:turn`, staged);
}

export function attachEnergy(input: BattleState, sideId: string, cardId: string, actionId: string): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  const side = getSide(state, sideId);
  if (side.attachmentsRemaining < 1) throw new GameRuleError("Você já vinculou Energia neste turno.");
  const index = side.energyHand.findIndex((card) => card.id === cardId);
  if (index < 0) throw new GameRuleError("Essa Energia não está na sua mão.");
  const [card] = side.energyHand.splice(index, 1);
  card.zone = "attached";
  card.attachedTo = side.id;
  card.status = "ready";
  side.attachedEnergy.push(card);
  side.attachmentsRemaining -= 1;
  const events = appendEvents(state, actionId, [{
    actorId: sideId,
    kind: "energy_attached",
    energyCardId: card.id,
    energyElement: card.element,
    message: `${side.name} vinculou Energia de ${ELEMENT_META[card.element].name} ao personagem.`,
  }]);
  completeAction(state, actionId);
  return { state, events };
}

function takeFocusEnergy(side: BattleSide, element: BattleSide["element"]) {
  const index = side.attachedEnergy.findIndex((card) => card.element === element);
  if (index < 0) return false;
  const [card] = side.attachedEnergy.splice(index, 1);
  card.zone = "discard";
  card.attachedTo = null;
  card.status = "spent";
  side.energyDiscard.push(card);
  return true;
}

function applyDamage(target: BattleSide, rawDamage: number) {
  const absorbed = Math.min(target.shield, rawDamage);
  target.shield -= absorbed;
  const damage = rawDamage - absorbed;
  target.hp = Math.max(0, target.hp - damage);
  return damage;
}

export function resolveAbility(
  input: BattleState,
  sideId: string,
  slot: number,
  die: number,
  effectRoll: number,
  actionId: string,
): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  if (slot !== 0 && slot !== 1) throw new GameRuleError("Escolha um dos dois poderes equipados.");
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new GameRuleError("Resultado de dado inválido.");
  if (!Number.isInteger(effectRoll) || effectRoll < 1 || effectRoll > 100) throw new GameRuleError("Resultado de efeito inválido.");
  const side = getSide(state, sideId);
  const opponent = getOpponent(state, sideId);
  const card = ability(side.abilityIds[slot]);
  if (side.abilityCooldowns[slot] > 0) throw new GameRuleError(`${card.name} ainda está recarregando.`);

  const focused = takeFocusEnergy(side, card.element);
  side.abilityCooldowns[slot] = abilityCooldownTurns(card);
  const shockPenalty = statusOn(side, "shocked") ? 1 : 0;
  const requiredRoll = Math.max(2, Math.min(5, (card.damage >= 58 ? 3 : 2) + shockPenalty));
  const success = die >= requiredRoll;
  const critical = success && die === 6;
  const staged: Omit<BattleLogEntry, "id" | "turn">[] = [{
    actorId: sideId,
    kind: "ability_used",
    abilityId: card.id,
    abilitySlot: slot,
    die,
    message: `${side.name} usou ${card.name}.`,
  }];

  if (!success) {
    staged.push({ actorId: sideId, kind: "attack_miss", abilityId: card.id, abilitySlot: slot, die, damage: 0, message: `${card.name} errou o alvo.` });
  } else if (card.behavior === "renewal" || card.kind === "defense") {
    const healed = Math.min(side.maxHp - side.hp, card.restoreHp ?? Math.floor(side.maxHp * 0.22));
    side.hp += healed;
    const shield = Math.max(8, Math.floor(side.maxHp * 0.08));
    side.shield += shield;
    staged.push({ actorId: sideId, kind: "healed", effect: "heal", damage: healed, abilityId: card.id, abilitySlot: slot, message: `${side.name} recuperou ${healed} de vida com ${card.name}.` });
    staged.push({ actorId: sideId, kind: "shielded", effect: "shield", abilityId: card.id, abilitySlot: slot, message: `${side.name} ganhou ${shield} de escudo.` });
  } else {
    let multiplier = elementMultiplier(card.element, opponent.element);
    if (state.terrain?.element === card.element) multiplier *= 1.15;
    if (focused) multiplier *= 1.2;
    if (statusOn(side, "haunted")) multiplier *= 0.85;
    if (statusOn(opponent, "warded")) multiplier *= 0.8;
    if (card.element === "storm" && statusOn(opponent, "soaked")) {
      multiplier *= 1.25;
      opponent.statuses = opponent.statuses.filter((status) => status.effect !== "soaked");
    }
    const criticalMultiplier = critical ? 1.5 : 1;
    const rawDamage = Math.max(1, Math.floor(card.damage * multiplier * criticalMultiplier));
    const damage = applyDamage(opponent, rawDamage);
    staged.push({
      actorId: sideId,
      kind: critical ? "critical" : "attack_hit",
      abilityId: card.id,
      abilitySlot: slot,
      die,
      damage,
      message: critical
        ? `Crítico! ${card.name} causou ${damage} de dano.`
        : `${card.name} causou ${damage} de dano.`,
    });

    const canApplyStatus = card.kind === "control" || card.behavior === "targeted-control" || card.behavior === "self-area";
    if (canApplyStatus && effectRoll <= 82 && opponent.hp > 0) {
      const effect = statusForAbility(card);
      const duration = Math.max(1, Math.min(3, Math.ceil((card.durationMs ?? 1000) / 1000)));
      opponent.statuses = opponent.statuses.filter((status) => status.effect !== effect);
      opponent.statuses.push({ effect, turns: duration, amount: effect === "burn" ? Math.max(4, Math.floor(card.damage / 9)) : undefined, sourceAbilityId: card.id });
      staged.push({ actorId: sideId, kind: "status_applied", abilityId: card.id, abilitySlot: slot, effect, message: `${opponent.name} recebeu o estado ${effect}.` });
    }
    if (critical || (card.kind === "control" && card.behavior === "targeted-control")) {
      activateTerrain(state, side, card.element, staged);
    }
  }

  if (opponent.hp <= 0) {
    state.status = "finished";
    state.winnerId = side.id;
    staged.push({ actorId: opponent.id, kind: "defeated", message: `${opponent.name} foi derrotado.` });
    staged.push({ actorId: side.id, kind: "battle_end", message: `${side.name} venceu a batalha.` });
  }
  const events = appendEvents(state, actionId, staged);
  completeAction(state, actionId);
  if (state.status === "finished") return { state, events };
  return { state, events: [...events, ...advanceTurn(state, sideId, actionId)] };
}

export function passTurn(input: BattleState, sideId: string, actionId: string): BattleActionResult {
  const state = structuredClone(input);
  assertAction(state, sideId, actionId);
  const side = getSide(state, sideId);
  const events = appendEvents(state, actionId, [{ actorId: sideId, kind: "passed", message: `${side.name} encerrou o turno.` }]);
  completeAction(state, actionId);
  return { state, events: [...events, ...advanceTurn(state, sideId, actionId)] };
}

export function concedeBattle(input: BattleState, sideId: string, actionId: string): BattleActionResult {
  const state = structuredClone(input);
  if (state.status !== "active" || state.processedActionIds.includes(actionId)) throw new GameRuleError("Esta ação não pode ser processada.");
  const side = getSide(state, sideId);
  const opponent = getOpponent(state, sideId);
  state.status = "finished";
  state.winnerId = opponent.id;
  const events = appendEvents(state, actionId, [
    { actorId: sideId, kind: "conceded", message: `${side.name} desistiu da batalha.` },
    { actorId: opponent.id, kind: "battle_end", message: `${opponent.name} venceu por desistência.` },
  ]);
  completeAction(state, actionId);
  return { state, events };
}

export function playNpcTurn(state: BattleState, sideId: string, actionId: string, random: RandomSource = Math.random): BattleActionResult {
  let working = structuredClone(state);
  const events: BattleLogEntry[] = [];
  const plan = planNpcTurn(working, sideId);
  if (plan.attachEnergyCardId) {
    const attached = attachEnergy(working, sideId, plan.attachEnergyCardId, `${actionId}:attach`);
    working = attached.state;
    events.push(...attached.events);
  }
  if (plan.abilitySlot !== undefined) {
    const used = resolveAbility(working, sideId, plan.abilitySlot, Math.max(3, Math.ceil(random() * 6)), Math.ceil(random() * 100), `${actionId}:ability`);
    return { state: used.state, events: [...events, ...used.events] };
  }
  const passed = passTurn(working, sideId, `${actionId}:pass`);
  return { state: passed.state, events: [...events, ...passed.events] };
}

export function getDefaultOpponentAbilityIds(creatureId?: string): AbilityIds {
  const creature = creatureId ? CREATURE_BY_ID.get(creatureId) : undefined;
  const cardForCreature = creature?.id === "roc"
    ? "roc-horizon-storm"
    : creature?.element === "fire"
      ? "boitata-flame"
      : creature?.element === "water"
        ? "kappa-splash"
        : creature?.element === "storm"
          ? "tengu-gust"
          : creature?.element === "spirit"
            ? "banshee-wail"
            : "caipora-arrow";
  const pair = cardForCreature === "roc-horizon-storm"
    ? [cardForCreature, "tengu-gust"]
    : [cardForCreature, "ancestral-roots"];
  return cloneAbilityIds(pair);
}

export function defaultEnergyPool(): EnergyPool {
  return emptyEnergyPool();
}

