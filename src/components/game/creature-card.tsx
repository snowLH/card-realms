"use client";

import { Shield, Swords, Zap } from "lucide-react";
import type { CSSProperties, MouseEventHandler } from "react";
import { ELEMENT_META } from "@/game/catalog";
import type { BattleCreature, CreatureDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PixelCreature } from "./pixel-creature";

const rarityNames = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
  mythic: "Mítica",
} as const;

export function CreatureCard({
  creature,
  battle,
  compact = false,
  active = false,
  disabled = false,
  onClick,
  className,
}: {
  creature: CreatureDefinition;
  battle?: BattleCreature;
  compact?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}) {
  const element = ELEMENT_META[creature.element];
  const style = {
    "--element": element.color,
    "--element-glow": element.glow,
  } as CSSProperties;
  const currentHp = battle?.hp ?? creature.hp;
  const hpPercent = (currentHp / (battle?.maxHp ?? creature.hp)) * 100;

  const content = (
    <>
      <div className="creature-card__halo" />
      <div className="creature-card__header">
        <span className="creature-card__element">{element.short}</span>
        <span className="truncate text-left font-black">{creature.name}</span>
        <span className="ml-auto font-mono text-[11px] font-bold">{currentHp} PV</span>
      </div>
      <div className="creature-card__art">
        <PixelCreature slot={creature.artSlot} label={creature.name} />
        {active ? <span className="creature-card__active">ATIVA</span> : null}
        {battle?.defeated ? <span className="creature-card__defeated">INDISPONÍVEL</span> : null}
      </div>
      <Progress
        value={hpPercent}
        className="mt-2 h-2"
        indicatorClassName={hpPercent <= 30 ? "bg-red-400" : "bg-[var(--element)]"}
      />
      {compact ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge className="border-[var(--element)]/35 bg-[var(--element)]/10 text-[var(--element)]">
            {element.name}
          </Badge>
          <span className="text-[10px] font-bold text-muted-foreground">
            {battle
              ? Object.values(battle.attachedEnergy).reduce((sum, value) => sum + value, 0)
              : creature.attacks.length}{" "}
            EN
          </span>
        </div>
      ) : (
        <>
          <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">
            {creature.description}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Swords className="size-3.5" /> {creature.attacks[0].damage}</span>
            <span className="inline-flex items-center gap-1"><Shield className="size-3.5" /> {creature.defense}</span>
            <span className="inline-flex items-center gap-1"><Zap className="size-3.5" /> {creature.speed}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Badge className="border-[var(--element)]/35 bg-[var(--element)]/10 text-[var(--element)]">
              {element.name}
            </Badge>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {rarityNames[creature.rarity]}
            </span>
          </div>
        </>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn("creature-card text-left", compact && "creature-card--compact", active && "creature-card--active", className)}
        style={style}
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <article
      className={cn("creature-card", compact && "creature-card--compact", active && "creature-card--active", className)}
      style={style}
    >
      {content}
    </article>
  );
}
