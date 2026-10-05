import type { RaidLogEntry, RaidState } from "./types";

export type RaidHiddenResources = Record<string, {
  energyHandCount: number;
  energyDeckCount: number;
}>;

export function visibleRaidState(state: RaidState, playerId: string) {
  const visible = structuredClone(state);
  if (!visible.players.some((player) => player.id === playerId)) {
    throw new Error("Jogador não participa desta Raid.");
  }

  const hidden: RaidHiddenResources = {};
  for (const player of visible.players) {
    if (player.id === playerId) continue;
    hidden[player.id] = {
      energyHandCount: player.side.energyHand.length,
      energyDeckCount: player.side.energyDeck.length,
    };
    player.side.energyHand = [];
    player.side.energyDeck = [];
  }
  visible.processedActionIds = [];
  return { state: visible, hidden };
}

export function visibleRaidEvents(events: readonly RaidLogEntry[]): RaidLogEntry[] {
  return events.map((event, index) => ({
    ...event,
    id: `raid-public:${event.sequence}:${index + 1}`,
  }));
}
