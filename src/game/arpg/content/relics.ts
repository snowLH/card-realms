import type { ArpgRelicDefinition } from "../domain/types";

export const ARPG_RELICS: readonly ArpgRelicDefinition[] = [
  {
    id: "cartographer-compass",
    name: "Bússola do Cartógrafo",
    rarity: "common",
    effect: "xp-insight",
    effectLabel: "Olhar de Explorador",
    description: "Relíquia inicial do jogo. Aumenta em 10% o XP ganho ao derrotar inimigos durante a run.",
    acquisition: { source: "starter", label: "Relíquia inicial" },
  },
  {
    id: "curupira-track-talisman",
    name: "Talismã dos Rastros",
    rarity: "rare",
    effect: "chest-renewal",
    effectLabel: "Trilha Renovadora",
    description: "Adaptação de Card Realms inspirada nos rastros invertidos do Curupira. Abrir um baú recupera 10 HP.",
    acquisition: { source: "dungeon-clear", label: "Primeira vitória na Mata Encantada" },
  },
  {
    id: "iara-shell-charm",
    name: "Concha do Encanto",
    rarity: "rare",
    effect: "attack-resonance",
    effectLabel: "Ressonância das Águas",
    description: "Adaptação de Card Realms inspirada na Iara. Reduz em 12% a recarga dos dois ataques equipados.",
    acquisition: { source: "dungeon-clear", label: "Primeira vitória no Arquipélago das Marés" },
  },
];

export const STARTER_ARPG_RELIC_ID = "cartographer-compass";
export const ARPG_RELIC_BY_ID = new Map(ARPG_RELICS.map((relic) => [relic.id, relic]));
export const ARPG_RELIC_IDS = new Set(ARPG_RELICS.map((relic) => relic.id));

export function getRelicXpMultiplier(relic: ArpgRelicDefinition) {
  return relic.effect === "xp-insight" ? 1.1 : 1;
}

export function getRelicChestHeal(relic: ArpgRelicDefinition) {
  return relic.effect === "chest-renewal" ? 10 : 0;
}
export function getRelicAbilityCooldownMs(relic: ArpgRelicDefinition, baseCooldownMs: number) {
  return relic.effect === "attack-resonance"
    ? Math.round(baseCooldownMs * 0.88)
    : baseCooldownMs;
}
