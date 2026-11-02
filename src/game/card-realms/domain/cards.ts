import { ALL_CARD_REALMS_CARDS, CARD_BY_ID } from "../content/cards";
import type {
  CardCategory,
  CardDefinition,
  CreatureCardDefinition,
  EventCardDefinition,
  StructureCardDefinition,
  TerritoryCardDefinition,
} from "./types";

export const CARD_CATEGORY_LABELS: Readonly<Record<CardCategory, string>> = {
  territory: "Território",
  creature: "Lenda",
  structure: "Estrutura",
  event: "Evento",
};

export function getCardDefinition(cardId: string): CardDefinition {
  const card = CARD_BY_ID.get(cardId);
  if (!card) {
    throw new Error(`Carta Card Realms não encontrada: ${cardId}`);
  }
  return card;
}

export function findCardDefinition(cardId: string): CardDefinition | undefined {
  return CARD_BY_ID.get(cardId);
}

export function isTerritoryCard(card: CardDefinition): card is TerritoryCardDefinition {
  return card.category === "territory";
}

export function isCreatureCard(card: CardDefinition): card is CreatureCardDefinition {
  return card.category === "creature";
}

export function isStructureCard(card: CardDefinition): card is StructureCardDefinition {
  return card.category === "structure";
}

export function isEventCard(card: CardDefinition): card is EventCardDefinition {
  return card.category === "event";
}

export function listAllCards(): readonly CardDefinition[] {
  return ALL_CARD_REALMS_CARDS;
}
