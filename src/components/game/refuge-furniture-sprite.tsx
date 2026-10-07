import type { ReactNode } from "react";
import type { RefugeFurnitureKey } from "@/game/refuge";

const FURNITURE_ART: Record<RefugeFurnitureKey, ReactNode> = {
  armchair: <>
    <path fill="#23191d" d="M8 2h16v10h4v16h-4v4h-4v-4h-8v4H8v-4H4V12h4Z" />
    <path fill="#973d48" d="M10 4h12v14H10ZM6 14h4v10H6Zm16 0h4v10h-4Z" />
    <path fill="#d6655e" d="M12 6h8v8h-8ZM8 14h2v8H8Zm16 0h2v8h-2ZM10 18h12v6H10Z" />
    <path fill="#ec9980" d="M12 6h8v2h-8ZM10 18h12v2H10Z" />
    <path fill="#794634" d="M10 26h2v4h-2Zm10 0h2v4h-2Z" />
  </>,
  lamp: <>
    <path fill="#23191d" d="M10 2h12v4h2v4h2v6H18v10h6v2h2v4H6v-4h2v-2h6V16H6v-6h2V6h2Z" />
    <path fill="#d99a46" d="M12 4h8v4h2v4h2v2H8v-2h2V8h2Z" />
    <path fill="#ffdf87" d="M12 4h4v4h-2v4h-4V8h2Z" />
    <path fill="#9a6138" d="M16 16v10h-2V16Zm-6 12h12v2H10Z" />
    <path fill="#f5c369" d="M16 16h2v10h-2Zm-6 12h8v2h-8Z" />
  </>,
  plant: <>
    <path fill="#23191d" d="M14 2h6v4h4v4h6v6h-4v4h-6v2h6v6h-2v4H8v-4H6v-6h6v-2H6v-4H2v-6h8V6h4Z" />
    <path fill="#276440" d="M16 4h2v12h-2ZM4 12h8v4H8v2H6v-2H4Zm16 0h8v2h-4v4h-4Z" />
    <path fill="#64bc66" d="M14 8h2v8h-4v-6h2ZM4 12h6v2H4Zm16-4h2v4h-4v-2h2Zm2 4h6v2h-6Z" />
    <path fill="#a65738" d="M8 24h16v2h-2v4H10v-4H8Z" />
    <path fill="#e29251" d="M8 24h16v2H8Zm2 2h4v4h-4Z" />
  </>,
  books: <>
    <path fill="#23191d" d="M8 4h18v8h2v8h2v10H2V20h2v-8h4Z" />
    <path fill="#b54d55" d="M10 6h14v2H10Zm0 4h14v2H10Z" />
    <path fill="#f0d493" d="M12 8h12v2H12ZM8 16h16v2H8ZM6 24h20v2H6Z" />
    <path fill="#417d91" d="M6 14h18v2H6Zm0 2h2v2H6Zm0 2h18v2H6Z" />
    <path fill="#80639a" d="M4 22h24v2H4Zm0 2h2v2H4Zm0 2h24v2H4Z" />
    <path fill="#e89975" d="M10 6h4v2h-4Z" />
  </>,
  chest: <>
    <path fill="#23191d" d="M6 6h20v2h2v4h2v16H2V12h2V8h2Z" />
    <path fill="#b9783c" d="M6 10h20v4h2v10H4V14h2Z" />
    <path fill="#e5ac54" d="M8 8h16v2H8Zm-2 2h4v4H6Zm18 0h2v4h-2ZM4 18h24v2H4Z" />
    <path fill="#794432" d="M4 14h24v4H4Zm0 10h24v2H4Z" />
    <path fill="#23191d" d="M12 16h8v8h-8Z" />
    <path fill="#f4d16f" d="M14 18h4v4h-4Z" />
    <path fill="#e5ac54" d="M6 20h2v4H6Zm18 0h2v4h-2Z" />
  </>,
  "map-stand": <>
    <path fill="#23191d" d="M14 0h4v2h10v22H20v4h4v4h-6v-4h-4v4H8v-4h4v-4H4V2h10Z" />
    <path fill="#80513a" d="M6 4h20v18H6Zm8 20h4v4h-4Zm-4 6h2v2h-2Zm10 0h2v2h-2Z" />
    <path fill="#f0d493" d="M8 6h16v14H8Z" />
    <path fill="#83a266" d="M10 8h6v4h-4v2h-2Zm8 6h4v4h-6v-2h2Z" />
    <path fill="#527d9b" d="M18 6h2v6h-2v4h-4v4h-2v-6h4v-4h2Z" />
    <path fill="#bc5051" d="M20 8h2v2h-2ZM10 16h2v2h-2Z" />
  </>,
};

export function RefugeFurnitureSprite({ itemKey, className }: { itemKey: RefugeFurnitureKey; className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    {FURNITURE_ART[itemKey]}
  </svg>;
}
