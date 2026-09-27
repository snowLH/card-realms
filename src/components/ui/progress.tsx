import type { CSSProperties } from "react";
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
      className={cn("h-2.5 overflow-hidden rounded-full bg-black/45", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500", indicatorClassName)}
        style={{ "--progress-value": `${normalized}%`, width: "var(--progress-value)" } as CSSProperties}
      />
    </div>
  );
}
