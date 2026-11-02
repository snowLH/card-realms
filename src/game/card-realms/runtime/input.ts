import { BOARD_LANES, type LaneIndex, type PlayerSide } from "../domain/types";
import { getKingdomHeartCoordinates, getLaneBoardCoordinates } from "./camera";

export type BoardPointerTarget =
  | {
      kind: "lane-slot";
      side: PlayerSide;
      lane: LaneIndex;
    }
  | {
      kind: "kingdom-heart";
      side: PlayerSide;
    };

/**
 * Pure hit-test resolver for pointer interaction on the 960x540 tilted 2.5D board.
 */
export function resolveBoardPointerTarget(
  x: number,
  y: number,
): BoardPointerTarget | null {
  const sides: readonly PlayerSide[] = ["player", "opponent"];

  // 1. Check Kingdom Hearts first
  for (const side of sides) {
    const heart = getKingdomHeartCoordinates(side);
    const dx = Math.abs(x - heart.x);
    const dy = Math.abs(y - heart.y);
    if (dx <= 105 * heart.scale && dy <= 34 * heart.scale) {
      return { kind: "kingdom-heart", side };
    }
  }

  // 2. Check the 8 Territory Lanes
  for (const side of sides) {
    for (const lane of BOARD_LANES) {
      const coords = getLaneBoardCoordinates(side, lane);
      const halfW = coords.tileWidth * 0.54;
      const halfH = coords.tileHeight * 0.56;
      if (
        Math.abs(x - coords.centerX) <= halfW &&
        Math.abs(y - coords.centerY) <= halfH
      ) {
        return { kind: "lane-slot", side, lane };
      }
    }
  }

  return null;
}
