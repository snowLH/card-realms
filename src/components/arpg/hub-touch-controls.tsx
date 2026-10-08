"use client";

import { Hand } from "lucide-react";
import type { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { useTouchAction, useVirtualJoystick } from "./touch-input";

export function HubTouchControls({ bridge }: { bridge: ArpgBridge }) {
  const stickInput = useVirtualJoystick(bridge);
  const interactInput = useTouchAction(() => bridge.queueInteract());

  return (
    <div className="arpg-hub-touch" aria-label="Controles do HUB">
      <div
        className="arpg-hub-stick"
        role="group"
        aria-label="Joystick da Guilda"
        {...stickInput}
      >
        <span />
      </div>
      <button
        type="button"
        aria-label="Interagir com a estação próxima"
        {...interactInput}
      >
        <Hand /> Interagir
      </button>
    </div>
  );
}
