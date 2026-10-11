import { UI_ART } from "@/game/arpg/art/manifest";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  label,
  className,
  indicatorClassName,
}: {
  value: number;
  label: string;
  className?: string;
  indicatorClassName?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={normalized}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("pixel-health-bar authored-progress", className)}
    >
      <span
        className={cn("pixel-health-bar__fill", indicatorClassName)}
        style={{ clipPath:`inset(0 ${100-normalized}% 0 0)`,backgroundImage:`url(${UI_ART['hp-bar-fill'].path})` }}
      />
      <span className="pixel-health-bar__frame" style={{backgroundImage:`url(${UI_ART['hp-bar-frame'].path})`}}/>
    </div>
  );
}
