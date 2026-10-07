"use client";

import { BookOpen, ChevronLeft, ChevronRight, Filter, MapPin, Search, Shield, Sparkles, Swords } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { ARPG_DUNGEON_CONFIGS } from "@/game/arpg/content/dungeons";
import { CREATURES, ELEMENT_META, REGIONS } from "@/game/catalog";
import { ELEMENTS, type CombatRole, type Element } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PixelCreature } from "./pixel-creature";

const PAGE_SIZE = 24;
type EnemyKind = "monster" | "boss";

const roleNames: Record<CombatRole, string> = {
  striker: "Ataques diretos",
  guardian: "Proteção do território",
  support: "Apoio a outros seres",
  controller: "Controle do terreno",
  skirmisher: "Movimentos velozes",
};
const encounterBehaviorNames = {
  melee: "Combate corpo a corpo",
  ranged: "Ataques à distância",
  charger: "Investidas rápidas",
  caster: "Ataques mágicos",
  elite: "Resistência e pressão",
};
const dungeonRegionIds = {
  "mata-encantada": "roots",
  "arquipelago-das-mares": "archipelago",
  "montanhas-runicas": "runic",
};
const traitNames = new Map<string, string>([
  ...ELEMENTS.map((element): [string, string] => [element, ELEMENT_META[element].name]),
  ...Object.entries(roleNames),
]);

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

const dungeonEncounters = Object.values(ARPG_DUNGEON_CONFIGS).flatMap((dungeon) =>
  Object.entries(dungeon.enemies).map(([slot, enemy]) => ({
    slot,
    enemy,
    habitat: dungeon.name,
    regionId: dungeonRegionIds[dungeon.id],
    normalizedName: normalizeName(enemy.name),
  })),
);

const BESTIARY_ENTRIES = CREATURES.map((creature) => {
  const normalizedName = normalizeName(creature.name);
  const encounter = dungeonEncounters.find((entry) =>
    entry.normalizedName === normalizedName
      || (entry.slot === "boss" && entry.normalizedName.startsWith(`${normalizedName} `)),
  );
  const kind: EnemyKind = encounter?.slot === "boss" || encounter?.slot === "miniBoss" ? "boss" : "monster";
  return {
    creature,
    encounter,
    kind,
    name: encounter?.enemy.name ?? creature.name,
    habitat: encounter?.habitat ?? REGIONS.find((region) => region.id === creature.regionId)?.name ?? creature.folklore.origin,
    regionId: encounter?.regionId ?? creature.regionId,
    behavior: encounter?.enemy.combatRole ? encounterBehaviorNames[encounter.enemy.combatRole] : roleNames[creature.role],
    encounterLabel: encounter?.slot === "miniBoss" ? "Mini chefe" : kind === "boss" ? "Chefe de expedição" : "Monstro",
  };
});
const BOSS_COUNT = BESTIARY_ENTRIES.filter((entry) => entry.kind === "boss").length;

type CollectionViewProps = {
  /** @deprecated Bestiary entries are public and do not depend on ownership. */
  ownedCatalogIds?: string[];
};

