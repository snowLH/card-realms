"use client";

import { Volume2, VolumeX, X } from "lucide-react";
import type { BattleState } from "@/game/types";
import { cn } from "@/lib/utils";

export type BattleAnimationSpeed = "normal" | "fast" | "very-fast";

export function BattleTopbar({
  mode,
  pvp,
  round,
  status,
  playerTurn,
  forcedSwitch,
  opponentName,
  soundEnabled,
  onToggleSound,
  animationSpeed,
  onAnimationSpeedChange,
  busy,
  onClose,
}: {
  mode: BattleState["mode"];
  pvp: boolean;
  round: number;
  status: BattleState["status"];
  playerTurn: boolean;
  forcedSwitch: boolean;
  opponentName: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  animationSpeed: BattleAnimationSpeed;
  onAnimationSpeedChange: (speed: BattleAnimationSpeed) => void;
  busy: boolean;
  onClose: () => void;
}) {
  const eyebrow = pvp
    ? "Duelo entre cartógrafos"
    : mode === "wild"
      ? "Encontro selvagem"
      : mode === "boss"
        ? "Confronto de guardião"
        : mode === "sanctuary"
          ? "Provação de santuário"
          : "Duelo de viajante";

  const turnLabel = status === "finished"
    ? "Batalha concluída"
    : playerTurn
      ? forcedSwitch
        ? "Escolha a próxima criatura"
        : "Seu turno"
      : `Turno de ${opponentName}`;

  return (
    <header className="battle-topbar">
      <div>
        <span className="battle-eyebrow">{eyebrow}</span>
        <strong>Rodada {round}</strong>
      </div>
      <div className="battle-turn">
        <span className={cn("battle-turn__dot", playerTurn && "battle-turn__dot--active")} />
        {turnLabel}
      </div>
      <button
        type="button"
        className={cn("battle-sound-toggle", soundEnabled && "is-active")}
        onClick={onToggleSound}
        aria-label={soundEnabled ? "Desativar sons da batalha" : "Ativar sons da batalha"}
      >
        {soundEnabled ? <Volume2 /> : <VolumeX />}
      </button>
      <div className="battle-speed" aria-label="Velocidade das animações">
        {(["normal", "fast", "very-fast"] as const).map((speed) => (
          <button
            key={speed}
            type="button"
            className={cn(animationSpeed === speed && "is-active")}
            onClick={() => onAnimationSpeedChange(speed)}
            disabled={busy}
          >
            {speed === "normal" ? "1×" : speed === "fast" ? "1.6×" : "2.6×"}
          </button>
        ))}
      </div>
      <button type="button" className="battle-close" onClick={onClose} aria-label="Sair da batalha">
        <X />
      </button>
    </header>
  );
}
