type RecyclableProjectile = {
  body?: { enable: boolean } | null;
  setActive(active: boolean): unknown;
  setVisible(visible: boolean): unknown;
  setVelocity(x: number, y: number): unknown;
};

/** Overlap callbacks may still reference the final projectile after a boss hit.
 * Disable pooled bodies without destroying them during the physics iteration.
 */
export function recycleArcadeProjectile(projectile: RecyclableProjectile) {
  if (!projectile.body) return false;
  projectile.setVelocity(0, 0);
  projectile.setActive(false);
  projectile.setVisible(false);
  projectile.body.enable = false;
  return true;
}
export function clearProjectilePool(projectiles: readonly RecyclableProjectile[]) {
  for (const projectile of projectiles) recycleArcadeProjectile(projectile);
}
