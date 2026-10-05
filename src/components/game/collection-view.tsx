"use client";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Filter,
  LockKeyhole,
  MapPin,
  Search,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { CREATURES, ELEMENT_META, IMPLEMENTATION_NOTE } from "@/game/catalog";
import type { RemotePlayerSnapshot } from "@/game/player";
import {
  ELEMENTS,
  type CombatRole,
  type Element,
  type Rarity,
} from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "./creature-card";
import { PixelCreature } from "./pixel-creature";

const PAGE_SIZE = 24;

const rarityNames: Record<Rarity, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
  mythic: "Mítica",
};

const roleNames: Record<CombatRole, string> = {
  striker: "Atacante",
  guardian: "Guardião",
  support: "Suporte",
  controller: "Controlador",
  skirmisher: "Escaramuçador",
};

const rarities: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const roles: CombatRole[] = ["striker", "guardian", "support", "controller", "skirmisher"];

type OwnedCreature = RemotePlayerSnapshot["collection"][number];

export function CollectionView({
  ownedCatalogIds,
  collection = [],
  coins = 0,
  onEvolve,
}: {
  ownedCatalogIds?: string[];
  collection?: OwnedCreature[];
  coins?: number;
  onEvolve?: (instanceId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | "all">("all");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [role, setRole] = useState<CombatRole | "all">("all");
  const [page, setPage] = useState(1);
  const [evolving, setEvolving] = useState(false);
  const [message, setMessage] = useState("");
  const ownedIds = useMemo(
    () => ownedCatalogIds ?? [...new Set(collection.map((item) => item.catalogId))],
    [collection, ownedCatalogIds],
  );
  const [selectedId, setSelectedId] = useState(() => ownedIds[0] ?? CREATURES[0].id);

  const creatures = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return CREATURES.filter((creature) => {
      const matchesElement = element === "all" || creature.element === element;
      const matchesRarity = rarity === "all" || creature.rarity === rarity;
      const matchesRole = role === "all" || creature.role === role;
      const matchesQuery =
        !normalized
        || (
          creature.name + " "
          + creature.title + " "
          + creature.folklore.tradition + " "
          + creature.folklore.origin + " "
          + creature.traits.join(" ")
        )
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesElement && matchesRarity && matchesRole && matchesQuery;
    });
  }, [element, query, rarity, role]);


  const totalPages = Math.max(1, Math.ceil(creatures.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageCreatures = creatures.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const effectiveSelectedId = ownedIds.length > 0 && !ownedIds.includes(selectedId)
    ? ownedIds[0]
    : selectedId;
  const selected = creatures.find((creature) => creature.id === effectiveSelectedId)
    ?? CREATURES.find((creature) => creature.id === effectiveSelectedId)
    ?? creatures[0]
    ?? CREATURES[0];
  const selectedElement = ELEMENT_META[selected.element];
  const selectedOwned = ownedCatalogIds === undefined && collection.length === 0
    ? true
    : ownedIds.includes(selected.id);

  const selectedInstances = collection
    .filter((item) => item.catalogId === selected.id)
    .slice()
    .sort((left, right) => right.evolutionStage - left.evolutionStage || left.acquiredAt.localeCompare(right.acquiredAt));
  const primaryInstance = selectedInstances[0] ?? null;
  const freeCopies = selectedInstances.filter((item) => item.instanceId !== primaryInstance?.instanceId);
  const stage = primaryInstance?.evolutionStage ?? 0;
  const evolutionCost = stage === 0 ? 150 : 300;
  const canEvolve = Boolean(
    onEvolve
      && primaryInstance
      && stage < 2
      && freeCopies.length >= 2
      && coins >= evolutionCost,
  );

  async function evolve() {
    if (!onEvolve || !primaryInstance || !canEvolve) return;
    setEvolving(true);
    setMessage("");
    try {
      await onEvolve(primaryInstance.instanceId);
      setMessage("Vínculo evoluído. Duas cópias extras foram transmutadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível evoluir esta carta.");
    } finally {
      setEvolving(false);
    }
  }

  return (
    <section className="content-view collection-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Atlas de seres</span>
          <h1>Bestiário de Aurória</h1>
          <p>
            Seres de folclores e mitologias reais, adaptados para o combate sem apagar seus nomes,
            origens ou traços fundamentais.
          </p>
        </div>
        <div className="catalog-progress">
          <strong>{ownedIds.length || IMPLEMENTATION_NOTE.completeCreatures}/{IMPLEMENTATION_NOTE.completeCreatures}</strong>
          <span>{ownedCatalogIds || collection.length ? "cartas descobertas" : "criaturas disponíveis nesta etapa"}</span>
          <small>Arquitetura preparada para o catálogo crescer sem renderizar tudo de uma vez.</small>
        </div>
      </header>

      <div className="collection-toolbar collection-toolbar--advanced">
        <label className="search-field">
          <Search />
          <span className="sr-only">Pesquisar criaturas</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, origem, traço ou título"
          />
        </label>

        <div className="collection-filter-row" aria-label="Filtrar por elemento">
          <span><Filter /> Elemento</span>
          <button type="button" className={cn(element === "all" && "is-active")} onClick={() => setElement("all")}>Todos</button>
          {ELEMENTS.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(element === item && "is-active")}
              onClick={() => setElement(item)}
              style={{ "--filter": ELEMENT_META[item].color } as CSSProperties}
            >
              {ELEMENT_META[item].short} {ELEMENT_META[item].name}
            </button>
          ))}
        </div>

        <div className="collection-filter-row" aria-label="Filtrar por raridade">
          <span>Raridade</span>
          <button type="button" className={cn(rarity === "all" && "is-active")} onClick={() => setRarity("all")}>Todas</button>
          {rarities.map((item) => (
            <button key={item} type="button" className={cn(rarity === item && "is-active")} onClick={() => setRarity(item)}>
              {rarityNames[item]}
            </button>
          ))}
        </div>

        <div className="collection-filter-row" aria-label="Filtrar por função">
          <span>Função</span>
          <button type="button" className={cn(role === "all" && "is-active")} onClick={() => setRole("all")}>Todas</button>
          {roles.map((item) => (
            <button key={item} type="button" className={cn(role === item && "is-active")} onClick={() => setRole(item)}>
              {roleNames[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="collection-summary">
        <Badge>{creatures.length} resultados</Badge>
        {ownedCatalogIds || collection.length ? <Badge>{ownedIds.length} espécies possuídas</Badge> : null}
        {collection.length ? <Badge>{collection.length} cartas totais</Badge> : null}
        <p>{IMPLEMENTATION_NOTE.statement}</p>
      </div>

      <section className="bestiary-book" aria-label={"Ficha de " + selected.name}>
        <div className="bestiary-book__spine" aria-hidden />
        <article className={cn("bestiary-book__page bestiary-book__page--art", !selectedOwned && "bestiary-book__page--locked")}>
          <div className="bestiary-book__folio"><BookOpen /> Entrada {String(CREATURES.indexOf(selected) + 1).padStart(2, "0")}</div>
          {selectedOwned ? <>
            <div className="bestiary-book__portrait" style={{ "--bestiary-element": selectedElement.color } as CSSProperties}>
              <PixelCreature sprite={selected.sprite} label={selected.name} />
              <Sparkles aria-hidden />
            </div>
            <span className="bestiary-book__rarity">{rarityNames[selected.rarity]} · {roleNames[selected.role]}</span>
            <h2>{selected.name}</h2>
            <p className="bestiary-book__title">{selected.title}</p>
            <div className="bestiary-book__stats">
              <span><Swords /> {selected.attacks[0].damage}</span>
              <span><Shield /> {selected.defense}</span>
              <span><Zap /> {selected.speed}</span>
            </div>
          </> : <div className="bestiary-book__unknown"><LockKeyhole /><strong>Entrada desconhecida</strong><span>Encontre esta carta para revelar sua ficha.</span></div>}
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

            {selected.evolutionLine ? (
              <div className="bestiary-evolution-line">
                <span className="view-eyebrow">LINHA EVOLUTIVA · 3 ESTÁGIOS</span>
                <div className="bestiary-evolution-line__stages">
                  {selected.evolutionLine.map((entry) => (
                    <article key={entry.stage} className={cn(entry.stage === stage && "is-current")}>
                      <span>ESTÁGIO {entry.stage + 1}</span>
                      <PixelCreature sprite={entry.sprite} label={entry.name} />
                      <strong>{entry.name}</strong>
                      <small>{entry.stage < 2 ? "Adaptação Card Realms" : "Forma final do Bestiário"}</small>
                    </article>
                  ))}
                </div>
                <p>As duas formas anteriores são adaptações do jogo; a terceira preserva a criatura folclórica final.</p>
              </div>
            ) : null}

            {primaryInstance ? (
              <div className="collection-evolution">
                <div>
                  <span className="view-eyebrow">VÍNCULO PERSISTENTE</span>
                  <strong>{stage >= 2 ? "Vínculo máximo" : "Estágio " + stage + " → " + (stage + 1)}</strong>
                  <small>
                    {stage >= 2
                      ? "Esta carta já alcançou seu domínio máximo."
                      : freeCopies.length + "/2 cópias extras livres · " + evolutionCost + " moedas"}
                  </small>
                </div>
                {stage < 2 ? (
                  <Button variant="game" disabled={!canEvolve || evolving} onClick={() => void evolve()}>
                    <Sparkles /> Evoluir vínculo
                  </Button>
                ) : <Badge><Sparkles /> Máximo</Badge>}
                {stage < 2 && coins < evolutionCost ? <small><Coins /> Faltam moedas para a transmutação.</small> : null}
                {message ? <p role="status">{message}</p> : null}
              </div>
            ) : null}
          </> : <div className="bestiary-book__unknown bestiary-book__unknown--lore"><strong>???</strong><p>Tradição, origem, história, elemento e ataques permanecem ocultos até a descoberta.</p></div>}
        </article>
      </section>

      <div className="collection-grid">
        {pageCreatures.map((creature) => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            owned={ownedCatalogIds || collection.length ? ownedIds.includes(creature.id) : undefined}
            className={creature.id === selected.id ? "creature-card--indexed" : undefined}
            onClick={() => setSelectedId(creature.id)}
          />
        ))}
      </div>

      {totalPages > 1 ? (
        <nav className="collection-pagination" aria-label="Paginação do bestiário">
          <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft /> Anterior
          </Button>
          <span>Página {safePage} de {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            Próxima <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
