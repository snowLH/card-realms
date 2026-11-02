import type { Element, SpriteDefinition } from "@/game/types";

export const CULTURE_IDS = ["brasil", "japao"] as const;
export type CultureId = (typeof CULTURE_IDS)[number];

export const TERRITORY_BIOME_IDS = [
  "campos-ancestrais",
  "mata-encantada",
  "rio-dos-espiritos",
  "montanha-antiga",
  "terra-vulcanica",
  "reino-congelado",
  "deserto-sagrado",
  "reino-espiritual",
] as const;

export type TerritoryBiomeId = (typeof TERRITORY_BIOME_IDS)[number];

export const CARD_CATEGORIES = [
  "territory",
  "creature",
  "structure",
  "event",
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

export type PlayerSide = "player" | "opponent";

export type LaneIndex = 0 | 1 | 2 | 3;

export const BOARD_LANES: readonly LaneIndex[] = [0, 1, 2, 3] as const;

export type CreatureStatusId =
  | "confused"   // Confusão (ex.: Curupira): próximo ataque desvia ou falha com dano de desorientação
  | "veiled"     // Véu de Ilusão (ex.: Kitsune): anula o próximo dano recebido
  | "burning"    // Brasa Viva (ex.: Boitatá / Terra Vulcânica): sofre 1 de dano ao fim do turno
  | "rooted"     // Enraizado (ex.: Mapinguari): -1 ATQ e não pode trocar de faixa
  | "empowered"; // Despertar Elevado (ex.: Tengu / Eclipse): +2 ATQ neste turno

export type AwakeningPowerTargetKind =
  | "self-lane"
  | "any-lane"
  | "global";

export type AwakeningPowerEffectId =
  | "curupira-rastro-invertido"
  | "iara-canto-da-margem"
  | "saci-redemoinho-de-vento"
  | "boitata-circulo-incandescente"
  | "mapinguari-rugido-da-terra"
  | "kitsune-miragem-kitsunebi"
  | "kappa-desafio-prato-dagua"
  | "tengu-vendaval-yamabushi"
  | "oni-clava-ferro-ardente"
  | "raiju-salto-entre-nuvens";

export type AwakeningPowerDefinition = {
  id: AwakeningPowerEffectId;
  name: string;
  description: string;
  targetKind: AwakeningPowerTargetKind;
  animationElement: Element;
};

export type BaseCardDefinition = {
  id: string;
  name: string;
  subtitle: string;
  culture: CultureId | "neutral";
  category: CardCategory;
  cost: number;
  element: Element;
  description: string;
  folkloreNote: string;
  portrait: SpriteDefinition;
};

export type TerritoryCardDefinition = BaseCardDefinition & {
  category: "territory";
  biomeId: TerritoryBiomeId;
  onPlaceEffect: {
    healAllyCreature?: number;
    shieldAllyCreature?: number;
    drawCards?: number;
    buffMaxHpAlly?: number;
  };
};

export type CreatureCardDefinition = BaseCardDefinition & {
  category: "creature";
  attack: number;
  maxHp: number;
  favoredBiomes: readonly TerritoryBiomeId[];
  biomeAttackBonus: number;
  biomeShieldBonus?: number;
  swiftArrival?: boolean;
  actorId?: string;
  awakeningPower: AwakeningPowerDefinition;
};

export type StructureEffectId =
  | "altar-clareira-viva"
  | "fonte-aguas-doces"
  | "portao-torii-espiritual"
  | "torre-vigia-montanha";

export type StructureCardDefinition = BaseCardDefinition & {
  category: "structure";
  maxHp: number;
  propFrame: number;
  effectId: StructureEffectId;
  attackAuraBonus?: number;
  favorBiomeId?: TerritoryBiomeId;
  turnStartHeal?: number;
  turnStartShield?: number;
  turnEndStrikeDamage?: number;
  heartShieldReduction?: number;
};

export type EventEffectId =
  | "enchente-pororoca"
  | "incendio-brasa-viva"
  | "eclipse-das-lendas"
  | "neblina-dos-espiritos";

export type EventCardDefinition = BaseCardDefinition & {
  category: "event";
  effectId: EventEffectId;
  requiresLane: boolean;
  fxFrame: number;
};

export type CardDefinition =
  | TerritoryCardDefinition
  | CreatureCardDefinition
  | StructureCardDefinition
  | EventCardDefinition;

export type HandCardInstance = {
  instanceId: string;
  cardId: string;
};

export type BoardCreatureInstance = {
  instanceId: string;
  cardId: string;
  owner: PlayerSide;
  lane: LaneIndex;
  baseAttack: number;
  currentHp: number;
  maxHp: number;
  shield: number;
  canAct: boolean;
  summonedTurn: number;
  usedPowerCount: number;
  statuses: CreatureStatusId[];
};

export type BoardStructureInstance = {
  instanceId: string;
  cardId: string;
  owner: PlayerSide;
  lane: LaneIndex;
  currentHp: number;
  maxHp: number;
};

export type TerritorySlotState = {
  owner: PlayerSide;
  lane: LaneIndex;
  biomeId: TerritoryBiomeId;
  creature: BoardCreatureInstance | null;
  structure: BoardStructureInstance | null;
  turnModified: number;
};

export type KingdomHeartVisualState = "intact" | "damaged" | "critical" | "destroyed";

export type KingdomHeartState = {
  owner: PlayerSide;
  culture: CultureId;
  name: string;
  subtitle: string;
  currentHp: number;
  maxHp: number;
  shield: number;
};

export type PlayerMatchState = {
  side: PlayerSide;
  name: string;
  culture: CultureId;
  breath: number;
  maxBreath: number;
  heart: KingdomHeartState;
  hand: HandCardInstance[];
  deck: HandCardInstance[];
  graveyard: HandCardInstance[];
  empowerPowerBonusThisTurn: number;
};

export type MatchMode = "demo-guided" | "vs-ai" | "local-pass-and-play";

export type MatchLogEntry = {
  id: string;
  turn: number;
  side: PlayerSide;
  title: string;
  detail: string;
  kind: "summon" | "territory" | "structure" | "event" | "attack" | "power" | "heart" | "turn" | "victory";
};

export type GuidedStepHint = {
  stepIndex: number;
  title: string;
  instruction: string;
  recommendedCardId?: string;
  recommendedLane?: LaneIndex;
  recommendedAction?: "play-card" | "investida" | "despertar" | "end-turn";
};

export type MatchState = {
  matchId: string;
  seed: string;
  rngState: number;
  mode: MatchMode;
  turn: number;
  activeSide: PlayerSide;
  winner: PlayerSide | null;
  winReason: string | null;
  players: {
    player: PlayerMatchState;
    opponent: PlayerMatchState;
  };
  lanes: {
    player: [TerritorySlotState, TerritorySlotState, TerritorySlotState, TerritorySlotState];
    opponent: [TerritorySlotState, TerritorySlotState, TerritorySlotState, TerritorySlotState];
  };
  log: MatchLogEntry[];
  guidedStep: number;
};

export type MatchAction =
  | {
      type: "play-card";
      side: PlayerSide;
      handInstanceId: string;
      lane?: LaneIndex;
      targetSide?: PlayerSide;
    }
  | {
      type: "creature-investida";
      side: PlayerSide;
      lane: LaneIndex;
    }
  | {
      type: "creature-despertar";
      side: PlayerSide;
      lane: LaneIndex;
      targetLane?: LaneIndex;
    }
  | {
      type: "end-turn";
      side: PlayerSide;
    };

export type MatchVisualEvent =
  | {
      kind: "card-placed";
      side: PlayerSide;
      lane: LaneIndex;
      cardId: string;
      category: CardCategory;
    }
  | {
      kind: "creature-summoned";
      side: PlayerSide;
      lane: LaneIndex;
      cardId: string;
      creatureName: string;
      biomeId: TerritoryBiomeId;
      element: Element;
    }
  | {
      kind: "territory-transformed";
      side: PlayerSide;
      lane: LaneIndex;
      previousBiomeId: TerritoryBiomeId;
      nextBiomeId: TerritoryBiomeId;
      reason: string;
    }
  | {
      kind: "structure-built";
      side: PlayerSide;
      lane: LaneIndex;
      cardId: string;
      structureName: string;
    }
  | {
      kind: "structure-destroyed";
      side: PlayerSide;
      lane: LaneIndex;
      structureName: string;
    }
  | {
      kind: "creature-attack";
      attackerSide: PlayerSide;
      lane: LaneIndex;
      targetLane: LaneIndex;
      attackerName: string;
      damage: number;
      redirectedByConfusion?: boolean;
      blockedByVeil?: boolean;
      hitHeart?: boolean;
    }
  | {
      kind: "creature-awakening";
      side: PlayerSide;
      lane: LaneIndex;
      targetLane: LaneIndex;
      creatureName: string;
      powerName: string;
      element: Element;
    }
  | {
      kind: "event-triggered";
      side: PlayerSide;
      cardId: string;
      eventName: string;
      lane?: LaneIndex;
    }
  | {
      kind: "creature-defeated";
      side: PlayerSide;
      lane: LaneIndex;
      creatureName: string;
    }
  | {
      kind: "heart-damaged";
      side: PlayerSide;
      damage: number;
      remainingHp: number;
    }
  | {
      kind: "turn-started";
      side: PlayerSide;
      turn: number;
    }
  | {
      kind: "match-won";
      winner: PlayerSide;
      reason: string;
    };

export type ActionResolutionResult = {
  ok: boolean;
  error?: string;
  state: MatchState;
  events: MatchVisualEvent[];
};
