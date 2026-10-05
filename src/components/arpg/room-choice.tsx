"use client";

import { Coins, Heart, Sparkles, Store } from "lucide-react";
import type { ArpgHudState } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";

function ChoiceIcon({ type }: { type: "rest" | "event" | "shop" }) {
  if (type === "rest") return <Heart />;
  if (type === "shop") return <Store />;
  return <Sparkles />;
}

export function RoomChoice({ state, bridge }: { state: ArpgHudState | null; bridge: ArpgBridge }) {
  const encounter = state?.pendingRoomChoice;
  if (!state || !encounter) return null;

  return (
    <div className="arpg-loot-choice arpg-room-choice" role="dialog" aria-modal="true" aria-label={encounter.title}>
      <div className="arpg-loot-choice__panel arpg-room-choice__panel">
        <header>
          <small>SALA ESPECIAL</small>
          <strong><ChoiceIcon type={encounter.type} /> {encounter.title}</strong>
          <span>{encounter.description}</span>
        </header>
        <div className="arpg-room-choice__wallet"><Coins /> {state.runShards} fragmentos da run</div>
        <div className="arpg-room-choice__options">
          {encounter.options.map((option) => {
            const disabled = option.costShards > state.runShards;
            return (
              <button
                type="button"
                key={option.id}
                disabled={disabled}
                onClick={() => bridge.queueRoomChoice(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
                <small>{option.costShards > 0 ? `${option.costShards} fragmentos` : "Grátis"}</small>
              </button>
            );
          })}
        </div>
        <small className="arpg-room-choice__note">Fragmentos existem apenas nesta run e não gastam suas moedas permanentes.</small>
      </div>
    </div>
  );
}
