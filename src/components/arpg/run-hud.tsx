"use client";

import { Coins, Gem, Heart, Sparkles, Swords, Wind } from "lucide-react";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { ARPG_WEAPONS, ARPG_WEAPON_BY_ID } from "@/game/arpg/content/equipment";
import { MATA_CARDS } from "@/game/arpg/content/mata-encantada";
import { ARPG_RELIC_BY_ID, STARTER_ARPG_RELIC_ID } from "@/game/arpg/content/relics";
import { PixelCreature } from "@/components/game/pixel-creature";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CREATURE_BY_ID } from "@/game/catalog";
import type { ArpgDungeonMapState, ArpgHudState, ArpgMiniMapRoomState, ArpgMiniMapRoomType } from "@/game/arpg/domain/types";

function roomMarker(type: ArpgMiniMapRoomType) {
  if (type === "start") return "S";
  if (type === "boss") return "B";
  if (type === "treasure") return "T";
  if (type === "elite") return "!";
  if (type === "rest") return "+";
  if (type === "shop") return "$";
  if (type === "event") return "?";
  return "";
}

function roomTypeLabel(type: ArpgMiniMapRoomType) {
  if (type === "start") return "Entrada";
  if (type === "boss") return "Chefe";
  if (type === "treasure") return "Tesouro";
  if (type === "elite") return "Elite";
  if (type === "rest") return "Descanso";
  if (type === "shop") return "Mercador";
  if (type === "event") return "Evento";
  if (type === "combat") return "Combate";
  return "Sala desconhecida";
}

function roomStateLabel(state: ArpgMiniMapRoomState) {
  if (state === "active") return "ativa";
  if (state === "combat") return "em combate";
  if (state === "cleared") return "concluída";
  return "revelada";
}

