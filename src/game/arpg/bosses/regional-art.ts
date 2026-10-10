import { ARPG_ASSET_MANIFEST } from "../assets";
import type { BossEncounterSnapshot } from "./boss-encounter-controller";

export type RegionalForgottenLegendId = "ancestral-curupira" | "deep-iara";

export const REGIONAL_BOSS_ART = {
  "ancestral-curupira": {
    key: ARPG_ASSET_MANIFEST.enemies["curupira-boss"].textureKey,
    path: ARPG_ASSET_MANIFEST.enemies["curupira-boss"].path,
    corruptionTint: 0xb292c7,
    restoredTint: 0xffffff,
    shadow: 0x21182a,
    ground: 0x29392d,
    memory: 0x839f62,
  },
  "deep-iara": {
    key: ARPG_ASSET_MANIFEST.enemies["iara-boss"].textureKey,
    path: ARPG_ASSET_MANIFEST.enemies["iara-boss"].path,
    corruptionTint: 0xa78bc7,
    restoredTint: 0xffffff,
    shadow: 0x151b31,
    ground: 0x233d48,
    memory: 0x69aeb6,
  },
} as const;

export function isRegionalForgottenLegend(id: string): id is RegionalForgottenLegendId {
  return id === "ancestral-curupira" || id === "deep-iara";
}

export function regionalBossArtFrame(encounter: BossEncounterSnapshot, nowMs = encounter.serverTimeMs) {
  if (!isRegionalForgottenLegend(encounter.bossId)) return null;
  const art = REGIONAL_BOSS_ART[encounter.bossId];
  const introElapsed = Math.max(0, nowMs - encounter.enteredAtMs);
  if (encounter.state === "ROOM_ENTERED" || encounter.state === "INTRO_LOCK") {
    const progress = Math.min(0.999, introElapsed / Math.max(1, encounter.introDurationMs));
    return { ...art, frame: Math.min(3, Math.floor(progress * 4)), restored: false };
  }
  if (encounter.state === "AWAKENING") {
    const progress = Math.min(0.999, (nowMs - encounter.stateAtMs) / Math.max(1, encounter.introDurationMs - (encounter.stateAtMs - encounter.enteredAtMs)));
    return { ...art, frame: 4 + Math.min(3, Math.floor(progress * 4)), restored: false };
  }
  if (encounter.state === "COMBAT") {
    const cadence = Math.floor(nowMs / 180);
    const frame = cadence % 7 < 3 ? 8 + cadence % 4 : cadence % 4;
    return { ...art, frame, restored: false };
  }
  if (encounter.state === "DEFEATED") return { ...art, frame: 18, restored: false };
  if (encounter.state === "PURIFICATION") {
    const progress = Math.max(0, Math.min(1, (nowMs - encounter.stateAtMs) / 6400));
    const frames = [19, 18, 17, 16, 3, 2, 1, 0] as const;
    return { ...art, frame: frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))], restored: progress > 0.72 };
  }
  return { ...art, frame: 0, restored: true };
}
