import type { WeaponKind } from "../domain/types";

export type FloatingWeaponPoint = Readonly<{ x: number; y: number }>;

export type FloatingWeaponPose = Readonly<{
  x: number;
  y: number;
  direction: FloatingWeaponPoint;
}>;

function normalizedDirection(direction: FloatingWeaponPoint) {
  const length = Math.hypot(direction.x, direction.y);
  return length > 0.001
    ? { x: direction.x / length, y: direction.y / length }
    : { x: 1, y: 0 };
}

/**
 * Keeps the equipped weapon visually independent from the Legend's body.
 * A nearby opponent always wins over free aiming so the player can read the
 * target at a glance, as in twin-stick pixel action games.
 */
export function getFloatingWeaponPose({
  player,
  target,
  fallbackDirection,
  distance = 42,
}: {
  player: FloatingWeaponPoint;
  target: FloatingWeaponPoint | null;
  fallbackDirection: FloatingWeaponPoint;
  distance?: number;
}): FloatingWeaponPose {
  const direction = normalizedDirection(target
    ? { x: target.x - player.x, y: target.y - player.y }
    : fallbackDirection);

  return {
    x: Math.round(player.x + direction.x * distance),
    y: Math.round(player.y + direction.y * distance - 6),
    direction,
  };
}

export function getFloatingWeaponReach(kind: WeaponKind) {
  return kind === "sword" ? 38 : kind === "bow" ? 46 : 43;
}
