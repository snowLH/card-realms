import { toBattlePresentationEvents, type BattlePresentationEvent } from "./presentation-events";
import type { BattleLogEntry, BattleSide } from "./types";
import { ARPG_ABILITY_CARD_BY_ID } from "../arpg/content/ability-cards";

export type BattleAbilityArt = {
  primary: string;
  highlight: string;
  shadow: string;
  motion: "flight" | "burst" | "self";
  pixels: readonly string[];
};

/** Hand-built pixel glyphs keep every equipped power recognizable without adding creature companions. */
export const BATTLE_ABILITY_ART: Record<string, BattleAbilityArt> = {
  "ancestral-roots": {
    primary: "#795338", highlight: "#c4d879", shadow: "#3d3028", motion: "burst",
    pixels: [
      ".......2........", ".......1........", "......21........", "....2.11.2......",
      ".....1.11.1.....", "....21.11.12....", "......111.......", "..2...111...2...",
      "...1..111..1....", "....1.111.1.....", ".....21112......", "......111.......",
      ".......1........", "......212.......", ".....2...2.......", "................",
    ],
  },
  "boitata-flame": {
    primary: "#ff7839", highlight: "#ffe28b", shadow: "#8f3428", motion: "flight",
    pixels: [
      "................", "....222.........", "...2122.........", "..2121...222....",
      ".2121...2122....", ".2121...2121....", "..2121..2121....", "...2121221......",
      "......221.......", ".......12.......", "......2112......", ".....211.22.....",
      "....211...22....", ".....2....22....", "................", "................",
    ],
  },
  "saci-whirlwind": {
    primary: "#a6d9ee", highlight: "#fff4c4", shadow: "#637eaa", motion: "burst",
    pixels: [
      "................", "....1111111.....", "...122222221....", "..12.......21...",
      ".12..11111..21..", ".1..12...12..21.", "....1.....12.21.", "....12....12.21.",
      ".....122221..21.", ".......111...21.", "............12..", "...........12...",
      "..........12....", ".........12.....", "................", "................",
    ],
  },
  "iara-song": {
    primary: "#42b8d0", highlight: "#d7fff2", shadow: "#236b8d", motion: "burst",
    pixels: [
      "................", "................", "..2...........2.", ".121.........121",
      "..121.......121.", "...121.....121..", "....121...121...", ".....121.121....",
      "......12121.....", ".....121.121....", "....121...121...", "...121.....121..",
      "..121.......121.", ".121.........121", "..2...........2.", "................",
    ],
  },
  "caipora-arrow": {
    primary: "#88bd55", highlight: "#f1df9d", shadow: "#3d674b", motion: "flight",
    pixels: [
      "................", "...........2....", "..........21....", ".........211....",
      "111111111121....", "222222222221....", "111111111121....", ".........211....",
      "..........21....", "...........2....", "................", "................",
      "................", "................", "................", "................",
    ],
  },
  "kappa-splash": {
    primary: "#48b7c9", highlight: "#e2fff5", shadow: "#246e98", motion: "burst",
    pixels: [
      "....2.......2...", "...21.......12..", "...1.........1..", "..21.........12.",
      "..1.....2.....1.", ".21....212....12", ".1...2211122...1", "....211111112....",
      ".....1111111.....", "......11111......", ".......222........", "....22.....22....",
      "...21.......12...", "................", "................", "................",
    ],
  },
  "kelpie-surge": {
    primary: "#398da8", highlight: "#bcf6e8", shadow: "#20526f", motion: "flight",
    pixels: [
      ".............2..", "............21..", "...........21...", "..222.....21....",
      ".21112...221.....", "..211122211.......", "...2111112........", "....2211122.......",
      "......2211122.....", "........2211122...", "..........2211122.", ".............2211.",
      "................", "................", "................", "................",
    ],
  },
  "tengu-gust": {
    primary: "#a998d6", highlight: "#eff5ff", shadow: "#525d91", motion: "flight",
    pixels: [
      "................", "....2......2....", "...21......12...", "..2112....2112..",
      ".211112..211112.", "..211112211112..", "...2111111112...", "....21111212....",
      ".....211121.....", "......2112......", ".......12........", ".......21........",
      "......2112.......", ".....211112......", "................", "................",
    ],
  },
  "banshee-wail": {
    primary: "#c99bdc", highlight: "#fff0ff", shadow: "#67457e", motion: "burst",
    pixels: [
      "................", "....222222......", "...21.....12....", "..21.......12...",
      ".21..22222..12..", ".1..21...12..12.", ".1..1.....12.12.", ".1..1.....12.12.",
      ".1..21...12..12.", ".21..22222..12..", "..21.......12...", "...21.....12....",
      "....222222......", "................", "................", "................",
    ],
  },
  "medusa-gaze": {
    primary: "#8b79b4", highlight: "#e4ddb9", shadow: "#493f64", motion: "flight",
    pixels: [
      "......2...2.....", ".......1.1......", "..2....111....2.", "...1..21112..1...",
      "....121111121....", ".....1111111.....", "......11211......", ".......121........",
      "......11211......", ".....1111111.....", "....121111121....", "...1..21112..1...",
      "..2....111....2..", ".......1.1........", "......2...2......", "................",
    ],
  },
  "kraken-grasp": {
    primary: "#2b8790", highlight: "#b7e2a0", shadow: "#194b61", motion: "flight",
    pixels: [
      "....1......1.....", "...11......11....", "..11........11...", ".11....22....11..",
      "11....2112....11.", "1....211112....1.", ".....111111.......", ".....112211.......",
      "..11..1111..11...", "...11.1..1.11....", "....11....11.....", ".....1......1.....",
      "....11......11....", "...11........11...", "..11..........11..", "................",
    ],
  },
  "simurgh-renewal": {
    primary: "#d7b85f", highlight: "#edffe0", shadow: "#7f6641", motion: "self",
    pixels: [
      "...2........2...", "..21........12..", ".2112......2112.", "..2112....2112..",
      "...2112..2112...", "....21122112....", ".....211112......", "......2112.......",
      ".......12........", "......1212.......", "....22211222.....", ".......12........",
      ".......12........", "................", "................", "................",
    ],
  },
  "roc-horizon-storm": {
    primary: "#668cae", highlight: "#f0fdff", shadow: "#344e77", motion: "flight",
    pixels: [
      ".......2........", "......21........", ".....211........", "....2112........",
      "...2112.........", "..2112..........", ".2112222222222..", "....1222221.....",
      ".....2112.......", "......2112......", ".......2112.....", "........2112....",
      ".........2112...", "..........2112..", "...........2112.", "................",
    ],
  },
};

