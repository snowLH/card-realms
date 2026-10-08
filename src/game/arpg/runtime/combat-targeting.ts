/** Renderer-independent targeting, used by both touch and desktop combat. */
export type CombatPoint = Readonly<{ x: number; y: number }>;
export type TargetOptions<T> = Readonly<{
  maxDistance?: number;
  available: (target: T) => boolean;
  visible: (target: T) => boolean;
}>;

export function selectNearestTarget<T extends CombatPoint>(
  origin: CombatPoint,
  targets: readonly T[],
  { maxDistance = Number.POSITIVE_INFINITY, available, visible }: TargetOptions<T>,
): T | null {
  let closest: T | null = null;
  let closestSq = maxDistance * maxDistance;
  for (const candidate of targets) {
    if (!available(candidate)) continue;
    const dx = candidate.x - origin.x;
    const dy = candidate.y - origin.y;
    const distanceSq = dx * dx + dy * dy;
    if (!Number.isFinite(distanceSq) || distanceSq > closestSq || !visible(candidate)) continue;
    if (distanceSq < closestSq) {
      closest = candidate;
      closestSq = distanceSq;
    }
  }
  return closest;
}

/** Keeps an existing auto-aim target until another visible target is meaningfully closer.
 * This prevents the reticle from flickering between enemies whose distances differ by only
 * a few pixels while the player is moving. */
export function selectStableTarget<T extends CombatPoint>(
  origin: CombatPoint,
  targets: readonly T[],
  preferred: T | null,
  options: TargetOptions<T> & Readonly<{ switchRatio?: number }>,
): T | null {
  const { switchRatio = 0.82, ...targetOptions } = options;
  const nearest = selectNearestTarget(origin, targets, targetOptions);
  if (!preferred || !targets.includes(preferred)) return nearest;
  if (!targetOptions.available(preferred) || !targetOptions.visible(preferred)) return nearest;

  const dx = preferred.x - origin.x;
  const dy = preferred.y - origin.y;
  const preferredDistanceSq = dx * dx + dy * dy;
  const maxDistance = targetOptions.maxDistance ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(preferredDistanceSq) || preferredDistanceSq > maxDistance * maxDistance) return nearest;
  if (!nearest || nearest === preferred) return preferred;

  const nx = nearest.x - origin.x;
  const ny = nearest.y - origin.y;
  const nearestDistanceSq = nx * nx + ny * ny;
  const clampedRatio = Math.min(0.99, Math.max(0.1, switchRatio));
  return nearestDistanceSq < preferredDistanceSq * clampedRatio * clampedRatio ? nearest : preferred;
}

function normalized(vector: CombatPoint | null): CombatPoint | null {
  if (!vector || !Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return null;
  const length = Math.hypot(vector.x, vector.y);
  return length > 0.0001 ? { x: vector.x / length, y: vector.y / length } : null;
}

/** Manual analog aim wins over auto-lock; free mouse aims precisely on desktop. */
export function resolveCombatDirection(input: Readonly<{
  gamepad: CombatPoint;
  touch: CombatPoint;
  autoAim: boolean;
  player: CombatPoint;
  target: CombatPoint | null;
  pointer: CombatPoint | null;
  previous: CombatPoint;
}>): CombatPoint {
  if (Math.hypot(input.gamepad.x, input.gamepad.y) > 0.1) {
    const aim = normalized(input.gamepad);
    if (aim) return aim;
  }
  if (Math.hypot(input.touch.x, input.touch.y) > 0.1) {
    const aim = normalized(input.touch);
    if (aim) return aim;
  }
  if (input.autoAim) {
    const targetAim = input.target ? normalized({ x: input.target.x - input.player.x, y: input.target.y - input.player.y }) : null;
    return targetAim ?? normalized(input.previous) ?? { x: 1, y: 0 };
  }
  const mouseAim = input.pointer ? normalized({ x: input.pointer.x - input.player.x, y: input.pointer.y - input.player.y }) : null;
  return mouseAim ?? normalized(input.previous) ?? { x: 1, y: 0 };
}
