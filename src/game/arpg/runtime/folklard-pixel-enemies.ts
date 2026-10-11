/** Asset identity only. Original offline studies live under scripts/art-archive. */
export const FOLKLARD_PIXEL_ENEMIES = ["shade", "thorn", "corrupted-guardian", "mapinguari"] as const;
export type FolklardPixelEnemyId = typeof FOLKLARD_PIXEL_ENEMIES[number];
export function getOriginalPixelEnemyId(profile: string): FolklardPixelEnemyId | null {
  return FOLKLARD_PIXEL_ENEMIES.find((enemy) => `${enemy}-enemy` === profile) ?? null;
}
