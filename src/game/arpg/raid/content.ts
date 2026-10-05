import type { ArpgRaidBossSetup } from "./types";

export const ARPG_ROC_RAID_BOSS: ArpgRaidBossSetup = {
  catalogId: "roc",
  maxHp: 10_000,
  speed: 92,
  maxDurationMs: 6 * 60_000,
};

export const ARPG_ROC_RAID_META = {
  slug: "raid-roc-2026-10-03",
  title: "Roc — O Céu Desaparece",
  arena: "/art/raid-roc-arena.png",
  minPlayers: 2,
  maxPlayers: 5,
  presentationTimezone: "America/Sao_Paulo",
} as const;
