/** Shared physics tuning for local Phaser control and authoritative dungeon actions.
 * NEVER tune one side alone: movement and dash validation must stay in sync.
 */
export const ARPG_BASE_HP = 120;
export const ARPG_BASE_SPEED = 220; // pixels / second
export const ARPG_DASH_SPEED = 610; // pixels / second
export const ARPG_DASH_DURATION_MS = 170;
export const ARPG_DASH_COOLDOWN_MS = 820;
export const ARPG_DAMAGE_INVULNERABILITY_MS = 260;
