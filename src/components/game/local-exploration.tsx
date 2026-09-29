"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Check,
  Compass,
  Footprints,
  LockKeyhole,
  MessageCircle,
  MousePointer2,
  PackageOpen,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURES } from "@/game/catalog";
import {
  createLocalScene,
  isLocalTileWalkable,
  LOCAL_MAPS,
  type LocalMapDefinition,
} from "@/game/exploration/maps";
import {
  findGridPath,
  nearestInteractionPoint,
  type GridPoint,
} from "@/game/exploration/pathfinding";
import type { AvatarConfig } from "@/game/save/local-progress";
import type { Activity, RegionAreaDefinition, RegionDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterAvatar2D } from "./character-avatar";
import { PixelCreature } from "./pixel-creature";

type PendingAction =
  | { type: "area"; id: string }
  | { type: "npc"; id: string }
  | { type: "creature"; id: string }
  | { type: "chest" };

type Interaction =
  | { type: "npc"; id: string }
  | { type: "creature"; id: string };

const activityLabels: Record<Activity, string> = {
  explore: "Ponto de exploração",
  wild: "Habitat selvagem",
  npc: "Encontro de viajantes",
  treasure: "Sala de tesouro",
  sanctuary: "Santuário regional",
  boss: "Domínio do guardião",
};

function actorStyle(point: GridPoint, map: LocalMapDefinition): CSSProperties {
  return {
    left: `${((point.x + 0.5) / map.columns) * 100}%`,
    top: `${((point.y + 0.5) / map.rows) * 100}%`,
  };
}

function validSavedPosition(map: LocalMapDefinition, point: GridPoint | undefined) {
  return point && isLocalTileWalkable(map, point) ? point : map.entry;
}

