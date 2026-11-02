"use client";

import { PixelCreature } from "@/components/game/pixel-creature";
import { Gem, Heart, Shield, Sparkles, Swords } from "@/components/ui/pixel-icon";
import { CARD_CATEGORY_LABELS } from "@/game/card-realms/domain/cards";
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
  selected = false,
  affordable = true,
  disabled = false,
  onClick,
}: {
  card: CardDefinition;
  selected?: boolean;
  affordable?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const categoryLabel = CARD_CATEGORY_LABELS[card.category];
  const categoryEmoji = CATEGORY_EMOJI[card.category];
  const cultureBadge =
    card.culture === "neutral"
      ? "🌍 Ancestral"
      : card.culture === "brasil"
        ? `🇧🇷 ${getCulture("brasil").countryLabel}`
        : `🇯🇵 ${getCulture("japao").countryLabel}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn("card-realms-card", selected && "is-selected")}
    >
      <div className="card-realms-card__top">
        <span>
          {categoryEmoji} {categoryLabel} · {cultureBadge}
        </span>
        <span title="Custo de Sopro Ancestral">
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
          </p>
          <div className="card-realms-card__footer">
            <span>
              <Swords size={13} aria-hidden="true" /> {card.attack}{" "}
              <Heart size={13} aria-hidden="true" /> {card.maxHp}
            </span>
            <span>
              Bioma:{" "}
              {card.favoredBiomes.map((b) => getTerritoryBiome(b).shortName).join(" / ")}
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
