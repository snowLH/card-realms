import type { BattleLogEntry } from "./types";

export type BattlePresentationKind =
  | "enter"
  | "turn"
  | "draw"
  | "energy"
  | "roll"
  | "ability"
  | "attack"
  | "miss"
  | "critical"
  | "status"
  | "terrainOn"
  | "terrainOff"
  | "ko"
  | "end";

export type BattlePresentationEvent = {
  id: string;
  kind: BattlePresentationKind;
  actorId: string;
  message: string;
  die?: number;
  damage?: number;
  abilityId?: string;
  abilitySlot?: 0 | 1;
  effect?: BattleLogEntry["effect"];
  terrainElement?: BattleLogEntry["terrainElement"];
  terrainTurns?: number;
  energyCardId?: string;
  energyElement?: BattleLogEntry["energyElement"];
};

const KIND_MAP: Partial<Record<BattleLogEntry["kind"], BattlePresentationKind>> = {
  battle_start: "enter",
  turn_started: "turn",
  energy_drawn: "draw",
  energy_attached: "energy",
  ability_used: "ability",
  attack_hit: "attack",
  attack_miss: "miss",
  critical: "critical",
  status_applied: "status",
  status_tick: "status",
  healed: "status",
  shielded: "status",
  terrain_activated: "terrainOn",
  terrain_expired: "terrainOff",
  conceded: "end",
  defeated: "ko",
  battle_end: "end",
};

export function toBattlePresentationEvents(events: readonly BattleLogEntry[]): BattlePresentationEvent[] {
  const sequence: BattlePresentationEvent[] = [];
  for (const event of events) {
    const kind = KIND_MAP[event.kind];
    if (!kind) continue;
    if (typeof event.die === "number") {
      sequence.push({
        id: `${event.id}:roll`,
        kind: "roll",
        actorId: event.actorId,
        message: event.message,
        die: event.die,
        abilityId: event.abilityId,
        abilitySlot: event.abilitySlot,
      });
    }
    sequence.push({
      id: event.id,
      kind,
      actorId: event.actorId,
      message: event.message,
      die: event.die,
      damage: event.damage,
      abilityId: event.abilityId,
      abilitySlot: event.abilitySlot,
      effect: event.effect,
      terrainElement: event.terrainElement,
      terrainTurns: event.terrainTurns,
      energyCardId: event.energyCardId,
      energyElement: event.energyElement,
    });
  }
  return sequence;
}

export function presentationDuration(kind: BattlePresentationKind, speed: "normal" | "fast" | "very-fast" = "normal") {
  const base: Record<BattlePresentationKind, number> = {
    enter: 540,
    turn: 520,
    draw: 360,
    energy: 520,
    roll: 620,
    ability: 720,
    attack: 900,
    miss: 760,
    critical: 1040,
    status: 460,
    terrainOn: 980,
    terrainOff: 620,
    ko: 900,
    end: 700,
  };
  const factor = speed === "fast" ? 0.62 : speed === "very-fast" ? 0.38 : 1;
  return Math.max(180, Math.round(base[kind] * factor));
}
