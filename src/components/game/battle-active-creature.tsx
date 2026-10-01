"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { BattlePresentationEvent } from "@/game/battle/presentation-events";
import type { BattleCreature, CreatureDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { PixelCreature } from "./pixel-creature";

export function BattleActiveCreature({
  definition,
  battle,
  sideId,
  presentationEvent,
  mirrored = false,
}: {
  definition: CreatureDefinition;
  battle: BattleCreature;
  sideId: string;
  presentationEvent: BattlePresentationEvent | null;
  mirrored?: boolean;
}) {
  const actor = presentationEvent?.actorId === sideId;
  const attacking = actor && ["attack", "critical", "miss"].includes(presentationEvent?.kind ?? "");
  const hit = !actor && ["attack", "critical"].includes(presentationEvent?.kind ?? "");
  const critical = presentationEvent?.kind === "critical";
  const ko = battle.defeated || (!actor && presentationEvent?.kind === "ko");
  const switching = actor && ["switch", "forcedSwitch"].includes(presentationEvent?.kind ?? "");
  const evolved = (battle.evolutionStage ?? 0) > 0;
  const hpPercent = Math.max(0, Math.min(100, (battle.hp / battle.maxHp) * 100));

  return (
    <div
      className={cn(
        "battle-active-creature",
        mirrored && "is-mirrored",
        attacking && "is-attacking",
        hit && "is-hit",
        critical && "is-critical",
        ko && "is-ko",
        switching && "is-switching",
        evolved && "is-evolved",
      )}
    >
      <div className="battle-active-creature__hud">
        <div className="battle-active-creature__hud-title">
          <strong>{definition.name}</strong>
          {evolved ? <span>VÍNCULO I</span> : null}
        </div>
        <div className="battle-active-creature__hp-row">
          <span>HP</span>
          <div className="battle-active-creature__hp-track">
            <motion.i
              animate={{ width: `${hpPercent}%` }}
              transition={{ duration: .38, ease: "easeOut" }}
            />
          </div>
          <small>{battle.hp}/{battle.maxHp}</small>
        </div>
        <div className="battle-active-creature__resources">
          <span>{battle.attachedEnergy.length} EN</span>
          <span>{battle.equippedPowerIds.length}/4 PODERES</span>
          {battle.shield > 0 ? <span>{battle.shield} ESC</span> : null}
        </div>
      </div>

      <AnimatePresence>
        {!ko ? (
          <motion.div
            key={`${battle.instanceId}:summon-card`}
            className={cn(
              "battle-summon-card",
              `is-${definition.element}`,
              mirrored && "is-mirrored",
            )}
            initial={{ opacity: 0, scale: .55, y: 28, rotateY: 88 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [.55, 1.08, 1, .72],
              y: [28, 0, -4, 18],
              rotateY: [88, 0, 0, -16],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: .78, times: [0, .28, .68, 1], ease: "easeOut" }}
          >
            <div className="battle-summon-card__frame">
              <PixelCreature sprite={definition.sprite} label={definition.name} mirrored={mirrored} />
              <strong>{definition.name}</strong>
              <small>{definition.title}</small>
            </div>
            <span className="battle-summon-card__burst" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!ko ? (
          <motion.div
            key={battle.instanceId}
            className="battle-active-creature__sprite"
            initial={{ opacity: 0, y: 24, scale: .65 }}
            animate={{
              opacity: 1,
              y: attacking ? -8 : [0, -4, 0],
              x: attacking ? (mirrored ? -22 : 22) : 0,
              scale: critical ? 1.18 : evolved ? 1.1 : 1,
              rotate: hit ? [0, -4, 4, 0] : 0,
            }}
            exit={{ opacity: 0, y: 20, scale: .6 }}
            transition={
              attacking
                ? { duration: .34, ease: "easeOut" }
                : { y: { duration: 2.2, repeat: Infinity, ease: "easeInOut" }, duration: .28 }
            }
          >
            <span className="battle-active-creature__shadow" />
            <PixelCreature
              sprite={definition.sprite}
              label={definition.name}
              mirrored={mirrored}
              evolved={evolved}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`${battle.instanceId}:ko`}
            className="battle-active-creature__ko"
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: [1, .72, 0], scale: [1, .82, .42], y: [0, 10, 34] }}
            transition={{ duration: .72 }}
          >
            <span className="battle-active-creature__ko-particles" />
            <div className={cn("battle-ko-card", `is-${definition.element}`)}>
              <PixelCreature sprite={definition.sprite} label={definition.name} mirrored={mirrored} />
              <strong>{definition.name}</strong>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hit && typeof presentationEvent?.damage === "number" ? (
          <motion.strong
            key={presentationEvent.id}
            className={cn("battle-damage-number", critical && "is-critical")}
            initial={{ opacity: 0, y: 12, scale: .65 }}
            animate={{ opacity: 1, y: -28, scale: critical ? 1.28 : 1 }}
            exit={{ opacity: 0, y: -48 }}
            transition={{ duration: .68 }}
          >
            -{presentationEvent.damage}
          </motion.strong>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
