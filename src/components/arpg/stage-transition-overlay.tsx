"use client";

import { useEffect, useState } from "react";
import { Compass, Sparkles, MapPin, Check, Skull, X } from "@/components/ui/pixel-icon";
import type { ArpgBridge, ArpgStageTransition } from "@/game/arpg/runtime/bridge";

export function StageTransitionOverlay({
  bridge,
}: {
  bridge: ArpgBridge;
}) {
  const [activeTransition, setActiveTransition] = useState<ArpgStageTransition | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = bridge.onStageTransition?.((transition) => {
      setActiveTransition(transition);
      setVisible(true);
    });
    return () => {
      unsubscribe?.();
    };
  }, [bridge]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 4200);
    return () => clearTimeout(timer);
  }, [visible, activeTransition]);

  if (!visible || !activeTransition) return null;

  const { stage } = activeTransition;
  const isBossArena = stage.index === 4;

  return (
    <div
      className="arpg-stage-transition-overlay"
      role="status"
      aria-live="polite"
      onClick={() => setVisible(false)}
    >
      <div
        className={`arpg-stage-transition-card ${isBossArena ? "is-boss" : ""}`}
      >
        <button
          type="button"
          className="arpg-stage-transition-card__close"
          aria-label="Dispensar aviso de zona"
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
          }}
        >
          <X aria-hidden="true" />
        </button>

        <header className="arpg-stage-transition-card__header">
          <div className="arpg-stage-transition-card__badge">
            {isBossArena ? <Skull aria-hidden="true" /> : <Compass aria-hidden="true" />}
            <span>{stage.badge}</span>
          </div>
          <span className="arpg-stage-transition-card__region">EXPEDIÇÃO CARTOGRÁFICA</span>
        </header>

        <div className="arpg-stage-transition-card__body">
          <h2 className="arpg-stage-transition-card__title">
            {stage.name}
          </h2>
          <p className="arpg-stage-transition-card__subtitle">{stage.subtitle}</p>
          <p className="arpg-stage-transition-card__desc">{stage.description}</p>
        </div>

        <div className="arpg-stage-transition-card__environmental">
          <MapPin aria-hidden="true" />
          <span>{stage.environmentalDetail}</span>
        </div>

        <blockquote className="arpg-stage-transition-card__quote">
          <Sparkles aria-hidden="true" />
          <span>“{stage.folkloreQuote}”</span>
        </blockquote>

        <footer className="arpg-stage-transition-card__progress" aria-label="Progresso na expedição">
          {[1, 2, 3, 4].map((stepIndex) => {
            const isCompleted = stepIndex < stage.index;
            const isCurrent = stepIndex === stage.index;
            const isBoss = stepIndex === 4;
            return (
              <div
                key={stepIndex}
                className={`arpg-stage-step ${isCompleted ? "is-completed" : ""} ${isCurrent ? "is-current" : ""}`}
              >
                <span className="arpg-stage-step__dot">
                  {isCompleted ? <Check aria-hidden="true" /> : isBoss ? <Skull aria-hidden="true" /> : stepIndex}
                </span>
                <span className="arpg-stage-step__label">
                  {isBoss ? "Chefe" : `Zona ${stepIndex}`}
                </span>
              </div>
            );
          })}
        </footer>
      </div>
    </div>
  );
}
