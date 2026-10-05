"use client";

import { Hand } from "lucide-react";
import type { ArpgBridge } from "@/game/arpg/runtime/bridge";

export function HubTouchControls({ bridge }: { bridge: ArpgBridge }) {
  const updateStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const radius = Math.max(1, rect.width * 0.42);
    const length = Math.hypot(x, y);
    const scale = length > radius ? radius / length : 1;
    bridge.setMove((x * scale) / radius, (y * scale) / radius);
  };

  const stop = () => bridge.setMove(0, 0);

  return (
    <div className="arpg-hub-touch" aria-label="Controles do HUB">
      <div
        className="arpg-hub-stick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <span />
      </div>
      <button
        type="button"
        aria-label="Interagir com a estação próxima"
        onClick={() => bridge.queueInteract()}
      >
        <Hand /> Interagir
      </button>
    </div>
  );
}
