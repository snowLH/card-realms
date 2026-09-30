"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { BattlePresentationEvent } from "@/game/battle/presentation-events";
import type { BattleCreature, CreatureDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { CreatureCard } from "./creature-card";
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
      )}
    >
      <AnimatePresence mode="wait">
        {!ko ? (
          <motion.div
            key={battle.instanceId}
            className="battle-active-creature__sprite"
            initial={{ opacity: 0, y: 26, scale: .72 }}
            animate={{
              opacity: 1,
              y: attacking ? -8 : [0, -3, 0],
              x: attacking ? (mirrored ? -18 : 18) : 0,
              scale: critical ? 1.12 : 1,
              rotate: hit ? [0, -3, 3, 0] : 0,
            }}
            exit={{ opacity: 0, y: 22, scale: .72 }}
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
            />
          </motion.div>
        ) : (
          <motion.div
            key={`${battle.instanceId}:ko`}
            className="battle-active-creature__ko"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: .65, y: 18 }}
            transition={{ duration: .65 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="battle-active-creature__card"
        animate={{
          y: attacking ? -5 : 0,
          scale: attacking ? 1.025 : 1,
          filter: hit ? "brightness(1.35)" : "brightness(1)",
        }}
        transition={{ duration: .22 }}
      >
        <CreatureCard
          creature={definition}
          battle={battle}
          compact
          active
          className="table-active-card"
        />
      </motion.div>

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
