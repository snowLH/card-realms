"use client";

import type { CSSProperties } from "react";
import { ELEMENT_META } from "@/game/catalog";
import { getAttackById } from "@/game/engine";
import type { EnergyCard, PowerCard } from "@/game/types";
import { cn } from "@/lib/utils";

export function BattleCardHand({
  energyCards,
  powerCards,
  selectedEnergyCardId,
  selectedPowerCardId,
  onSelectEnergy,
  onSelectPower,
}: {
  energyCards: EnergyCard[];
  powerCards: PowerCard[];
  selectedEnergyCardId: string | null;
  selectedPowerCardId: string | null;
  onSelectEnergy: (cardId: string) => void;
  onSelectPower: (cardId: string) => void;
}) {
  const total = energyCards.length + powerCards.length;

  return (
    <div className="classic-hand-zone">
      <span className="view-eyebrow">SUA MÃO</span>
      <div className="classic-hand-fan">
        {energyCards.map((card, index) => {
          const meta = ELEMENT_META[card.element];
          return (
            <button
              type="button"
              key={card.id}
              className={cn(
                "classic-hand-card",
                "is-energy",
                selectedEnergyCardId === card.id && "is-selected",
              )}
              style={{
                "--fan-index": index,
                "--fan-total": total,
                "--card-accent": meta.color,
              } as CSSProperties}
              onClick={() => onSelectEnergy(card.id)}
            >
              <span className="classic-hand-card__sigil">{meta.short}</span>
              <strong>Energia de {meta.name}</strong>
              <small>Carta de Energia</small>
            </button>
          );
        })}
        {powerCards.map((card, index) => {
          const attack = getAttackById(card.attackId);
          if (!attack) return null;
          return (
            <button
              type="button"
              key={card.id}
              className={cn(
                "classic-hand-card",
                "is-power",
                selectedPowerCardId === card.id && "is-selected",
              )}
              style={{
                "--fan-index": energyCards.length + index,
                "--fan-total": total,
                "--card-accent": ELEMENT_META[card.element].color,
              } as CSSProperties}
              onClick={() => onSelectPower(card.id)}
            >
              <span className="classic-hand-card__sigil">{ELEMENT_META[card.element].short}</span>
              <strong>{attack.name}</strong>
              <small>{attack.damage} DMG · D6 {attack.minRoll}+</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
