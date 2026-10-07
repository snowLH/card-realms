import { type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { BATTLE_ABILITY_ART } from "@/game/battle/ability-visuals";

const PIXEL_COLORS = {
  "1": "primary",
  "2": "highlight",
  "3": "shadow",
} as const;

export function BattleAbilityVfx({
  abilityId,
  actorSide,
  durationMs,
}: {
  abilityId: string;
  actorSide: "player" | "opponent";
  durationMs?: number;
}) {
  const art = BATTLE_ABILITY_ART[abilityId];
  if (!art) return null;

  return (
    <div
      className={cn(
        "avatar-battle-ability-vfx",
        `is-from-${actorSide}`,
        `is-${art.motion}`,
      )}
      data-ability-id={abilityId}
      style={durationMs === undefined ? undefined : { "--battle-vfx-duration": `${durationMs}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 18 18" shapeRendering="crispEdges" focusable="false">
        {art.pixels.flatMap((row, y) => Array.from(row, (pixel, x) => {
          if (pixel === ".") return null;
          const colorName = PIXEL_COLORS[pixel as keyof typeof PIXEL_COLORS];
          const rowOffset = Math.floor((18 - row.length) / 2);
          return (
            <rect
              key={`${x}:${y}`}
              x={x + rowOffset}
              y={y + 1}
              width="1"
              height="1"
              fill={art[colorName]}
            />
          );
        }))}
      </svg>
    </div>
  );
}
