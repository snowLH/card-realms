"use client";

import type { CSSProperties } from "react";
import {
  DEFAULT_AVATAR_CONFIG,
  type AvatarConfig,
} from "@/game/save/local-progress";
import { getGeneratedLegendSpriteSheet } from "@/game/arpg/runtime/legend-sprite-sheets";
import { cn } from "@/lib/utils";

export function CharacterAvatar2D({
  config = DEFAULT_AVATAR_CONFIG,
  compact = false,
  idleStrip = false,
  ariaLabel = "Lenda de Folklard",
  animation = "idle",
  animationDurationMs,
}: {
  config?: AvatarConfig;
  compact?: boolean;
  idleStrip?: boolean;
  ariaLabel?: string;
  animation?: "idle" | "walk" | "attack" | "shoot" | "damage" | "defeat";
  animationDurationMs?: number;
}) {
  const generatedSpriteSheet = getGeneratedLegendSpriteSheet(config.legendId);

  return (
    <div
      className={cn(
        "character-avatar-2d",
        "character-avatar-2d--native-legend",
        compact && "character-avatar-2d--compact",
        idleStrip && "character-avatar-2d--idle-strip",
        `character-avatar-2d--animation-${animation}`,
        `character-avatar-2d--skin-${config.skin}`,
        `character-avatar-2d--hair-${config.hair}`,
        `character-avatar-2d--outfit-${config.outfit}`,
        `character-avatar-2d--accent-${config.accent}`,
      )}
      style={animationDurationMs === undefined
        ? undefined
        : { "--avatar-cast-duration": `${animationDurationMs}ms` } as CSSProperties}
      role="img"
      aria-label={ariaLabel}
      data-legend-id={config.legendId}
      data-sprite-source={generatedSpriteSheet ? "generated" : "missing"}
    >
      <span
        className="character-avatar-2d__sprite"
        aria-hidden="true"
        style={{ backgroundImage: generatedSpriteSheet ? `url("${generatedSpriteSheet}")` : "none" }}
      />
    </div>
  );
}
