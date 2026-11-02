import { DEMO_GUIDED_DECKS, getStarterDeckForCulture } from "../content/starter-decks";
import { createInitialKingdomHeart } from "./cultures";
import type {
  CultureId,
  HandCardInstance,
  KingdomHeartState,
  MatchMode,
  PlayerMatchState,
  PlayerSide,
} from "./types";

export const INITIAL_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 7;
export const INITIAL_MAX_BREATH = 3;
export const MAX_BREATH_CAP = 8;

export function hashSeedToUint32(seed: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash === 0 ? 0x6d2b79f5 : hash;
}

export function stepRng(state: number): { value: number; nextState: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return {
    value,
    nextState: (state + 0x6d2b79f5) >>> 0,
  };
}

export function shuffleCardIdsDeterministically(
  cardIds: readonly string[],
  rngState: number,
): { shuffled: string[]; nextState: number } {
  const copy = [...cardIds];
  let currentState = rngState;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const stepped = stepRng(currentState);
    currentState = stepped.nextState;
    const swapIndex = Math.floor(stepped.value * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return { shuffled: copy, nextState: currentState };
}

export function createPlayerMatchState(options: {
  side: PlayerSide;
  name: string;
  culture: CultureId;
  mode: MatchMode;
  rngState: number;
  initialBreath?: number;
}): { player: PlayerMatchState; nextRngState: number } {
  const { side, name, culture, mode, rngState } = options;
  let nextRngState = rngState;
  let orderedCardIds: string[];

  if (mode === "demo-guided") {
    orderedCardIds = [...DEMO_GUIDED_DECKS[culture]];
  } else {
    const baseDeck = getStarterDeckForCulture(culture);
    const shuffled = shuffleCardIdsDeterministically(baseDeck, nextRngState);
    orderedCardIds = shuffled.shuffled;
    nextRngState = shuffled.nextState;
  }

  const allInstances: HandCardInstance[] = orderedCardIds.map((cardId, idx) => ({
    instanceId: `${side}-card-${idx + 1}-${cardId}`,
    cardId,
  }));

  const hand = allInstances.slice(0, INITIAL_HAND_SIZE);
  const deck = allInstances.slice(INITIAL_HAND_SIZE);
  const maxBreath = options.initialBreath ?? INITIAL_MAX_BREATH;

  return {
    player: {
      side,
      name,
      culture,
      breath: maxBreath,
      maxBreath,
      heart: createInitialKingdomHeart(side, culture),
      hand,
      deck,
      graveyard: [],
      empowerPowerBonusThisTurn: 0,
    },
    nextRngState,
  };
}

export function drawCardsForPlayer(
  player: PlayerMatchState,
  count: number,
): { player: PlayerMatchState; drawn: HandCardInstance[] } {
  if (count <= 0 || player.deck.length === 0) {
    return { player, drawn: [] };
  }

  let hand = [...player.hand];
  let deck = [...player.deck];
  let graveyard = [...player.graveyard];
  const drawn: HandCardInstance[] = [];

  for (let i = 0; i < count; i += 1) {
    const nextCard = deck[0];
    if (!nextCard) break;
    deck = deck.slice(1);
    if (hand.length < MAX_HAND_SIZE) {
      hand = [...hand, nextCard];
      drawn.push(nextCard);
    } else {
      graveyard = [...graveyard, nextCard];
    }
  }

  return {
    player: {
      ...player,
      hand,
      deck,
      graveyard,
    },
    drawn,
  };
}

export function applyDamageToKingdomHeart(
  heart: KingdomHeartState,
  rawDamage: number,
): {
  heart: KingdomHeartState;
  damageDealt: number;
  destroyed: boolean;
} {
  if (rawDamage <= 0) {
    return { heart, damageDealt: 0, destroyed: heart.currentHp <= 0 };
  }

  const absorbed = Math.min(heart.shield, rawDamage);
  const netDamage = rawDamage - absorbed;
  const nextShield = heart.shield - absorbed;
  const nextHp = Math.max(0, heart.currentHp - netDamage);

  return {
    heart: {
      ...heart,
      shield: nextShield,
      currentHp: nextHp,
    },
    damageDealt: netDamage,
    destroyed: nextHp <= 0,
  };
}

export function getOppositeSide(side: PlayerSide): PlayerSide {
  return side === "player" ? "opponent" : "player";
}
