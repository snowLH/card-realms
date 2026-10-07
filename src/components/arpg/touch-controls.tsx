"use client";

import { ArrowLeftRight, Crosshair, Footprints, Hand, Sparkles } from "lucide-react";
import { useRef } from "react";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { MATA_CARDS } from "@/game/arpg/content/mata-encantada";
import { CREATURE_BY_ID } from "@/game/catalog";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { PixelCreature } from "@/components/game/pixel-creature";

function TouchCreaturePortrait({ creatureId }: { creatureId: string }) {
  const creature = CREATURE_BY_ID.get(creatureId);

  return (
    <span className="arpg-touch__creature" aria-hidden="true">
      {creature
        ? <PixelCreature sprite={creature.sprite} className="arpg-touch__creature-sprite" label="" />
        : <Sparkles className="arpg-touch__creature-fallback" aria-hidden="true" />}
    </span>
  );
}

function activateFromKeyboard(action: () => void) {
  return (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) action();
  };
}

export function TouchControls({
  bridge,
  abilityIds,
  abilityReadyAt,
  nowMs,
  dashReadyAt,
  chestAvailable,
  exitPortalAvailable = false,
  specialRoomAvailable = false,
  weaponBId = null,
  activeWeaponSlot = "A",
}: {
  bridge: ArpgBridge;
  abilityIds: [string, string];
  abilityReadyAt: Record<string, number>;
  nowMs: number;
  dashReadyAt: number;
  chestAvailable: boolean;
  exitPortalAvailable?: boolean;
  specialRoomAvailable?: boolean;
  weaponBId?: string | null;
  activeWeaponSlot?: "A" | "B";
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const cards = abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id) ?? MATA_CARDS[0]);
  const dashRemaining = Math.max(0, dashReadyAt - nowMs);
  const dashCooling = dashRemaining > 50;
  const showInteraction = chestAvailable || exitPortalAvailable || specialRoomAvailable;
  const interactionLabel = exitPortalAvailable
    ? "Entrar no portal de extração"
    : chestAvailable
      ? "Abrir baú"
      : "Interagir com sala especial";
  const interactionText = exitPortalAvailable ? "Sair" : chestAvailable ? "Abrir" : "Interagir";

  const finishAttackPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    bridge.setAttack(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const radius = Math.max(1, rect.width * 0.42);
    const length = Math.hypot(x, y);
    const scale = length > radius ? radius / length : 1;
    const offsetX = x * scale;
    const offsetY = y * scale;
    const nub = stickRef.current?.querySelector<HTMLElement>(".arpg-stick__nub");
    nub?.style.setProperty("--stick-x", `${offsetX}px`);
    nub?.style.setProperty("--stick-y", `${offsetY}px`);
    bridge.setMove(offsetX / radius, offsetY / radius);
  };

  const stopStick = () => {
    bridge.setMove(0, 0);
    const nub = stickRef.current?.querySelector<HTMLElement>(".arpg-stick__nub");
    nub?.style.setProperty("--stick-x", "0px");
    nub?.style.setProperty("--stick-y", "0px");
  };

  return (
    <div className="arpg-touch" role="group" aria-label="Controles de combate">
      <div
        ref={stickRef}
        className="arpg-stick"
        role="group"
        aria-label="Joystick virtual. Arraste para mover. No teclado, use WASD ou as setas."
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event);
        }}
        onPointerUp={stopStick}
        onPointerCancel={stopStick}
        onLostPointerCapture={stopStick}
      >
        <span className="arpg-stick__nub" aria-hidden="true" />
      </div>

      <div className="arpg-touch__actions">
        <div className="arpg-touch__cards" role="group" aria-label="Dois poderes equipados">
          {cards.map((card, index) => {
            const remaining = Math.max(0, (abilityReadyAt[card.id] ?? 0) - nowMs);
            const cooling = remaining > 50;
            const cooldownLabel = cooling ? `${(remaining / 1000).toFixed(1)}s` : "Pronta";
            return (
              <button
                type="button"
                key={card.id}
                className={cooling ? "is-cooling" : "is-ready"}
                aria-label={`Poder ${index + 1}: ${card.name}, ${cooldownLabel}`}
                aria-keyshortcuts={index === 0 ? "1" : "2"}
                title={card.name}
                onPointerDown={() => bridge.queueAbility(index as 0 | 1)}
                onClick={activateFromKeyboard(() => bridge.queueAbility(index as 0 | 1))}
              >
                <strong>{index + 1}</strong>
                <TouchCreaturePortrait creatureId={card.creatureId} />
                <span className="arpg-touch__card-name">{card.name}</span>
                <small>{cooldownLabel}</small>
              </button>
            );
          })}
        </div>

        <div className="arpg-touch__combat" role="group" aria-label="Ataque básico, dash e interação">
          {weaponBId ? (
            <button
              type="button"
              aria-label={`Trocar arma para o slot ${activeWeaponSlot === "A" ? "B" : "A"}`}
              aria-keyshortcuts="Q"
              onPointerDown={() => bridge.queueWeaponSwitch()}
              onClick={activateFromKeyboard(() => bridge.queueWeaponSwitch())}
            >
              <ArrowLeftRight aria-hidden="true" />
              <span>Arma {activeWeaponSlot} · Q</span>
            </button>
          ) : null}
          <button
            type="button"
            className="arpg-touch__attack"
            aria-label="Atacar e mirar no inimigo mais próximo"
            aria-keyshortcuts="Space"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              bridge.setAttack(true);
            }}
            onPointerUp={finishAttackPointer}
            onPointerCancel={finishAttackPointer}
            onLostPointerCapture={() => bridge.setAttack(false)}
            onBlur={() => bridge.setAttack(false)}
            onKeyDown={(event) => {
              if (event.code === "Space" || event.code === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                bridge.setAttack(true);
              }
            }}
            onKeyUp={(event) => {
              if (event.code === "Space" || event.code === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                bridge.setAttack(false);
              }
            }}
          >
            <Crosshair /> Ataque
          </button>
          <button
            type="button"
            disabled={dashCooling}
            aria-label={dashCooling ? `Dash em recarga por ${(dashRemaining / 1000).toFixed(1)} segundos` : "Usar dash. Tecla Shift"}
            aria-keyshortcuts="Shift"
            onPointerDown={() => bridge.queueDash()}
            onClick={activateFromKeyboard(() => bridge.queueDash())}
          >
            <Footprints />
            <span>{dashCooling ? `Dash ${(dashRemaining / 1000).toFixed(1)}s` : "Dash"}</span>
          </button>
          {showInteraction ? (
            <button
              type="button"
              className="arpg-touch__interact"
              aria-label={interactionLabel}
              aria-keyshortcuts="E"
              onPointerDown={() => bridge.queueInteract()}
              onClick={activateFromKeyboard(() => bridge.queueInteract())}
            >
              <Hand /> {interactionText}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
