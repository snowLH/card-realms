"use client";

import Image from "next/image";
import {
  Footprints,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  Sparkles,
  TentTree,
} from "lucide-react";
import { useMemo, useState } from "react";
import { REGIONS } from "@/game/catalog";
import type { GridPoint } from "@/game/exploration/pathfinding";
import type { AvatarConfig } from "@/game/save/local-progress";
import type { BattleEncounter, RegionAreaDefinition, RegionDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalExploration } from "./local-exploration";

export function WorldMap({
  selected,
  playerRegionId,
  currentAreaId,
  visitedAreaIds,
  openedTreasures,
  avatar,
  mapPositions,
  discoveredByRegion,
  onlineParty,
  playerId,
  playerName,
  onSelect,
  onTravel,
  onVisitArea,
  onBattle,
  onTreasure,
  onPositionChange,
  onOpenVillage,
}: {
  selected: RegionDefinition | null;
  playerRegionId: string;
  currentAreaId: string | null;
  visitedAreaIds: string[];
  openedTreasures: string[];
  avatar: AvatarConfig;
  mapPositions: Record<string, GridPoint>;
  discoveredByRegion: Record<string, number>;
  onlineParty: boolean;
  playerId?: string;
  playerName: string;
  onSelect: (region: RegionDefinition | null) => void;
  onTravel: (region: RegionDefinition) => void;
  onVisitArea: (region: RegionDefinition, area: RegionAreaDefinition) => void;
  onBattle: (encounter: BattleEncounter) => void;
  onTreasure: (region: RegionDefinition) => void;
  onPositionChange: (region: RegionDefinition, point: GridPoint) => void;
  onOpenVillage: () => void;
}) {
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const currentRegion = REGIONS.find((region) => region.id === playerRegionId) ?? REGIONS[0];
  const activeRegion = useMemo(
    () => REGIONS.find((region) => region.id === activeRegionId) ?? null,
    [activeRegionId],
  );
  const canTravelToSelected = selected ? currentRegion.neighbors.includes(selected.id) : false;

  if (activeRegion?.areas?.length) {
    return (
      <LocalExploration
        region={activeRegion}
        currentAreaId={currentAreaId}
        visitedAreaIds={visitedAreaIds}
        openedTreasure={openedTreasures.includes(activeRegion.id)}
        avatar={avatar}
        savedPosition={mapPositions[activeRegion.id]}
        onlineParty={onlineParty}
        playerId={playerId}
        playerName={playerName}
        onBack={() => setActiveRegionId(null)}
        onVisitArea={(area) => onVisitArea(activeRegion, area)}
        onBattle={onBattle}
        onTreasure={() => onTreasure(activeRegion)}
        onPositionChange={(point) => onPositionChange(activeRegion, point)}
      />
    );
  }

  return (
    <section className="world-map-shell" aria-label="Mapa de Aurória">
      <div className="world-map">
        <Image
          src="/art/world-map-pixel-v2.webp"
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
            <span>{selected.areas?.length ?? 0} áreas · {discoveredByRegion[selected.id] ?? 0}/{selected.totalCreatures} seres</span>
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