export type BattleAbilityCast = {
  abilityId: string;
  slot: 0 | 1;
};

/** Only accepted, server-returned ability events can start a cast presentation. */
export function resolveBattleAbilityCast(
  event: BattlePresentationEvent | null,
  side: Pick<BattleSide, "id" | "abilityIds">,
): BattleAbilityCast | null {
  if (event?.kind !== "ability" || event.actorId !== side.id || !event.abilityId) return null;
  const card = event.abilityId;
  const slot = event.abilitySlot ?? side.abilityIds.indexOf(card);
  const visualId = ARPG_ABILITY_CARD_BY_ID.get(card)?.visualEffectId ?? card;
  if ((slot !== 0 && slot !== 1) || side.abilityIds[slot] !== card || !BATTLE_ABILITY_ART[visualId]) return null;
  return { abilityId: card, slot };
}

/** Selects only newly observed opponent casts from the server-sanitized PVP log. */
export function getUnseenPvpAbilityEvents(
  log: readonly BattleLogEntry[],
  lastSeenEventId: string | null,
  viewerId: string,
) {
  const cursorIndex = lastSeenEventId === null
    ? -1
    : log.findIndex((event) => event.id === lastSeenEventId);
  const unseen = lastSeenEventId === null
    ? log
    : cursorIndex >= 0
      ? log.slice(cursorIndex + 1)
      : [];

  return toBattlePresentationEvents(unseen)
    .filter((event) => event.kind === "ability" && event.actorId !== viewerId);
}

export function pixelRowsForAbility(abilityId: string) {
  const visualId = ARPG_ABILITY_CARD_BY_ID.get(abilityId)?.visualEffectId ?? abilityId;
  return BATTLE_ABILITY_ART[visualId]?.pixels ?? null;
}
