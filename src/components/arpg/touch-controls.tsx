"use client";

import { Crosshair, Footprints, Hand, Sparkles, Swords } from "lucide-react";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { ARPG_WEAPONS, getDefaultSecondaryArpgWeaponId } from "@/game/arpg/content/equipment";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
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
  weaponId,
  secondaryWeaponId,
  abilityIds,
  abilityReadyAt,
  nowMs,
  dashReadyAt,
  chestAvailable,
  exitPortalAvailable = false,
  specialRoomAvailable = false,
}: {
  bridge: ArpgBridge;
  weaponId?: string;
  secondaryWeaponId?: string;
  abilityIds: [string, string];
  abilityReadyAt: Record<string, number>;
  nowMs: number;
  dashReadyAt: number;
  chestAvailable: boolean;
  exitPortalAvailable?: boolean;
  specialRoomAvailable?: boolean;
}) {
  const cards = abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id) ?? MATA_CARDS[0]);
  const activeWeaponId = weaponId ?? DEFAULT_ARPG_LOADOUT.weaponId;
  const reserveWeaponId = secondaryWeaponId ?? getDefaultSecondaryArpgWeaponId(activeWeaponId);
  const weapon = ARPG_WEAPONS.find((item) => item.id === activeWeaponId) ?? ARPG_WEAPONS[0];
  const secondaryWeapon = ARPG_WEAPONS.find((item) => item.id === reserveWeaponId) ?? ARPG_WEAPONS[0];
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
    bridge.setMove((x * scale) / radius, (y * scale) / radius);
  };

  const stopStick = () => bridge.setMove(0, 0);

  return (
    <div className="arpg-touch" aria-label="Controles de toque">
      <div
        className="arpg-stick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event);
        }}
        onPointerUp={stopStick}
        onPointerCancel={stopStick}
      >
        <span className="arpg-stick__nub" />
      </div>

      <div className="arpg-touch__actions">
        <div className="arpg-touch__cards">
          {cards.map((card, index) => {
            const remaining = Math.max(0, (abilityReadyAt[card.id] ?? 0) - nowMs);
            const cooling = remaining > 50;
            const cooldownLabel = cooling ? `${(remaining / 1000).toFixed(1)}s` : "Pronta";
            return (
              <button
                type="button"
                key={card.id}
                className={cooling ? "is-cooling" : "is-ready"}
                aria-label={`${card.name}: ${cooldownLabel}`}
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

        <div className="arpg-touch__combat">
          <button
            type="button"
            className="arpg-touch__weapon-swap"
            aria-label={`Trocar arma: atual ${weapon.name}, próxima ${secondaryWeapon.name}`}
            onPointerDown={() => bridge.queueWeaponSwap()}
            onClick={activateFromKeyboard(() => bridge.queueWeaponSwap())}
          >
            <Swords aria-hidden="true" />
            <span>Arma: {weapon.name}</span>
            <small>Trocar por {secondaryWeapon.name}</small>
          </button>
          <button
            type="button"
            className="arpg-touch__attack"
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