export function LocalExploration({
  region,
  currentAreaId,
  visitedAreaIds,
  openedTreasure,
  avatar,
  savedPosition,
  onBack,
  onVisitArea,
  onBattle,
  onTreasure,
  onPositionChange,
}: {
  region: RegionDefinition;
  currentAreaId: string | null;
  visitedAreaIds: string[];
  openedTreasure: boolean;
  avatar: AvatarConfig;
  savedPosition?: GridPoint;
  onBack: () => void;
  onVisitArea: (area: RegionAreaDefinition) => void;
  onBattle: (activity: Activity) => void;
  onTreasure: () => void;
  onPositionChange: (point: GridPoint) => void;
}) {
  const map = LOCAL_MAPS[region.id];
  const viewportRef = useRef<HTMLDivElement>(null);
  const movementStarted = useRef(false);
  const savedPositionRef = useRef(savedPosition);
  const [viewport, setViewport] = useState({ width: 920, height: 640 });
  const [player, setPlayer] = useState<GridPoint>(() => validSavedPosition(map, savedPosition));
  const [path, setPath] = useState<GridPoint[]>([]);
  const [destination, setDestination] = useState<GridPoint | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [facing, setFacing] = useState<"left" | "right">("right");
  const areas = useMemo(() => region.areas ?? [], [region.areas]);
  const scene = useMemo(() => createLocalScene(
    map,
    CREATURES.filter((creature) => creature.regionId === region.id).map((creature) => creature.id),
  ), [map, region.id]);

  useEffect(() => {
    savedPositionRef.current = savedPosition;
  }, [savedPosition]);

  useEffect(() => {
    setPlayer(validSavedPosition(map, savedPositionRef.current));
    setPath([]);
    setDestination(null);
    setInteraction(null);
    setPendingAction(null);
  }, [map, region.id]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!path.length) return;
    const timer = window.setTimeout(() => {
      setPath((current) => {
        const next = current[0];
        if (!next) return [];
        setPlayer((previous) => {
          if (next.x < previous.x) setFacing("left");
          if (next.x > previous.x) setFacing("right");
          return next;
        });
        return current.slice(1);
      });
    }, 92);
    return () => window.clearTimeout(timer);
  }, [path]);

  const isWalkable = useCallback(
    (point: GridPoint) => isLocalTileWalkable(map, point),
    [map],
  );

  const walkTo = useCallback((point: GridPoint, action: PendingAction | null = null) => {
    const nextPath = findGridPath(
      player,
      point,
      { columns: map.columns, rows: map.rows },
      isWalkable,
    );
    if (!nextPath.length) return;
    movementStarted.current = true;
    setInteraction(null);
    setPendingAction(action);
    setDestination(nextPath.at(-1) ?? null);
    setPath(nextPath.slice(1));
  }, [isWalkable, map.columns, map.rows, player]);

  useEffect(() => {
    if (path.length || !movementStarted.current) return;
    movementStarted.current = false;
    const timer = window.setTimeout(() => {
      setDestination(null);
      onPositionChange(player);
      if (!pendingAction) return;

      if (pendingAction.type === "area") {
        const area = areas.find((candidate) => candidate.id === pendingAction.id);
        if (area) onVisitArea(area);
      } else if (pendingAction.type === "chest") {
        if (!openedTreasure) onTreasure();
      } else {
        setInteraction(pendingAction);
      }
      setPendingAction(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [areas, onPositionChange, onTreasure, onVisitArea, openedTreasure, path.length, pendingAction, player]);

  const tileWidth = map.width / map.columns;
  const tileHeight = map.height / map.rows;
  const playerPixels = {
    x: (player.x + 0.5) * tileWidth,
    y: (player.y + 0.5) * tileHeight,
  };
  const camera = {
    x: Math.max(0, Math.min(map.width - viewport.width, playerPixels.x - viewport.width / 2)),
    y: Math.max(0, Math.min(map.height - viewport.height, playerPixels.y - viewport.height / 2)),
  };

  function mapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    walkTo({
      x: Math.floor((event.clientX - rect.left + camera.x) / tileWidth),
      y: Math.floor((event.clientY - rect.top + camera.y) / tileHeight),
    });
  }

  function approach(point: GridPoint, action: PendingAction) {
    const target = nearestInteractionPoint(
      point,
      player,
      { columns: map.columns, rows: map.rows },
      isWalkable,
    );
    if (target) walkTo(target, action);
  }

  const activeArea = areas.find((area) => area.id === currentAreaId) ?? areas[0];
  const npc = interaction?.type === "npc"
    ? scene.npcs.find((candidate) => candidate.id === interaction.id)
    : null;
  const encounter = interaction?.type === "creature"
    ? scene.creatures.find((candidate) => candidate.id === interaction.id)
    : null;
  const encounterCreature = encounter
    ? CREATURES.find((candidate) => candidate.id === encounter.creatureId)
    : null;

  return (
    <section className="local-explorer" aria-label={`Mapa local de ${region.name}`} style={{ "--region-accent": region.accent } as CSSProperties}>
      <header className="local-explorer__hud">
        <Button type="button" variant="secondary" size="sm" onClick={onBack}><ArrowLeft /> Atlas</Button>
        <div>
          <span>Região aberta · exploração 2D</span>
          <h1>{region.name}</h1>
          <p>{activeArea?.name ?? "Entrada regional"}</p>
        </div>
        <Badge><Footprints /> {path.length ? "Caminhando" : "Livre para explorar"}</Badge>
      </header>

      <div ref={viewportRef} className="local-explorer__viewport" onPointerDown={mapPointerDown}>
        <div
          className="local-explorer__world"
          style={{
            width: map.width,
            height: map.height,
            transform: `translate3d(${-camera.x}px, ${-camera.y}px, 0)`,
          }}
        >
          <Image
            src={map.art}
            alt={`Ambiente top-down em pixel art de ${region.name}`}
            fill
            priority
            sizes="1600px"
            className="local-explorer__art"
          />
          <div className="local-explorer__vignette" />

          {path.filter((_, index) => index % 3 === 0).map((point, index) => (
            <span key={`${point.x}-${point.y}-${index}`} className="walk-path-dot" style={actorStyle(point, map)} />
          ))}
          {destination ? <span className="walk-destination" style={actorStyle(destination, map)}><MousePointer2 /></span> : null}

          {areas.map((area, index) => {
            const point = map.areaPoints[area.id];
            if (!point) return null;
            const unlocked = !area.unlockAfter || visitedAreaIds.includes(area.unlockAfter);
            const visited = visitedAreaIds.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                disabled={!unlocked}
                className={cn("local-area-marker", visited && "is-visited", currentAreaId === area.id && "is-current")}
                style={actorStyle(point, map)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => walkTo(point, { type: "area", id: area.id })}
                aria-label={`${area.name}. ${activityLabels[area.activity]}.`}
              >
                <span>{!unlocked ? <LockKeyhole /> : visited ? <Check /> : index + 1}</span>
                <strong>{area.name}</strong>
                <small>{activityLabels[area.activity]}</small>
              </button>
            );
          })}

          {scene.npcs.map((actor) => {
            const point = actor.point;
            return (
              <button
                key={actor.id}
                type="button"
                className="local-npc"
                style={actorStyle(point, map)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => approach(point, { type: "npc", id: actor.id })}
                aria-label={`Conversar com ${actor.name}, ${actor.role}`}
              >
                <span className="local-npc__sprite"><MessageCircle /></span>
                <strong>{actor.name}</strong>
              </button>
            );
          })}

          {scene.creatures.map((actor) => {
            const point = actor.point;
            const creature = CREATURES.find((candidate) => candidate.id === actor.creatureId);
            if (!creature) return null;
            return (
              <button
                key={actor.id}
                type="button"
                className="local-creature"
                style={actorStyle(point, map)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => approach(point, { type: "creature", id: actor.id })}
                aria-label={`Aproximar-se de ${creature.name}`}
              >
                <PixelCreature sprite={creature.sprite} label="" />
                <strong>{creature.name}</strong>
              </button>
            );
          })}

          <button
            type="button"
            className={cn("local-chest", openedTreasure && "is-open")}
            style={actorStyle(map.chest, map)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => approach(map.chest, { type: "chest" })}
            aria-label={openedTreasure ? "Baú regional já aberto" : "Caminhar até o baú regional"}
          >
            <span><PackageOpen /></span>
            <strong>{openedTreasure ? "Baú aberto" : "Baú regional"}</strong>
          </button>

          <div
            className={cn("local-player", path.length && "is-walking", facing === "left" && "is-facing-left")}
            style={actorStyle(player, map)}
          >
            <CharacterAvatar2D config={avatar} compact />
            <span>Você</span>
          </div>
        </div>
      </div>

      <div className="local-explorer__hint"><Compass /> Clique ou toque no terreno para caminhar. Os caminhos respeitam paredes, água e obstáculos.</div>

      {interaction ? (
        <aside className="local-interaction" aria-live="polite">
          <button type="button" className="local-interaction__close" onClick={() => setInteraction(null)} aria-label="Fechar interação"><X /></button>
          {npc ? (
            <>
              <span className="local-interaction__eyebrow"><MessageCircle /> Viajante encontrado</span>
              <h2>{npc.name}</h2>
              <p>{npc.role}. “As trilhas mudam, mas as histórias guardam o caminho.”</p>
              <Button type="button" variant="game" onClick={() => { setInteraction(null); onBattle("npc"); }}><Swords /> Duelo de treino</Button>
            </>
          ) : encounterCreature ? (
            <>
              <span className="local-interaction__eyebrow"><Sparkles /> Encontro selvagem</span>
              <div className="local-interaction__creature"><PixelCreature sprite={encounterCreature.sprite} label={encounterCreature.name} /></div>
              <h2>{encounterCreature.name}</h2>
              <p>{encounterCreature.description}</p>
              <Button type="button" variant="game" onClick={() => { setInteraction(null); onBattle("wild"); }}><Swords /> Iniciar batalha de cartas</Button>
              <small>Vencer rende moedas e experiência. Novas cartas continuam exclusivas de baús e recompensas especiais.</small>
            </>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
