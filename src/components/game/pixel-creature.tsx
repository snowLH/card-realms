import type { CSSProperties } from "react";
import type { SpriteDefinition } from "@/game/types";
import { cn } from "@/lib/utils";

export function PixelCreature({
  sprite,
  className,
  mirrored = false,
  label,
}: {
  sprite: SpriteDefinition;
  className?: string;
  mirrored?: boolean;
  label?: string;
}) {
  const x = sprite.columns === 1 ? 0 : (sprite.column / (sprite.columns - 1)) * 100;
  const y = sprite.rows === 1 ? 0 : (sprite.row / (sprite.rows - 1)) * 100;
  const style = {
    backgroundImage: `url("${sprite.sheet}")`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: `${sprite.columns * 100}% ${sprite.rows * 100}%`,
    "--sprite-scale-x": mirrored ? -1 : 1,
  } as CSSProperties;

  return (
    <div
      role="img"
      aria-label={label ?? "Criatura"}
      className={cn("pixel-creature", className)}
      style={style}
    />
  );
}
