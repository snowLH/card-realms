"use client";

import { Coins, Gem, Heart, Shield, Swords } from "lucide-react";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { ARPG_ARMORS, ARPG_WEAPONS } from "@/game/arpg/content/equipment";
import { MATA_CARDS } from "@/game/arpg/content/mata-encantada";
import { ARPG_RELIC_BY_ID, STARTER_ARPG_RELIC_ID } from "@/game/arpg/content/relics";
import type { ArpgDungeonMapState, ArpgHudState, ArpgMiniMapRoomType } from "@/game/arpg/domain/types";

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

export function DungeonMapOverlay({ map, onClose }: { map: ArpgDungeonMapState; onClose: () => void }) {
  return (
    <section className="arpg-map-overlay" role="dialog" aria-modal="true" aria-labelledby="arpg-map-title">
      <div className="arpg-map-overlay__panel">
        <header>
          <div>
            <small>ROTA DA EXPEDIÇÃO</small>
            <h1 id="arpg-map-title">Mapa</h1>
          </div>
          <button type="button" aria-label="Fechar mapa" autoFocus onClick={onClose}>×</button>
        </header>
        <DungeonMiniMap map={map} expanded />
        <p className="arpg-map-overlay__legend">
          <span>■ Sala atual</span>
          <span>□ Tipo revelado</span>
          <span>? Próxima sala sem revelar</span>
        </p>
        <button className="arpg-map-overlay__close" type="button" onClick={onClose}>Continuar expedição</button>
      </div>
    </section>
  );
}

export function RunHud({ state }: { state: ArpgHudState | null }) {
  if (!state) return null;
  const weapon = ARPG_WEAPONS.find((item) => item.id === state.weaponId) ?? ARPG_WEAPONS[0];
  const secondaryWeapon = ARPG_WEAPONS.find((item) => item.id === state.secondaryWeaponId) ?? ARPG_WEAPONS[0];
  const armor = ARPG_ARMORS.find((item) => item.id === state.armorId) ?? ARPG_ARMORS[0];
  const relic = ARPG_RELIC_BY_ID.get(state.relicId) ?? ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID)!;
  const cards = state.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id) ?? MATA_CARDS[0]);
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));

  return (
    <div className="arpg-hud" aria-live="polite">
      <div className="arpg-hud__status">
        <span className="arpg-hud__status-item arpg-hud__status-health"><Heart aria-hidden="true" /> {Math.ceil(state.hp)}/{state.maxHp}</span>
        <div className="arpg-hud__hp arpg-hud__status-item" role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={state.maxHp} aria-valuenow={Math.ceil(state.hp)}><i style={{ width: `${hpPercent}%` }} /></div>
        <span className="arpg-hud__status-item arpg-hud__status-room">Sala {state.room}/{state.roomCount} · {state.enemiesRemaining} inimigos</span>
        <span className="arpg-hud__status-item arpg-hud__status-shards"><Coins aria-hidden="true" /> {state.runShards} fragmentos</span>
      </div>

      <div className="arpg-hud__loadout">
        <span className="arpg-hud__equipment" role="img" aria-label={`Arma atual: ${weapon.name}; reserva: ${secondaryWeapon.name}; pressione Q para alternar`} title={`Atual: ${weapon.name} · Reserva: ${secondaryWeapon.name} · Q alterna`}>
          <Swords aria-hidden="true" /><span className="arpg-hud__equipment-name">{weapon.name}</span>
          <small className="arpg-hud__equipment-hint">Reserva: {secondaryWeapon.name} · Q</small>
        </span>
        <span className="arpg-hud__equipment" role="img" aria-label={`Armadura equipada: ${armor.name}`} title={`Armadura: ${armor.name}`}>
          <Shield aria-hidden="true" /><span className="arpg-hud__equipment-name">{armor.name}</span>
        </span>
        <span className="arpg-hud__equipment" role="img" aria-label={`Relíquia equipada: ${relic.name}`} title={`Relíquia: ${relic.name}`}>
          <Gem aria-hidden="true" /><span className="arpg-hud__equipment-name">{relic.name}</span>
        </span>
        {state.chestAvailable ? <span className="arpg-hud__interaction">Baú disponível · E</span> : null}
        {state.exitPortalAvailable ? <span className="arpg-hud__interaction">Portal de extração · E</span> : null}
      </div>

      {state.dungeonMap ? <DungeonMiniMap map={state.dungeonMap} /> : null}

      <div className="arpg-hud__cards">
        {cards.map((card, index) => {
          const remaining = Math.max(0, (state.abilityReadyAt[card.id] ?? 0) - state.nowMs);
          return (
            <span key={card.id} className={remaining > 0 ? "is-cooling" : "is-ready"}>
              <b>{index + 1}</b> {card.name}
              <small>{remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : "PRONTA"}</small>
            </span>
          );
        })}
      </div>
    </div>
  );
}
