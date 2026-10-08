"use client";

import { ArrowLeftRight, Crosshair, Footprints, Hand, Sparkles } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { MATA_CARDS } from "@/game/arpg/content/mata-encantada";
import { CREATURE_BY_ID } from "@/game/catalog";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { PixelCreature } from "@/components/game/pixel-creature";
import { useHeldAttack, useTouchAction, useVirtualJoystick } from "./touch-input";

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

function TouchActionButton({ action, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { action: () => void }) {
  const input = useTouchAction(action);
  return <button type="button" {...props} {...input} />;
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
  const stickInput = useVirtualJoystick(bridge);
  const attackInput = useHeldAttack(bridge);
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

  return (
    <div className="arpg-touch" role="group" aria-label="Controles de combate">
      <div
        {...stickInput}
        className="arpg-stick"
        role="group"
        aria-label="Joystick virtual. Arraste para mover. No teclado, use WASD ou as setas."
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
              <TouchActionButton
                type="button"
                key={card.id}
                className={cooling ? "is-cooling" : "is-ready"}
                aria-label={`Poder ${index + 1}: ${card.name}, ${cooldownLabel}`}
                aria-keyshortcuts={index === 0 ? "1" : "2"}
                title={card.name}
                action={() => bridge.queueAbility(index as 0 | 1)}
              >
                <strong>{index + 1}</strong>
                <TouchCreaturePortrait creatureId={card.creatureId} />
                <span className="arpg-touch__card-name">{card.name}</span>
                <small>{cooldownLabel}</small>
              </TouchActionButton>
            );
          })}
        </div>

        <div className="arpg-touch__combat" role="group" aria-label="Ataque básico, dash e interação">
          {weaponBId ? (
            <TouchActionButton
              type="button"
              className="arpg-touch__swap"
              aria-label={`Trocar arma para o slot ${activeWeaponSlot === "A" ? "B" : "A"}`}
              aria-keyshortcuts="Q"
              action={() => bridge.queueWeaponSwitch()}
            >
              <ArrowLeftRight aria-hidden="true" />
              <span>Arma {activeWeaponSlot} · Q</span>
            </TouchActionButton>
          ) : null}
          <button
            type="button"
            className="arpg-touch__attack"
            aria-label="Atacar e mirar no inimigo mais próximo"
            aria-keyshortcuts="Space"
            {...attackInput}
          >
            <Crosshair /> Ataque
          </button>
          <TouchActionButton
            type="button"
            className="arpg-touch__dash"
            disabled={dashCooling}
            aria-label={dashCooling ? `Dash em recarga por ${(dashRemaining / 1000).toFixed(1)} segundos` : "Usar dash. Tecla Shift"}
            aria-keyshortcuts="Shift"
            action={() => bridge.queueDash()}
          >
            <Footprints />
            <span>{dashCooling ? `Dash ${(dashRemaining / 1000).toFixed(1)}s` : "Dash"}</span>
          </TouchActionButton>
          {showInteraction ? (
            <TouchActionButton
              type="button"
              className="arpg-touch__interact"
              aria-label={interactionLabel}
              aria-keyshortcuts="E"
              action={() => bridge.queueInteract()}
            >
              <Hand /> {interactionText}
            </TouchActionButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
