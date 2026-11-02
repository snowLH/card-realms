import type { Cameras } from "phaser";
import type { LaneIndex, PlayerSide } from "../domain/types";

export const CARD_REALMS_BOARD_VIEWPORT = {
  width: 960,
  height: 540,
} as const;

export type LaneBoardCoordinates = {
  lane: LaneIndex;
  side: PlayerSide;
  centerX: number;
  centerY: number;
  perspectiveScale: number;
  tileWidth: number;
  tileHeight: number;
  cardPedestalX: number;
  cardPedestalY: number;
  creatureX: number;
  creatureY: number;
  structureX: number;
  structureY: number;
  labelY: number;
};

export type KingdomHeartCoordinates = {
  side: PlayerSide;
  x: number;
  y: number;
  scale: number;
};

const OPPONENT_LANE_X: readonly [number, number, number, number] = [204, 388, 572, 756];
const PLAYER_LANE_X: readonly [number, number, number, number] = [174, 378, 582, 786];

/**
 * Computes the tilted 2.5D tabletop coordinates for any lane and side.
 * Opponent lanes sit slightly further back on the horizon (narrower spacing, 0.90 scale),
 * while player lanes sit closer in the foreground (wider spacing, 1.04 scale).
 */
export function getLaneBoardCoordinates(
  side: PlayerSide,
  lane: LaneIndex,
): LaneBoardCoordinates {
  const isPlayer = side === "player";
  const centerX = isPlayer ? PLAYER_LANE_X[lane] : OPPONENT_LANE_X[lane];
  const centerY = isPlayer ? 364 : 172;
  const perspectiveScale = isPlayer ? 1.04 : 0.9;
  const tileWidth = Math.round(164 * perspectiveScale);
  const tileHeight = Math.round(126 * perspectiveScale);

  return {
    lane,
    side,
    centerX,
    centerY,
    perspectiveScale,
    tileWidth,
    tileHeight,
    cardPedestalX: centerX + (isPlayer ? 10 : 8),
    cardPedestalY: centerY + (isPlayer ? 16 : 14),
    creatureX: centerX + (isPlayer ? 10 : 8),
    creatureY: centerY - (isPlayer ? 12 : 8),
    structureX: centerX - (isPlayer ? 54 : 48),
    structureY: centerY + (isPlayer ? 14 : -10),
    labelY: centerY + (isPlayer ? 56 : -54),
  };
}

export function getKingdomHeartCoordinates(side: PlayerSide): KingdomHeartCoordinates {
  return side === "player"
    ? { side: "player", x: 480, y: 488, scale: 1.04 }
    : { side: "opponent", x: 480, y: 54, scale: 0.92 };
}

export function focusCameraOnLane(
  camera: Cameras.Scene2D.Camera | undefined,
  side: PlayerSide,
  lane: LaneIndex,
  reducedMotion = false,
) {
  if (!camera || reducedMotion) return;
  const coords = getLaneBoardCoordinates(side, lane);
  const targetOffsetX = (coords.centerX - CARD_REALMS_BOARD_VIEWPORT.width / 2) * 0.06;
  const targetOffsetY = (coords.centerY - CARD_REALMS_BOARD_VIEWPORT.height / 2) * 0.06;
  camera.pan(
    CARD_REALMS_BOARD_VIEWPORT.width / 2 + targetOffsetX,
    CARD_REALMS_BOARD_VIEWPORT.height / 2 + targetOffsetY,
    240,
    "Sine.easeOut",
    true,
  );
  camera.zoomTo(1.035, 240, "Sine.easeOut", true);
}

export function resetBoardCamera(
  camera: Cameras.Scene2D.Camera | undefined,
  reducedMotion = false,
) {
  if (!camera) return;
  if (reducedMotion) {
    camera.setZoom(1);
    camera.centerOn(
      CARD_REALMS_BOARD_VIEWPORT.width / 2,
      CARD_REALMS_BOARD_VIEWPORT.height / 2,
    );
    return;
  }
  camera.pan(
    CARD_REALMS_BOARD_VIEWPORT.width / 2,
    CARD_REALMS_BOARD_VIEWPORT.height / 2,
    300,
    "Sine.easeInOut",
    true,
  );
  camera.zoomTo(1, 300, "Sine.easeInOut", true);
}

export function shakeCameraForImpact(
  camera: Cameras.Scene2D.Camera | undefined,
  intensity = 0.004,
  durationMs = 150,
  reducedMotion = false,
) {
  if (!camera || reducedMotion) return;
  camera.shake(durationMs, intensity);
}
