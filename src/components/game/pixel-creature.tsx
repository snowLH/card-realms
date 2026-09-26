import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function PixelCreature({
  slot,
  className,
  mirrored = false,
  label,
}: {
  slot: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  mirrored?: boolean;
  label?: string;
}) {
  const column = slot % 4;
  const row = Math.floor(slot / 4);
  const style = {
    "--sprite-x": `${(column / 3) * 100}%`,
    "--sprite-y": `${row * 100}%`,
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