function DungeonMiniMap({ map, expanded = false }: { map: ArpgDungeonMapState; expanded?: boolean }) {
  if (map.rooms.length === 0) return null;
  const minX = Math.min(...map.rooms.map((room) => room.gridX));
  const maxX = Math.max(...map.rooms.map((room) => room.gridX));
  const minY = Math.min(...map.rooms.map((room) => room.gridY));
  const maxY = Math.max(...map.rooms.map((room) => room.gridY));
  const cell = 26;
  const padding = 10;
  const width = (maxX - minX + 1) * cell + padding * 2;
  const height = (maxY - minY + 1) * cell + padding * 2;
  const roomById = new Map(map.rooms.map((room) => [room.id, room]));
  const point = (gridX: number, gridY: number) => ({
    x: padding + (gridX - minX) * cell + cell / 2,
    y: padding + (gridY - minY) * cell + cell / 2,
  });

  return (
    <div className={`arpg-hud__minimap${expanded ? " is-expanded" : ""}`} aria-label="Minimapa da dungeon">
      <span>MAPA</span>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${map.rooms.length} salas descobertas`}>
        {map.rooms.flatMap((room) => room.connections.map((targetId) => {
          if (room.id.localeCompare(targetId) >= 0) return null;
          const target = roomById.get(targetId);
          if (!target) return null;
          const from = point(room.gridX, room.gridY);
          const to = point(target.gridX, target.gridY);
          return <line key={`${room.id}:${targetId}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        }))}
        {map.rooms.map((room) => {
          const center = point(room.gridX, room.gridY);
          const marker = roomMarker(room.type);
          return (
            <g
              key={room.id}
              className={`arpg-minimap-room is-type-${room.type} is-${room.state}${room.id === map.currentRoomId ? " is-current" : ""}`}
            >
              <title>{`${roomTypeLabel(room.type)} · ${room.state}`}</title>
              <rect x={center.x - 7} y={center.y - 7} width="14" height="14" rx="2" />
              {marker ? <text x={center.x} y={center.y + 3}>{marker}</text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DungeonMapOverlay({
  map,
  open = true,
  onClose,
  restoreFocus,
}: {
  map: ArpgDungeonMapState;
  open?: boolean;
  onClose: () => void;
  restoreFocus?: () => void;
}) {
  const currentRoom = map.rooms.find((room) => room.id === map.currentRoomId);
  const revealedTypes = [...new Set(map.rooms
    .filter((room) => room.type !== "unknown")
    .map((room) => roomTypeLabel(room.type)))];
  const mapSummary = [
    currentRoom
      ? `Sala atual: ${roomTypeLabel(currentRoom.type)}, ${roomStateLabel(currentRoom.state)}.`
      : "Sala atual não identificada.",
    revealedTypes.length
      ? `Tipos de sala revelados: ${revealedTypes.join(", ")}.`
      : "Nenhum tipo de sala foi revelado ainda.",
  ].join(" ");

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="arpg-map-overlay__panel"
        aria-modal="true"
        showClose={false}
        onCloseAutoFocus={(event) => {
          if (restoreFocus) {
            event.preventDefault();
            restoreFocus();
          }
        }}
      >
        <header>
          <div>
            <small>ROTA DA EXPEDIÇÃO</small>
            <DialogTitle asChild><h1>Mapa</h1></DialogTitle>
            <DialogDescription className="sr-only">{mapSummary}</DialogDescription>
          </div>
          <button type="button" aria-label="Fechar mapa" onClick={onClose}>×</button>
        </header>
        <DungeonMiniMap map={map} expanded />
        <p className="arpg-map-overlay__legend">
          <span>■ Sala atual</span>
          <span>□ Tipo revelado</span>
          <span>? Próxima sala sem revelar</span>
        </p>
        <button className="arpg-map-overlay__close" type="button" onClick={onClose}>Continuar expedição</button>
      </DialogContent>
    </Dialog>
  );
}

export function RunHud({ state }: { state: ArpgHudState | null }) {
  if (!state) return null;
  const weaponSlots = state.weaponSlots ?? { A: state.weaponId, B: null, active: "A" as const };
  const weaponA = ARPG_WEAPON_BY_ID.get(weaponSlots.A) ?? ARPG_WEAPONS[0];
  const weaponB = weaponSlots.B ? ARPG_WEAPON_BY_ID.get(weaponSlots.B) : null;
  const relic = ARPG_RELIC_BY_ID.get(state.relicId) ?? ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID)!;
  const cards = state.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id) ?? MATA_CARDS[0]);
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));

  return (
    <div className="arpg-hud" role="group" aria-label="Estado da expedição">
      <div className="arpg-hud__status">
        <span className="arpg-hud__status-item arpg-hud__status-health">
          <Heart aria-hidden="true" /><b>{Math.ceil(state.hp)}/{state.maxHp}</b>
        </span>
        <div className="arpg-hud__hp arpg-hud__status-item" role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={state.maxHp} aria-valuenow={Math.ceil(state.hp)}><i style={{ width: `${hpPercent}%` }} /></div>
        <span className="arpg-hud__status-item arpg-hud__status-room">
          <b>{state.room}/{state.roomCount}</b><small>SALA</small><i aria-hidden="true" />
          <span className="arpg-hud__enemy-count">{state.enemiesRemaining} inimigos</span>
        </span>
        <span className="arpg-hud__status-item arpg-hud__status-shards">
          <Coins aria-hidden="true" /><b>{state.runShards}</b><small>FRAG.</small>
        </span>
      </div>

      <div className="arpg-hud__loadout" role="group" aria-label="Armas e relíquia equipadas nesta expedição">
        <span
          className={`arpg-hud__equipment${weaponSlots.active === "A" ? " is-active" : ""}`}
          role="img"
          aria-label={`Slot A${weaponSlots.active === "A" ? ", arma ativa" : ""}: ${weaponA.name}`}
          title={`Slot A: ${weaponA.name}`}
        >
          <b>A</b><Swords aria-hidden="true" /><span className="arpg-hud__equipment-name">{weaponA.name}</span>
        </span>
        {weaponB ? (
          <span
            className={`arpg-hud__equipment${weaponSlots.active === "B" ? " is-active" : ""}`}
            role="img"
            aria-label={`Slot B${weaponSlots.active === "B" ? ", arma ativa" : ""}: ${weaponB.name}`}
            title={`Slot B: ${weaponB.name}`}
          >
            <b>B</b><Swords aria-hidden="true" /><span className="arpg-hud__equipment-name">{weaponB.name}</span>
          </span>
        ) : <span className="arpg-hud__interaction">B vazio</span>}
        {weaponB ? <span className="arpg-hud__interaction">Q trocar</span> : null}
        <span className="arpg-hud__equipment" role="img" aria-label={`Relíquia equipada: ${relic.name}`} title={`Relíquia: ${relic.name}`}>
          <Gem aria-hidden="true" /><span className="arpg-hud__equipment-name">{relic.name}</span>
        </span>
        {state.chestAvailable ? <span className="arpg-hud__interaction">Baú disponível · E</span> : null}
        {state.exitPortalAvailable ? <span className="arpg-hud__interaction">Portal de extração · E</span> : null}
      </div>

      {state.runMoveSpeedBonus > 0 || state.runBasicDamageMultiplier > 1 ? (
        <div className="arpg-hud__run-buffs" role="group" aria-label="Bônus temporários desta run">
          <span className="arpg-hud__run-buffs-label">BÔNUS DA RUN</span>
          {state.runMoveSpeedBonus > 0 ? (
            <span
              className="arpg-hud__run-buff"
              aria-label={`Velocidade de movimento aumentada em ${state.runMoveSpeedBonus} pontos até o fim desta run`}
              title={`Velocidade de movimento +${state.runMoveSpeedBonus} até o fim da run`}
            >
              <Wind aria-hidden="true" /> +{state.runMoveSpeedBonus} velocidade
            </span>
          ) : null}
          {state.runBasicDamageMultiplier > 1 ? (
            <span
              className="arpg-hud__run-buff"
              aria-label={`Dano básico aumentado em ${Math.round((state.runBasicDamageMultiplier - 1) * 100)}% até o fim desta run`}
              title={`Dano básico +${Math.round((state.runBasicDamageMultiplier - 1) * 100)}% até o fim da run`}
            >
              <Swords aria-hidden="true" /> +{Math.round((state.runBasicDamageMultiplier - 1) * 100)}% dano básico
            </span>
          ) : null}
        </div>
      ) : null}

      {state.dungeonMap ? <DungeonMiniMap map={state.dungeonMap} /> : null}

      <div className="arpg-hud__cards">
        {cards.map((card, index) => {
          const remaining = Math.max(0, (state.abilityReadyAt[card.id] ?? 0) - state.nowMs);
          const creature = CREATURE_BY_ID.get(card.creatureId);
          return (
            <span
              key={card.id}
              className={remaining > 0 ? "is-cooling" : "is-ready"}
              aria-label={`Poder ${index + 1}: ${card.name}, ${remaining > 0 ? `recarga de ${(remaining / 1000).toFixed(1)} segundos` : "pronto"}`}
            >
              <b>{index + 1}</b>
              <span className="arpg-hud__card-portrait" aria-hidden="true">
                {creature
                  ? <PixelCreature sprite={creature.sprite} className="arpg-hud__card-sprite" label="" />
                  : <Sparkles className="arpg-hud__card-fallback" aria-hidden="true" />}
              </span>
              <span className="arpg-hud__card-name">{card.name}</span>
              <small>{remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : "PRONTA"}</small>
            </span>
          );
        })}
      </div>
    </div>
  );
}
