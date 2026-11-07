"use client";

import { useMemo, useState } from "react";
import { PixelCreature } from "@/components/game/pixel-creature";
import { Check, Crown, Gem, RotateCcw, X } from "@/components/ui/pixel-icon";
import { ALL_CARD_REALMS_CARDS } from "@/game/card-realms/content/cards";
import { getStarterDeckForCulture } from "@/game/card-realms/content/starter-decks";
import {
  CARD_CATEGORY_LABELS,
  CARD_RARITY_LABELS,
  getCardDefinition,
} from "@/game/card-realms/domain/cards";
import { getCulture } from "@/game/card-realms/domain/cultures";
import {
  CULTURE_IDS,
  type CardCategory,
  type CardDefinition,
  type CultureId,
} from "@/game/card-realms/domain/types";
import { cn } from "@/lib/utils";

const CULTURE_FLAG: Readonly<Record<CultureId, string>> = {
  brasil: "🇧🇷",
  japao: "🇯🇵",
  nordico: "❄️",
  grecia: "🏛️",
  egito: "☀️",
};

export function CardRealmsDeckBuilder({
  initialCulture = "brasil",
  onPlayWithDeck,
  onClose,
}: {
  initialCulture?: CultureId;
  onPlayWithDeck: (culture: CultureId, cardIds: readonly string[]) => void;
  onClose: () => void;
}) {
  const [selectedCulture, setSelectedCulture] = useState<CultureId>(initialCulture);
  const [deckCardIds, setDeckCardIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(`card-realms-deck-${initialCulture}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 8) return parsed;
        }
      } catch {
        // ignore
      }
    }
    return [...getStarterDeckForCulture(initialCulture)];
  });

  const [categoryFilter, setCategoryFilter] = useState<CardCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const availableCards = useMemo(() => {
    return ALL_CARD_REALMS_CARDS.filter((card) => {
      // Allow neutral cards or cards matching the chosen culture or other cultures
      if (categoryFilter !== "all" && card.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = card.name.toLowerCase().includes(query);
        const matchDesc = card.description.toLowerCase().includes(query);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [categoryFilter, searchQuery]);

  const deckCardsWithDefs = useMemo(() => {
    return deckCardIds.map((id, index) => ({
      instanceKey: `${id}-${index}`,
      def: getCardDefinition(id),
      index,
    }));
  }, [deckCardIds]);

  const deckStats = useMemo(() => {
    let totalCost = 0;
    let creatures = 0;
    let territories = 0;
    let structures = 0;
    let events = 0;

    for (const id of deckCardIds) {
      const def = getCardDefinition(id);
      totalCost += def.cost;
      if (def.category === "creature") creatures += 1;
      if (def.category === "territory") territories += 1;
      if (def.category === "structure") structures += 1;
      if (def.category === "event") events += 1;
    }

    const avgCost = deckCardIds.length > 0 ? (totalCost / deckCardIds.length).toFixed(1) : "0.0";
    return { count: deckCardIds.length, avgCost, creatures, territories, structures, events };
  }, [deckCardIds]);

  const handleCultureSwitch = (culture: CultureId) => {
    setSelectedCulture(culture);
    let nextDeck: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(`card-realms-deck-${culture}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 8) nextDeck = parsed;
        }
      } catch {
        // ignore
      }
    }
    if (nextDeck.length === 0) {
      nextDeck = [...getStarterDeckForCulture(culture)];
    }
    setDeckCardIds(nextDeck);
    setFeedback(`Baralho de ${getCulture(culture).name} carregado.`);
  };

  const handleAddCard = (card: CardDefinition) => {
    if (deckCardIds.length >= 20) {
      setFeedback("O baralho atingiu o limite máximo de 20 cartas.");
      return;
    }
    const copies = deckCardIds.filter((id) => id === card.id).length;
    if (copies >= 3) {
      setFeedback(`Limite de 3 cópias de ${card.name} por baralho atingido.`);
      return;
    }

    setDeckCardIds((prev) => [...prev, card.id]);
    setFeedback(`+1 ${card.name} adicionada ao baralho.`);
  };

  const handleRemoveCard = (index: number) => {
    if (deckCardIds.length <= 8) {
      setFeedback("O baralho deve possuir no mínimo 8 cartas para manter a viabilidade tática.");
      return;
    }
    const removedId = deckCardIds[index];
    const def = getCardDefinition(removedId);
    setDeckCardIds((prev) => prev.filter((_, idx) => idx !== index));
    setFeedback(`-1 ${def.name} removida.`);
  };

  const handleResetToStarter = () => {
    const starter = getStarterDeckForCulture(selectedCulture);
    setDeckCardIds([...starter]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`card-realms-deck-${selectedCulture}`);
    }
    setFeedback(`Baralho reiniciado para o padrão oficial de ${getCulture(selectedCulture).name}.`);
  };

  const handleSaveDeck = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `card-realms-deck-${selectedCulture}`,
        JSON.stringify(deckCardIds),
      );
    }
    setFeedback("Baralho salvo com sucesso no seu perfil!");
  };

  return (
    <div className="card-realms-deck-builder-overlay" role="dialog" aria-modal="true" aria-label="Construtor de Baralhos">
      <div className="card-realms-deck-builder-window">
        {/* Top Header */}
        <header className="card-realms-deck-builder-header">
          <div className="card-realms-deck-builder-title">
            <Crown size={22} aria-hidden="true" />
            <div>
              <h2>FORJA DO REINO — CONSTRUTOR DE BARALHOS</h2>
              <small>Personalize suas 16 cartas folclóricas e forje táticas lendárias</small>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar Construtor de Baralhos">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Culture Tabs */}
        <nav className="card-realms-deck-builder-cultures" aria-label="Escolher Cultura">
          {CULTURE_IDS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(selectedCulture === c && "is-active")}
              onClick={() => handleCultureSwitch(c)}
            >
              {CULTURE_FLAG[c]} {getCulture(c).name}
            </button>
          ))}
        </nav>

        {feedback && (
          <div className="card-realms-deck-builder-banner" role="status">
            {feedback}
          </div>
        )}

        {/* Main Content: Left Deck View | Right Cards Pool */}
        <div className="card-realms-deck-builder-body">
          {/* Deck Summary & List */}
          <section className="card-realms-deck-summary" aria-label="Seu Baralho Atual">
            <div className="card-realms-deck-summary-header">
              <h3>
                Reino: {CULTURE_FLAG[selectedCulture]} {getCulture(selectedCulture).name}
              </h3>
              <div className="card-realms-deck-stats-pill">
                <span>Total: {deckStats.count}/20 cartas</span>
                <span>Custo Médio: {deckStats.avgCost}</span>
              </div>
              <div className="card-realms-deck-stats-breakdown">
                <span>⚔️ Criaturas: {deckStats.creatures}</span>
                <span>🗺️ Terrenos: {deckStats.territories}</span>
                <span>🏛️ Estruturas: {deckStats.structures}</span>
                <span>✨ Eventos: {deckStats.events}</span>
              </div>
            </div>

            <div className="card-realms-deck-card-list">
              {deckCardsWithDefs.map(({ instanceKey, def, index }) => (
                <div key={instanceKey} className="card-realms-deck-item">
                  <div className="card-realms-deck-item-info">
                    <span className="card-realms-deck-item-cost">
                      <Gem size={12} aria-hidden="true" /> {def.cost}
                    </span>
                    <strong>{def.name}</strong>
                    <small>({def.category})</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(index)}
                    aria-label={`Remover ${def.name}`}
                    className="card-realms-deck-item-remove"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>

            <div className="card-realms-deck-actions">
              <button type="button" onClick={handleSaveDeck}>
                <Check size={14} aria-hidden="true" /> Salvar Baralho
              </button>
              <button type="button" onClick={handleResetToStarter}>
                <RotateCcw size={14} aria-hidden="true" /> Restaurar Padrão
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => {
                  handleSaveDeck();
                  onPlayWithDeck(selectedCulture, deckCardIds);
                }}
              >
                ⚔️ Jogar com este Baralho
              </button>
            </div>
          </section>

          {/* Cards Catalog Pool */}
          <section className="card-realms-deck-pool" aria-label="Acervo de Cartas Disponíveis">
            <div className="card-realms-deck-pool-controls">
              <div className="card-realms-deck-pool-filters">
                <button
                  type="button"
                  className={cn(categoryFilter === "all" && "is-active")}
                  onClick={() => setCategoryFilter("all")}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className={cn(categoryFilter === "creature" && "is-active")}
                  onClick={() => setCategoryFilter("creature")}
                >
                  ⚔️ Lendas
                </button>
                <button
                  type="button"
                  className={cn(categoryFilter === "territory" && "is-active")}
                  onClick={() => setCategoryFilter("territory")}
                >
                  🗺️ Terrenos
                </button>
                <button
                  type="button"
                  className={cn(categoryFilter === "structure" && "is-active")}
                  onClick={() => setCategoryFilter("structure")}
                >
                  🏛️ Estruturas
                </button>
                <button
                  type="button"
                  className={cn(categoryFilter === "event" && "is-active")}
                  onClick={() => setCategoryFilter("event")}
                >
                  ✨ Eventos
                </button>
              </div>

              <input
                type="search"
                placeholder="Buscar carta por nome ou efeito..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="card-realms-deck-search"
                aria-label="Buscar carta"
              />
            </div>

            <div className="card-realms-deck-pool-grid">
              {availableCards.map((card) => {
                const countInDeck = deckCardIds.filter((id) => id === card.id).length;
                return (
                  <article key={card.id} className="card-realms-pool-card">
                    <div className="card-realms-pool-card-art">
                      <PixelCreature sprite={card.portrait} label={card.name} />
                      <div className="card-realms-pool-card-heading">
                        <strong>{card.name}</strong>
                        <small>
                          {CARD_CATEGORY_LABELS[card.category]} · {CARD_RARITY_LABELS[card.rarity].name} · Custo {card.cost}
                        </small>
                      </div>
                    </div>
                    <p className="card-realms-pool-card-desc">{card.description}</p>
                    <div className="card-realms-pool-card-footer">
                      <span className="card-realms-pool-card-copies">
                        No baralho: {countInDeck}/3
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddCard(card)}
                        disabled={countInDeck >= 3 || deckCardIds.length >= 20}
                      >
                        + Adicionar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
