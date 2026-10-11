"use client";
import { useState, type CSSProperties } from "react";
import { ART_ATLASES, FOLKLARD_ART_MANIFEST } from "@/game/arpg/art/manifest";

/** Clips an authored atlas frame. The clipping boundary itself is invisible. */
export function ArtSprite({ pack, frame, className, style, label }: {
  pack: keyof typeof ART_ATLASES; frame: number; className?: string; style?: CSSProperties; label?: string;
}) {
  const [failed, setFailed] = useState(false);
  return <span className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ display: "inline-block", position: "relative", width: 32, height: 32, ...style, overflow: "hidden", imageRendering: "pixelated" }}>
    {/* Native images preserve atlas pixels without Next resizing or smoothing. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="" src={failed ? FOLKLARD_ART_MANIFEST.missing.path : ART_ATLASES[pack].path} draggable={false}
      onError={() => { if (!failed) { console.error(`Missing authored atlas: ${ART_ATLASES[pack].path}`); setFailed(true); } }}
      style={{ position: "absolute", width: failed ? "100%" : "800%", height: failed ? "100%" : "800%", maxWidth: "none",
        left: failed ? 0 : `${-(frame % 8) * 100}%`, top: failed ? 0 : `${-Math.floor(frame / 8) * 100}%`, imageRendering: "pixelated" }} />
  </span>;
}
