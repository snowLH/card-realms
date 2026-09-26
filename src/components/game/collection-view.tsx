"use client";

import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CREATURES, ELEMENT_META, IMPLEMENTATION_NOTE } from "@/game/catalog";
import { ELEMENTS, type Element } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CreatureCard } from "./creature-card";

export function CollectionView() {
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | "all">("all");

  const creatures = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return CREATURES.filter((creature) => {
      const matchesElement = element === "all" || creature.element === element;
      const matchesQuery =
        !normalized ||
        `${creature.name} ${creature.title} ${creature.inspiration}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesElement && matchesQuery;
    });
  }, [element, query]);

  return (
    <section className="content-view collection-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Atlas de seres</span>
          <h1>Bestiário de Aurória</h1>
          <p>
            Folclores do mundo reinterpretados em criaturas originais — sem misturar fontes sagradas com invenções do jogo.
          </p>
        </div>
        <div className="catalog-progress">
          <strong>{IMPLEMENTATION_NOTE.completeCreatures}</strong>
          <span>criaturas completas nesta etapa</span>
          <small>Meta final: {IMPLEMENTATION_NOTE.catalogTarget}</small>
        </div>
      </header>

      <div className="collection-toolbar">
        <label className="search-field">
          <Search />
          <span className="sr-only">Pesquisar criaturas</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, origem ou título"
          />
        </label>
        <div className="element-filters" aria-label="Filtrar por tipo">
          <button type="button" className={cn(element === "all" && "is-active")} onClick={() => setElement("all")}>
            <Filter /> Todos
          </button>
          {ELEMENTS.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(element === item && "is-active")}
              onClick={() => setElement(item)}
              style={{ "--filter": ELEMENT_META[item].color } as React.CSSProperties}
            >
              <span>{ELEMENT_META[item].short}</span> {ELEMENT_META[item].name}
            </button>
          ))}
        </div>
      </div>

      <div className="collection-summary">
        <Badge>{creatures.length} resultados</Badge>
        <p>{IMPLEMENTATION_NOTE.statement}</p>
      </div>

      <div className="collection-grid">
        {creatures.map((creature) => (
          <CreatureCard key={creature.id} creature={creature} />
        ))}
      </div>
    </section>
  );
}
