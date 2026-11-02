import { getCulture } from "../domain/cultures";
import type {
  CultureId,
  LaneIndex,
  MatchLogEntry,
  MatchState,
  PlayerSide,
  TerritoryBiomeId,
  TerritorySlotState,
} from "../domain/types";

export function createTerritorySlot(
  owner: PlayerSide,
  lane: LaneIndex,
  biomeId: TerritoryBiomeId,
): TerritorySlotState {
  return {
    owner,
    lane,
    biomeId,
    creature: null,
    structure: null,
    turnModified: 0,
  };
}

export function createInitialBoardLanes(
  playerCulture: CultureId,
  opponentCulture: CultureId,
): MatchState["lanes"] {
  const playerBiomes = getCulture(playerCulture).startingBiomes;
  const opponentBiomes = getCulture(opponentCulture).startingBiomes;

  return {
    player: [
      createTerritorySlot("player", 0, playerBiomes[0]),
      createTerritorySlot("player", 1, playerBiomes[1]),
      createTerritorySlot("player", 2, playerBiomes[2]),
      createTerritorySlot("player", 3, playerBiomes[3]),
    ],
    opponent: [
      createTerritorySlot("opponent", 0, opponentBiomes[0]),
      createTerritorySlot("opponent", 1, opponentBiomes[1]),
      createTerritorySlot("opponent", 2, opponentBiomes[2]),
      createTerritorySlot("opponent", 3, opponentBiomes[3]),
    ],
  };
}

export function getLaneSlot(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
): TerritorySlotState {
  return state.lanes[side][lane];
}

export function updateLaneSlot(
  state: MatchState,
  side: PlayerSide,
  lane: LaneIndex,
  updater: (slot: TerritorySlotState) => TerritorySlotState,
): MatchState {
  const currentSideLanes = [...state.lanes[side]] as [
    TerritorySlotState,
    TerritorySlotState,
    TerritorySlotState,
    TerritorySlotState,
  ];
  currentSideLanes[lane] = updater(currentSideLanes[lane]);

  return {
    ...state,
    lanes: {
      ...state.lanes,
      [side]: currentSideLanes,
    },
  };
}

export function getAdjacentLanes(lane: LaneIndex): LaneIndex[] {
  if (lane === 0) return [1];
  if (lane === 1) return [0, 2];
  if (lane === 2) return [1, 3];
  return [2];
}

export function appendMatchLog(
  state: MatchState,
  entry: Omit<MatchLogEntry, "id" | "turn">,
): MatchState {
  const nextEntry: MatchLogEntry = {
    id: `log-${state.turn}-${state.log.length + 1}`,
    turn: state.turn,
    ...entry,
  };
  return {
    ...state,
    log: [nextEntry, ...state.log].slice(0, 40),
  };
}
