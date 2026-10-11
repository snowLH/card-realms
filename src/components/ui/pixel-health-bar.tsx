import { UI_ART } from "@/game/arpg/art/manifest";
import { useAuthoredImage } from "./use-authored-image";

export function PixelHealthBar({ hp, maxHp, boss = false, className = "",thresholds=[35,70] }: { hp: number; maxHp: number; boss?: boolean; className?: string;thresholds?:readonly number[] }) {
  const fill = useAuthoredImage(UI_ART[boss ? "boss-hp-fill" : "hp-bar-fill"].path);
  const frame = useAuthoredImage(UI_ART[boss ? "boss-hp-frame" : "hp-bar-frame"].path);
  const divider = useAuthoredImage(UI_ART["boss-hp-phase-divider"].path);
  const percent = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  return <span className={`pixel-health-bar ${className}`} role="meter" aria-label={boss ? "Vida do boss" : "Vida"}
    aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={Math.ceil(hp)}>
    <span className="pixel-health-bar__fill" style={{ clipPath: `inset(0 ${100 - percent}% 0 0)`, backgroundImage: `url(${fill})` }} />
    <span className="pixel-health-bar__frame" style={{ backgroundImage: `url(${frame})` }} />
    {boss ? thresholds.map((threshold) => <span key={threshold} className="pixel-health-bar__divider"
      style={{ left: `${threshold}%`, backgroundImage: `url(${divider})` }} />) : null}
  </span>;
}
