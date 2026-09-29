"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Castle,
  Check,
  Compass,
  Footprints,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
  TentTree,
} from "lucide-react";
import { useMemo, useState } from "react";
import { REGIONS } from "@/game/catalog";
import type { Activity, RegionAreaDefinition, RegionDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const activityMeta = {
  explore: { label: "Explorar trilha", icon: Compass, battle: true },
  wild: { label: "Procurar criatura", icon: Sparkles, battle: true },
  npc: { label: "Enfrentar viajante", icon: Swords, battle: true },
  treasure: { label: "Abrir baú da área", icon: PackageOpen, battle: false },
  sanctuary: { label: "Entrar no santuário", icon: Shield, battle: true },
  boss: { label: "Desafiar guardião", icon: Castle, battle: true },
} as const;

export function WorldMap({
  selected,
  playerRegionId,
  currentAreaId,
  visitedAreaIds,
  onSelect,
  onTravel,
  onVisitArea,
  onBattle,
  onTreasure,
  onOpenVillage,
}: {
  selected: RegionDefinition | null;
  playerRegionId: string;
  currentAreaId: string | null;
  visitedAreaIds: string[];
  onSelect: (region: RegionDefinition | null) => void;
  onTravel: (region: RegionDefinition) => void;
  onVisitArea: (region: RegionDefinition, area: RegionAreaDefinition) => void;
  onBattle: (region: RegionDefinition, activity: Activity) => void;
  onTreasure: (region: RegionDefinition) => void;
  onOpenVillage: () => void;
}) {
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(currentAreaId);
  const currentRegion = REGIONS.find((region) => region.id === playerRegionId) ?? REGIONS[0];
  const activeRegion = useMemo(
    () => REGIONS.find((region) => region.id === activeRegionId) ?? null,
    [activeRegionId],
  );
  const canTravelToSelected = selected ? currentRegion.neighbors.includes(selected.id) : false;

  if (activeRegion?.areas?.length) {
    return (
      <RegionExplorer
        region={activeRegion}
        currentAreaId={currentAreaId}
        visitedAreaIds={visitedAreaIds}
        selectedAreaId={selectedAreaId}
        onSelectArea={setSelectedAreaId}
        onBack={() => {
          setActiveRegionId(null);
          setSelectedAreaId(null);
        }}
        onVisit={(area) => {
          onVisitArea(activeRegion, area);
          setSelectedAreaId(area.id);
          const meta = activityMeta[area.activity];
          if (meta.battle) onBattle(activeRegion, area.activity);
          else onTreasure(activeRegion);
        }}
      />
    );
  }

  return (
    <section className="world-map-shell" aria-label="Mapa de Aurória">
      <div className="world-map">
        <Image
          src="/art/world-map-pixel-v2.png"
          alt="Mapa top-down em pixel art de Aurória, com regiões, vilas, trilhas, santuários, ruínas e portais"
          fill
          priority
          sizes="(max-width: 768px) 100vw, calc(100vw - 320px)"
          className="object-cover [image-rendering:pixelated]"
        />
        <div className="world-map__shade" />

        <div className="world-map__title">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200">Atlas vivo</span>
          <h1>Terras de Aurória</h1>
          <p>Viaje pelo atlas e entre em cada região para explorar cinco áreas próprias.</p>
        </div>

        <div
          role="img"
          className="player-map-marker"
          style={{ left: `${currentRegion.mapPosition.x}%`, top: `${currentRegion.mapPosition.y}%` }}
          aria-label={`Sua posição: ${currentRegion.name}`}
        >
          <Footprints /><span>Você</span>
        </div>

        {REGIONS.map((region) => {
          const isSelected = selected?.id === region.id;
          const isLocked = region.status === "locked";
          return (
            <button
              key={region.id}
              type="button"
              className={cn("map-node", isSelected && "map-node--selected", isLocked && "map-node--locked", region.status === "event" && "map-node--event")}
              style={{ left: `${region.mapPosition.x}%`, top: `${region.mapPosition.y}%`, "--node-accent": region.accent } as React.CSSProperties}
              onClick={() => onSelect(region)}
              aria-label={`${region.name}. Nível ${region.recommendedLevel}.`}
            >
              <span className="map-node__pulse" />
              <span className="map-node__icon">{isLocked ? <LockKeyhole /> : region.status === "event" ? <Sparkles /> : <MapPin />}</span>
              <span className="map-node__label">{region.name}</span>
            </button>
          );
        })}

        <button type="button" className="village-marker" style={{ left: "49%", top: "57%" }} onClick={onOpenVillage}>
          <TentTree /><span>Entrar na Vila Cartógrafa</span>
        </button>
      </div>

      {selected ? (
        <aside className="region-panel" aria-live="polite">
          <div className="region-panel__topline">
            <Badge className="border-transparent text-slate-950" style={{ backgroundColor: selected.accent }}>Nível {selected.recommendedLevel}</Badge>
            <span>{selected.areas?.length ?? 0} áreas · {selected.discovered}/{selected.totalCreatures} seres</span>
          </div>
          <h2>{selected.name}</h2>
          <p className="region-panel__subtitle">{selected.subtitle}</p>
          <p className="region-panel__inspiration">Inspiração: {selected.inspiration}</p>

          {selected.status === "locked" ? (
            <div className="region-panel__locked"><LockKeyhole /><div><strong>Caminho ainda selado</strong><span>Conquiste dois selos de santuário para atravessar.</span></div></div>
          ) : selected.status === "event" ? (
            <div className="region-panel__locked region-panel__event"><Sparkles /><div><strong>Portal de fim de semana</strong><span>Abre sábado às 09:00 no horário de Brasília.</span></div></div>
          ) : selected.id !== playerRegionId ? (
            <div className="region-panel__travel">
              <p>Viaje primeiro para liberar o mapa interno desta região.</p>
              <Button type="button" variant="game" disabled={!canTravelToSelected} onClick={() => onTravel(selected)}><Footprints /> Viajar para esta região</Button>
              {!canTravelToSelected ? <small>Chegue primeiro a uma região vizinha conectada.</small> : null}
            </div>
          ) : selected.areas?.length ? (
            <div className="region-panel__travel">
              <p>Amplie o mapa e entre nas trilhas, vilas, ruínas e santuários desta região.</p>
              <Button type="button" variant="game" onClick={() => {
                setActiveRegionId(selected.id);
                setSelectedAreaId(currentAreaId && currentAreaId.startsWith(`${selected.id}-`) ? currentAreaId : selected.areas?.[0]?.id ?? null);
              }}><MapIcon /> Entrar na região</Button>
            </div>
          ) : (
            <div className="region-panel__locked"><MapIcon /><div><strong>Expansão especial</strong><span>Esta fronteira receberá seu mapa interno em uma próxima rota.</span></div></div>
          )}
        </aside>
      ) : null}
    </section>
  );
}

function RegionExplorer({
  region,
  currentAreaId,
  visitedAreaIds,
  selectedAreaId,
  onSelectArea,
  onBack,
  onVisit,
}: {
  region: RegionDefinition;
  currentAreaId: string | null;
  visitedAreaIds: string[];
  selectedAreaId: string | null;
  onSelectArea: (areaId: string) => void;
  onBack: () => void;
  onVisit: (area: RegionAreaDefinition) => void;
}) {
  const areas = region.areas ?? [];
  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? areas[0];
  const viewport = region.viewport ?? { x: 50, y: 50, scale: 2 };
  const unlocked = (area: RegionAreaDefinition) => !area.unlockAfter || visitedAreaIds.includes(area.unlockAfter);

  return (
    <section className="region-explorer" aria-label={`Exploração de ${region.name}`} style={{ "--region-accent": region.accent } as React.CSSProperties}>
      <div className="region-explorer__map">
        <div className="region-explorer__map-art" style={{ transform: `scale(${viewport.scale})`, transformOrigin: `${viewport.x}% ${viewport.y}%` }}>
          <Image src="/art/world-map-pixel-v2.png" alt={`Mapa ampliado de ${region.name}`} fill priority sizes="100vw" className="object-cover [image-rendering:pixelated]" />
        </div>
        <div className="region-explorer__shade" />
        <header className="region-explorer__heading">
          <Button type="button" variant="secondary" size="sm" onClick={onBack}><ArrowLeft /> Atlas</Button>
          <div><span>Região explorável · 5 áreas</span><h1>{region.name}</h1><p>{region.subtitle}</p></div>
        </header>

        <svg className="region-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={areas.map((area) => `${area.position.x},${area.position.y}`).join(" ")} />
        </svg>
        {areas.map((area, index) => {
          const isUnlocked = unlocked(area);
          const isVisited = visitedAreaIds.includes(area.id);
          const isCurrent = currentAreaId === area.id;
          return (
            <button
              key={area.id}
              type="button"
              disabled={!isUnlocked}
              className={cn("area-node", selectedArea?.id === area.id && "is-selected", isVisited && "is-visited", isCurrent && "is-current", !isUnlocked && "is-locked")}
              style={{ left: `${area.position.x}%`, top: `${area.position.y}%` }}
              onClick={() => onSelectArea(area.id)}
            >
              <span>{!isUnlocked ? <LockKeyhole /> : isVisited ? <Check /> : index + 1}</span>
              <strong>{area.name}</strong>
            </button>
          );
        })}
      </div>

      <aside className="area-panel">
        <div className="area-panel__topline"><Badge>Nível {selectedArea.recommendedLevel}</Badge><span>{visitedAreaIds.includes(selectedArea.id) ? "Explorada" : "Nova área"}</span></div>
        <h2>{selectedArea.name}</h2><p>{selectedArea.subtitle}</p>
        <div className="area-panel__activity">
          {(() => { const Icon = activityMeta[selectedArea.activity].icon; return <Icon />; })()}
          <div><strong>{activityMeta[selectedArea.activity].label}</strong><span>Criaturas próprias da região e encontros comuns podem aparecer aqui.</span></div>
        </div>
        <Button type="button" variant="game" size="lg" disabled={!unlocked(selectedArea)} onClick={() => onVisit(selectedArea)}>
          <Footprints /> {currentAreaId === selectedArea.id ? "Explorar novamente" : "Viajar para esta área"}
        </Button>
      </aside>
    </section>
  );
}
