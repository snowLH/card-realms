"use client";

import { BookOpen, Filter, LockKeyhole, MapPin, Search, Shield, Sparkles, Swords, Zap } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { CREATURES, ELEMENT_META, IMPLEMENTATION_NOTE } from "@/game/catalog";
import { ELEMENTS, type Element } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CreatureCard } from "./creature-card";
import { PixelCreature } from "./pixel-creature";

export function CollectionView({ ownedCatalogIds }: { ownedCatalogIds?: string[] }) {
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | "all">("all");
  const [selectedId, setSelectedId] = useState(() => ownedCatalogIds?.[0] ?? CREATURES[0].id);

  const creatures = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return CREATURES.filter((creature) => {
      const matchesElement = element === "all" || creature.element === element;
      const matchesQuery =
        !normalized ||
        `${creature.name} ${creature.title} ${creature.folklore.tradition} ${creature.folklore.origin}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesElement && matchesQuery;
    });
  }, [element, query]);
  const effectiveSelectedId = ownedCatalogIds?.length && !ownedCatalogIds.includes(selectedId)
    ? ownedCatalogIds[0]
    : selectedId;
  const selected = creatures.find((creature) => creature.id === effectiveSelectedId) ?? creatures[0] ?? CREATURES[0];
  const selectedElement = ELEMENT_META[selected.element];
  const selectedOwned = !ownedCatalogIds || ownedCatalogIds.includes(selected.id);

  return (
    <section className="content-view collection-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Atlas de seres</span>
          <h1>Bestiário de Aurória</h1>
          <p>
            Seres de folclores e mitologias reais, adaptados para o combate sem apagar seus nomes, origens ou traços fundamentais.
          </p>
        </div>
        <div className="catalog-progress">
          <strong>{ownedCatalogIds?.length ?? IMPLEMENTATION_NOTE.completeCreatures}/{IMPLEMENTATION_NOTE.completeCreatures}</strong>
          <span>{ownedCatalogIds ? "cartas descobertas" : "criaturas disponíveis nesta etapa"}</span>
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
        {ownedCatalogIds ? <Badge>{ownedCatalogIds.length} possuídos</Badge> : null}
        <p>{IMPLEMENTATION_NOTE.statement}</p>
      </div>

      <section className="bestiary-book" aria-label={`Ficha de ${selected.name}`}>
        <div className="bestiary-book__spine" aria-hidden />
        <article className={cn("bestiary-book__page bestiary-book__page--art", !selectedOwned && "bestiary-book__page--locked")}>
          <div className="bestiary-book__folio"><BookOpen /> Entrada {String(CREATURES.indexOf(selected) + 1).padStart(2, "0")}</div>
          {selectedOwned ? <>
            <div className="bestiary-book__portrait" style={{ "--bestiary-element": selectedElement.color } as CSSProperties}>
              <PixelCreature sprite={selected.sprite} label={selected.name} />
              <Sparkles aria-hidden />
            </div>
            <span className="bestiary-book__rarity">{selected.rarity}</span>
            <h2>{selected.name}</h2>
            <p className="bestiary-book__title">{selected.title}</p>
            <div className="bestiary-book__stats">
              <span><Swords /> {selected.attacks[0].damage}</span>
              <span><Shield /> {selected.defense}</span>
              <span><Zap /> {selected.speed}</span>
            </div>
          </> : <div className="bestiary-book__unknown"><LockKeyhole /><strong>Entrada desconhecida</strong><span>Abra baús para revelar esta carta.</span></div>}
        </article>
        <article className={cn("bestiary-book__page bestiary-book__page--lore", !selectedOwned && "bestiary-book__page--locked")}>
          {selectedOwned ? <>
          <span className="bestiary-book__element" style={{ "--bestiary-element": selectedElement.color } as CSSProperties}>
            {selectedElement.short} · {selectedElement.name}
          </span>
          <p>{selected.description}</p>
          <blockquote>{selected.lore}</blockquote>
          <dl>
            <div><dt>Tradição</dt><dd>{selected.folklore.tradition}</dd></div>
            <div><dt>Origem</dt><dd>{selected.folklore.origin}</dd></div>
            <div><dt>Encontro</dt><dd><MapPin /> {selected.obtainableBy}</dd></div>
          </dl>
          <div className="bestiary-book__moves">
            {selected.attacks.map((attack) => (
              <span key={attack.id}><strong>{attack.name}</strong><small>{attack.damage} dano · dado {attack.minRoll}+</small></span>
            ))}
          </div>
          </> : <div className="bestiary-book__unknown bestiary-book__unknown--lore"><strong>???</strong><p>Tradição, origem, história, elemento e ataques permanecem ocultos até a descoberta.</p></div>}
        </article>
      </section>

      <div className="collection-grid">
        {creatures.map((creature) => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            owned={ownedCatalogIds ? ownedCatalogIds.includes(creature.id) : undefined}
            className={creature.id === selected.id ? "creature-card--indexed" : undefined}
            onClick={() => setSelectedId(creature.id)}
          />
        ))}
      </div>
    </section>
  );
}