export function CollectionView(props: CollectionViewProps = {}) {
  // Keep the previous caller shape compatible while the encyclopedia ignores progress.
  void props;
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | "all">("all");
  const [habitat, setHabitat] = useState("all");
  const [kind, setKind] = useState<EnemyKind | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(BESTIARY_ENTRIES[0]?.creature.id ?? "");

  const entries = useMemo(() => {
    const normalized = normalizeName(query.trim());
    return BESTIARY_ENTRIES.filter((entry) => {
      const creature = entry.creature;
      const matchesElement = element === "all" || creature.element === element;
      const matchesHabitat = habitat === "all" || entry.regionId === habitat;
      const matchesKind = kind === "all" || entry.kind === kind;
      const matchesQuery = !normalized || normalizeName([
        entry.name,
        creature.name,
        creature.title,
        entry.habitat,
        creature.folklore.tradition,
        creature.folklore.origin,
        ...creature.traits,
      ].join(" ")).includes(normalized);
      return matchesElement && matchesHabitat && matchesKind && matchesQuery;
    });
  }, [element, habitat, kind, query]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = entries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = pageEntries.find((entry) => entry.creature.id === selectedId) ?? pageEntries[0];
  const selectedElement = selected ? ELEMENT_META[selected.creature.element] : null;

  return (
    <section className="content-view collection-view" aria-labelledby="bestiary-title">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Enciclopédia de inimigos</span>
          <h1 id="bestiary-title">Bestiário de Folklard</h1>
          <p>Conheça os monstros e chefes do mundo, seus habitats e as histórias que inspiram cada encontro.</p>
        </div>
        <div className="catalog-progress">
          <strong>{BESTIARY_ENTRIES.length}</strong>
          <span>fichas para consultar</span>
          <small>{BOSS_COUNT} chefes e mini chefes das expedições</small>
        </div>
      </header>

      <div className="collection-toolbar collection-toolbar--advanced">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Pesquisar no Bestiário</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Nome, habitat, origem ou traço"
          />
        </label>

        <div className="collection-filter-row" aria-label="Filtrar por elemento">
          <span><Filter aria-hidden="true" /> Elemento</span>
          <button type="button" className={cn(element === "all" && "is-active")} aria-pressed={element === "all"} onClick={() => { setElement("all"); setPage(1); }}>Todos</button>
          {ELEMENTS.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(element === item && "is-active")}
              aria-pressed={element === item}
              onClick={() => { setElement(item); setPage(1); }}
              style={{ "--filter": ELEMENT_META[item].color } as CSSProperties}
            >
              {ELEMENT_META[item].short} {ELEMENT_META[item].name}
            </button>
          ))}
        </div>

        <div className="collection-filter-row" aria-label="Filtrar por habitat">
          <span><MapPin aria-hidden="true" /> Habitat</span>
          <button type="button" className={cn(habitat === "all" && "is-active")} aria-pressed={habitat === "all"} onClick={() => { setHabitat("all"); setPage(1); }}>Todos</button>
          {REGIONS.map((region) => (
            <button key={region.id} type="button" className={cn(habitat === region.id && "is-active")} aria-pressed={habitat === region.id} onClick={() => { setHabitat(region.id); setPage(1); }}>
              {region.name}
            </button>
          ))}
        </div>

        <div className="collection-filter-row" aria-label="Filtrar por tipo de inimigo">
          <span>Encontro</span>
          <button type="button" className={cn(kind === "all" && "is-active")} aria-pressed={kind === "all"} onClick={() => { setKind("all"); setPage(1); }}>Todos</button>
          <button type="button" className={cn(kind === "monster" && "is-active")} aria-pressed={kind === "monster"} onClick={() => { setKind("monster"); setPage(1); }}>Monstros</button>
          <button type="button" className={cn(kind === "boss" && "is-active")} aria-pressed={kind === "boss"} onClick={() => { setKind("boss"); setPage(1); }}>Chefes e mini chefes</button>
        </div>
      </div>

      <div className="collection-summary" role="status" aria-live="polite">
        <Badge>{entries.length} {entries.length === 1 ? "ficha encontrada" : "fichas encontradas"}</Badge>
        <p>Abra uma ficha para consultar o habitat, a tradição e os traços do inimigo.</p>
      </div>

      {selected && selectedElement ? (
        <section className="bestiary-book" aria-label={`Ficha de ${selected.name}`}>
          <div className="bestiary-book__spine" aria-hidden="true" />
          <article className="bestiary-book__page bestiary-book__page--art">
            <div className="bestiary-book__folio"><BookOpen aria-hidden="true" /> Entrada {String(BESTIARY_ENTRIES.indexOf(selected) + 1).padStart(2, "0")}</div>
            <div className="bestiary-book__portrait" style={{ "--bestiary-element": selectedElement.color } as CSSProperties}>
              <PixelCreature sprite={selected.creature.sprite} label={selected.name} />
              <Sparkles aria-hidden="true" />
            </div>
            <span className="bestiary-book__rarity">{selected.encounterLabel}</span>
            <h2>{selected.name}</h2>
            <p className="bestiary-book__title">{selected.creature.title}</p>
            {selected.encounter ? (
              <div className="bestiary-book__stats">
                <span aria-label={`Vitalidade base: ${selected.encounter.enemy.maxHp}`}><Shield aria-hidden="true" /> {selected.encounter.enemy.maxHp} PV</span>
                <span aria-label={`Dano de contato base: ${selected.encounter.enemy.contactDamage}`}><Swords aria-hidden="true" /> {selected.encounter.enemy.contactDamage} dano</span>
              </div>
            ) : null}
          </article>

          <article className="bestiary-book__page bestiary-book__page--lore">
            <span className="bestiary-book__element" style={{ "--bestiary-element": selectedElement.color } as CSSProperties}>
              {selectedElement.short} · {selectedElement.name}
            </span>
            <p>{selected.creature.description}</p>
            <blockquote>{selected.creature.lore}</blockquote>
            <dl>
              <div><dt>Habitat</dt><dd><MapPin aria-hidden="true" /> {selected.habitat}</dd></div>
              <div><dt>Tradição</dt><dd>{selected.creature.folklore.tradition}</dd></div>
              <div><dt>Origem</dt><dd>{selected.creature.folklore.origin}</dd></div>
              <div><dt>Traços</dt><dd>{selected.creature.traits.map((trait) => traitNames.get(trait) ?? trait).join(" · ")}</dd></div>
              <div><dt>Comportamento</dt><dd>{selected.behavior}</dd></div>
            </dl>
          </article>
        </section>
      ) : <p>Nenhum inimigo corresponde aos filtros. Experimente outro nome, habitat ou elemento.</p>}

      <div className="collection-grid" aria-label="Índice do Bestiário">
        {pageEntries.map((entry) => {
          const creature = entry.creature;
          const meta = ELEMENT_META[creature.element];
          return (
            <button
              key={creature.id}
              type="button"
              className={cn("creature-card text-left", creature.id === selected?.creature.id && "creature-card--indexed")}
              style={{ "--element": meta.color, "--element-glow": meta.glow } as CSSProperties}
              aria-label={`Abrir ficha de ${entry.name}`}
              aria-pressed={creature.id === selected?.creature.id}
              onClick={() => setSelectedId(creature.id)}
            >
              <div className="creature-card__halo" aria-hidden="true" />
              <div className="creature-card__header">
                <span className="creature-card__element" aria-hidden="true">{meta.short}</span>
                <strong className="truncate text-left font-black">{entry.name}</strong>
              </div>
              <div className="creature-card__art"><PixelCreature sprite={creature.sprite} label={entry.name} /></div>
              <p className="creature-card__source"><span>{entry.encounterLabel}</span>{entry.habitat}</p>
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{creature.description}</p>
              <Badge className="mt-3">{meta.name}</Badge>
            </button>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <nav className="collection-pagination" aria-label="Paginação do Bestiário">
          <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft aria-hidden="true" /> Anterior
          </Button>
          <span>Página {safePage} de {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            Próxima <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
