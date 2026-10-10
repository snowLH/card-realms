import type { BossEncounterSnapshot } from "../boss-encounter-controller";
import { introPose } from "../boss-intro-controller";

export const ARTHUR_CHARACTER_ART = {
  restored: { key: "boss-arthur-restored-v5", path: "/art/legend-king-arthur-spritesheet-v5.webp" },
  corrupted: { key: "boss-arthur-corrupted-v5", path: "/art/monster-king-arthur-corrupted-spritesheet-v5.webp" },
} as const;

const INTRO_FRAMES = { seated: 0, hand: 1, head: 2, eyes: 3, stumble: 4, support: 5, draw: 6, ready: 7 } as const;

/** Phaser and co-op select the SAME authored v5 pose, using authority time. */
export function arthurArtFrame(encounter: BossEncounterSnapshot, nowMs = encounter.serverTimeMs) {
  if (["RESTORED", "UNLOCK", "CLEARED"].includes(encounter.state)) {
    return { ...ARTHUR_CHARACTER_ART.restored, frame: Math.floor(nowMs / 280) % 4 };
  }
  let frame: number;
  if (["INACTIVE", "ROOM_ENTERED", "INTRO_LOCK", "AWAKENING"].includes(encounter.state)) {
    frame = INTRO_FRAMES[introPose(nowMs - encounter.enteredAtMs, encounter.seenByAll) as keyof typeof INTRO_FRAMES];
  } else if (encounter.state === "DEFEATED") frame = 18; // Kneeling alive, empty hands.
  else if (encounter.state === "PURIFICATION") {
    const elapsed = nowMs - encounter.stateAtMs;
    frame = elapsed < 1400 ? 19 : 20 + Math.min(3, Math.floor((elapsed - 1400) / 1275));
  } else if (nowMs < encounter.guardUntilMs) frame = 16;
  else if (nowMs < encounter.weakUntilMs) frame = 17;
  else if (encounter.hazards.length) frame = 12 + Math.floor(Math.max(0, nowMs - encounter.hazards[0].createdAtMs) / 180) % 4;
  else frame = 8 + Math.floor(nowMs / 240) % 4;
  return { ...ARTHUR_CHARACTER_ART.corrupted, frame };
}
