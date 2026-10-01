import type { RaidEventDefinition } from "./types";

export const FIRST_MYTHIC_RAID_EVENT: RaidEventDefinition = {
  slug: "raid-roc-2026-10-03",
  title: "Roc — O Céu Desaparece",
  bossCreatureId: "roc",
  startsAt: "2026-10-03T13:00:00.000Z",
  endsAt: "2026-10-04T05:00:00.000Z",
  presentationTimezone: "America/Sao_Paulo",
  minPlayers: 2,
  maxPlayers: 5,
  recommendedLevel: 30,
  boss: {
    catalogId: "roc",
    maxHp: 10000,
    speed: 62,
    maxRounds: 30,
  },
};

export const RAID_PHASE_NAMES = {
  1: "Asas Sobre o Horizonte",
  2: "O Sol Desaparece",
  3: "Tempestade do Roc",
} as const;

export const RAID_BOSS_ATTACKS = {
  1: {
    id: "talon-sweep",
    name: "Varredura de Garras",
    damage: 42,
    target: "single" as const,
  },
  2: {
    id: "sun-shadow",
    name: "Sombra do Sol",
    damage: 24,
    target: "all" as const,
  },
  3: {
    id: "horizon-storm",
    name: "Tempestade do Horizonte",
    damage: 34,
    target: "all" as const,
  },
} as const;
