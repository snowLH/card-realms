"use client";

import { Coins, Heart, Sparkles, Store } from "lucide-react";
import type { ArpgHudState } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { useChoiceFocus } from "./use-choice-focus";

function ChoiceIcon({ type }: { type: "rest" | "event" | "shop" }) {
  if (type === "rest") return <Heart />;
  if (type === "shop") return <Store />;
  return <Sparkles />;
}

const roomTypeLabel: Record<"rest" | "event" | "shop", string> = {
  rest: "ABRIGO DE EXPEDIÇÃO",
  event: "ENCONTRO SOBRENATURAL",
  shop: "COMÉRCIO DA DUNGEON",
};

export function RoomChoice({ state, bridge }: { state: ArpgHudState | null; bridge: ArpgBridge }) {
  const encounter = state?.pendingRoomChoice;
  const choiceRef = useChoiceFocus(Boolean(encounter));
  if (!state || !encounter) return null;

  return (
    <div
      ref={choiceRef}
      className="arpg-loot-choice arpg-room-choice"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arpg-room-choice-title"
      aria-describedby="arpg-room-choice-description"
      data-room-kind={encounter.type}
    >
      <div className="arpg-loot-choice__panel arpg-room-choice__panel">
        <header>
          <small>{roomTypeLabel[encounter.type]}</small>
          <strong id="arpg-room-choice-title"><ChoiceIcon type={encounter.type} /> {encounter.title}</strong>
          <span id="arpg-room-choice-description">{encounter.description}</span>
        </header>
        <div className="arpg-room-choice__wallet" aria-label={`${state.runShards} fragmentos disponíveis nesta run`}>
          <Coins aria-hidden="true" /> {state.runShards} fragmentos da run
        </div>
        <div className="arpg-room-choice__options">
          {encounter.options.map((option) => {
            const disabled = option.costShards > state.runShards;
            const costLabel = option.costShards === 0
              ? "Sem custo"
              : disabled
                ? `Faltam ${option.costShards - state.runShards} fragmentos · custo ${option.costShards}`
                : `Custo: ${option.costShards} fragmentos`;
            return (
              <button
                type="button"
                key={option.id}
                disabled={disabled}
                aria-describedby={`arpg-room-choice-option-${option.id}`}
                className={`arpg-room-choice__option arpg-room-choice__option--${option.id}`}
                onClick={() => bridge.queueRoomChoice(option.id)}
              >
                <strong>{option.label}</strong>
                <span id={`arpg-room-choice-option-${option.id}`}>{option.description}</span>
                <small aria-label={costLabel}>{costLabel}</small>
              </button>
            );
          })}
        </div>
        <small className="arpg-room-choice__note">
          Estas salas oferecem cura, fragmentos ou bônus temporários da expedição. Os dois ataques principais vêm juntos com a Lenda escolhida na Guilda.
          Fragmentos desta run não gastam suas moedas permanentes.
        </small>
      </div>
    </div>
  );
}
