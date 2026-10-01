"use client";

import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import type { BattleLogEntry } from "@/game/types";
import { cn } from "@/lib/utils";

export function BattleLogSheet({
  entries,
  open,
  onToggle,
}: {
  entries: BattleLogEntry[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={cn("battle-log", !open && "is-collapsed")}>
      <button
        type="button"
        className="battle-section-title battle-log__toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>HISTÓRICO</span>
        <span className="battle-log__toggle-meta">
          <ShieldCheck />
          {open ? <ChevronUp /> : <ChevronDown />}
        </span>
      </button>
      <div className="battle-log__entries">
        {entries.slice(open ? -9 : -3).reverse().map((entry) => (
          <p key={entry.id}>
            {entry.die ? <strong>D{entry.die}</strong> : null} {entry.message}
          </p>
        ))}
      </div>
    </aside>
  );
}
