"use client";

import { useState } from "react";
import { PixelCreature } from "@/components/game/pixel-creature";
import { Gem, Heart, Shield, Sparkles, Swords } from "@/components/ui/pixel-icon";
import {
  CARD_CATEGORY_LABELS,
  CARD_RARITY_LABELS,
  ELEMENT_LABELS,
} from "@/game/card-realms/domain/cards";
import { getCulture } from "@/game/card-realms/domain/cultures";
import { getTerritoryBiome } from "@/game/card-realms/domain/territories";
import type { CardCategory, CardDefinition } from "@/game/card-realms/domain/types";
import { cn } from "@/lib/utils";

const CATEGORY_EMOJI: Readonly<Record<CardCategory, string>> = {
  territory: "🗺️",
  creature: "👹",
  structure: "🏛️",
  event: "✨",
};

export function CardRealmsCardButton({
  card,
  instanceId,
  selected = false,
  affordable = true,
  disabled = false,
  onClick,
  onDragStartCard,
  onDragEndCard,
}: {
  card: CardDefinition;
  instanceId?: string;
  selected?: boolean;
  affordable?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDragStartCard?: (card: CardDefinition, instanceId: string) => void;
  onDragEndCard?: () => void;
}) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -y * 14, ry: x * 14 });
  };

  const handlePointerLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  const categoryLabel = CARD_CATEGORY_LABELS[card.category];
  const categoryEmoji = CATEGORY_EMOJI[card.category];
  const rarityInfo = CARD_RARITY_LABELS[card.rarity];
  const cultureBadge =
    card.culture === "neutral"
      ? "🌍 Ancestral"
      : card.culture === "brasil"
        ? `🇧🇷 ${getCulture("brasil").countryLabel}`
        : `🇯🇵 ${getCulture("japao").countryLabel}`;

  const transformStyle = selected
    ? "translateY(-10px) scale(1.04)"
    : tilt.rx !== 0 || tilt.ry !== 0
      ? `perspective(600px) rotateX(${tilt.rx.toFixed(1)}deg) rotateY(${tilt.ry.toFixed(1)}deg) translateY(-6px)`
      : undefined;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      draggable={affordable && !disabled && Boolean(instanceId)}
      onDragStart={(event) => {
        if (instanceId && onDragStartCard) {
          event.dataTransfer.setData("text/plain", instanceId);
          event.dataTransfer.effectAllowed = "move";
          onDragStartCard(card, instanceId);
        }
      }}
      onDragEnd={() => {
        onDragEndCard?.();
      }}
      aria-pressed={selected}
      className={cn(
        "card-realms-card",
        `card-realms-card--${card.category}`,
        `card-realms-card--rarity-${card.rarity}`,
        selected && "is-selected",
        !affordable && "is-unaffordable",
      )}
      style={{
        transform: transformStyle,
        transition: "transform 0.12s ease-out",
        cursor: disabled ? "not-allowed" : affordable ? "grab" : "default",
      }}
    >
      <div className="card-realms-card__top">
        <span>
          {categoryEmoji} {categoryLabel} · {cultureBadge} · {rarityInfo.shortLabel}
        </span>
        <span
          title="Custo de Sopro Ancestral"
          className={cn(!affordable && "card-realms-card__cost-unaffordable")}
        >
          <Gem size={14} aria-hidden="true" /> {card.cost} {!affordable ? "(Sem Sopro)" : ""}
        </span>
      </div>

      <div className="card-realms-card__art">
        <PixelCreature sprite={card.portrait} label={card.name} />
        <div className="card-realms-card__title">
          <strong>{card.name}</strong>{" "}
          <small>{card.subtitle}</small>
        </div>
      </div>

      {card.category === "creature" ? (
        <>
          <p className="card-realms-card__desc">
            <strong>⚔️ Investida:</strong> {card.attack} ATQ (+{card.biomeAttackBonus} em{" "}
            {card.favoredBiomes.map((b) => getTerritoryBiome(b).shortName).join("/")})
            <br />
            <strong>🔮 {card.awakeningPower.name}:</strong> {card.awakeningPower.description}
            {card.passiveTrait ? (
              <>
                <br />
                <strong>🛡️ {card.passiveTrait.name}:</strong> {card.passiveTrait.description}
              </>
            ) : null}
          </p>
          <div className="card-realms-card__footer">
            <span>
              <Swords size={13} aria-hidden="true" /> {card.attack}{" "}
              <Heart size={13} aria-hidden="true" /> {card.maxHp}
            </span>
            <span>
              {card.weaknesses?.length
                ? `Fraq: ${card.weaknesses.map((e) => ELEMENT_LABELS[e]).join("/")}`
                : `Bioma: ${card.favoredBiomes.map((b) => getTerritoryBiome(b).shortName).join("/")}`}
            </span>
          </div>
        </>
      ) : null}

      {card.category === "territory" ? (
        <>
          <p className="card-realms-card__desc">{card.description}</p>
          <div className="card-realms-card__footer">
            <span>🗺️ {getTerritoryBiome(card.biomeId).name}</span>
            <span>Transforma faixa</span>
          </div>
        </>
      ) : null}

      {card.category === "structure" ? (
        <>
          <p className="card-realms-card__desc">{card.description}</p>
          <div className="card-realms-card__footer">
            <span>
              <Shield size={13} aria-hidden="true" /> {card.maxHp} PV
            </span>
            <span>Estrutura física</span>
          </div>
        </>
      ) : null}

      {card.category === "event" ? (
        <>
          <p className="card-realms-card__desc">{card.description}</p>
          <div className="card-realms-card__footer">
            <span>
              <Sparkles size={13} aria-hidden="true" />{" "}
              {card.requiresLane ? "Evento de Faixa" : "Evento Global"}
            </span>
            <span>Impacto imediato</span>
          </div>
        </>
      ) : null}
    </button>
  );
}
