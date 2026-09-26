"use client";

import Image from "next/image";
import {
  Castle,
  PackageOpen,
  Compass,
  LockKeyhole,
  MapPin,
  Shield,
  Sparkles,
  Swords,
  TentTree,
} from "lucide-react";
import { REGIONS } from "@/game/catalog";
import type { RegionDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const activityMeta = {
  explore: { label: "Explorar trilha", icon: Compass, battle: true },
  wild: { label: "Procurar ser", icon: Sparkles, battle: true },
  npc: { label: "Enfrentar viajante", icon: Swords, battle: true },
  treasure: { label: "Procurar baú", icon: PackageOpen, battle: false },
  sanctuary: { label: "Entrar no santuário", icon: Shield, battle: true },
  boss: { label: "Desafiar guardião", icon: Castle, battle: true },
} as const;

export function WorldMap({
  selected,
  onSelect,
  onBattle,
  onTreasure,
}: {
  selected: RegionDefinition | null;
  onSelect: (region: RegionDefinition | null) => void;
  onBattle: (region: RegionDefinition, activity: keyof typeof activityMeta) => void;
  onTreasure: (region: RegionDefinition) => void;
}) {
  return (
    <section className="world-map-shell" aria-label="Mapa de Aurória">
      <div className="world-map">
        <Image
          src="/art/world-map-pixel.png"
          alt="Mapa em pixel art do mundo de Aurória, com florestas, ilhas, montanhas, ruínas e cavernas"
          fill
          priority
          sizes="(max-width: 768px) 100vw, calc(100vw - 320px)"
          className="object-cover [image-rendering:pixelated]"
        />
        <div className="world-map__shade" />

        <div className="world-map__title">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200">
            Atlas vivo
          </span>
          <h1>Terras de Aurória</h1>
          <p>Toque em uma região para escolher sua próxima jornada.</p>
        </div>

        {REGIONS.map((region) => {
          const isSelected = selected?.id === region.id;
          const isLocked = region.status === "locked";
          return (
            <button
              key={region.id}
              type="button"
              className={cn(
                "map-node",
                isSelected && "map-node--selected",
                isLocked && "map-node--locked",
                region.status === "event" && "map-node--event",
              )}
              style={{ left: `${region.mapPosition.x}%`, top: `${region.mapPosition.y}%`, "--node-accent": region.accent } as React.CSSProperties}
              onClick={() => onSelect(region)}
              aria-label={`${region.name}. Nível ${region.recommendedLevel}.`}
            >
              <span className="map-node__pulse" />
              <span className="map-node__icon">
                {isLocked ? <LockKeyhole /> : region.status === "event" ? <Sparkles /> : <MapPin />}
              </span>
              <span className="map-node__label">{region.name}</span>
            </button>
          );
        })}

        <button
          type="button"
          className="village-marker"
          style={{ left: "48%", top: "62%" }}
          onClick={() => onSelect(null)}
        >
          <TentTree />
          <span>Vila Cartógrafa</span>
        </button>
      </div>

      {selected ? (
        <aside className="region-panel" aria-live="polite">
          <div className="region-panel__topline">
            <Badge
              className="border-transparent text-slate-950"
              style={{ backgroundColor: selected.accent }}
            >
              Nível {selected.recommendedLevel}
            </Badge>
            <span>{selected.discovered}/{selected.totalCreatures} seres</span>
          </div>
          <h2>{selected.name}</h2>
          <p className="region-panel__subtitle">{selected.subtitle}</p>
          <p className="region-panel__inspiration">Inspiração: {selected.inspiration}</p>

          {selected.status === "locked" ? (
            <div className="region-panel__locked">
              <LockKeyhole />
              <div>
                <strong>Caminho ainda selado</strong>
                <span>Conquiste dois selos de santuário para atravessar.</span>
              </div>
            </div>
          ) : selected.status === "event" ? (
            <div className="region-panel__locked region-panel__event">
              <Sparkles />
              <div>
                <strong>Portal de fim de semana</strong>
                <span>Abre sábado às 09:00 no horário de Brasília.</span>
              </div>
            </div>
          ) : (
            <div className="region-activities">
              {selected.activities.map((activity) => {
                const meta = activityMeta[activity];
                const Icon = meta.icon;
                return (
                  <Button
                    key={activity}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      meta.battle ? onBattle(selected, activity) : onTreasure(selected)
                    }
                  >
                    <Icon /> {meta.label}
                  </Button>
                );
              })}
            </div>
          )}
        </aside>
      ) : null}
    </section>
  );
}
