import type { WeaponKind } from "../domain/types";
import { ARPG_ASSET_MANIFEST } from "../assets";

export type WeaponVisualMotion = "swing" | "recoil" | "cast";
/** One frame from Bennyboi_hack's original CC0 16x16 pixel-art sheet. */
const EXTERNAL_WEAPON_SHEET = ARPG_ASSET_MANIFEST.weapons.bennyboiHack;

export type WeaponVisualDefinition = Readonly<{
  id: string;
  textureKey: string;
  frame: number;
  originX: number;
  originY: number;
  baseRotation: number;
  tint: number;
  motion: WeaponVisualMotion;
  displayScale: number;
  motionDurationMs: number;
  motionIntensity: number;
  holdDistanceOffset: number;
  idleBob: number;
}>;

export type WeaponMotionFrame = Readonly<{
  angleOffset: number;
  distanceOffset: number;
  sideOffset: number;
  scaleMultiplier: number;
  alpha: number;
}>;

const neutralMotion: WeaponMotionFrame = {
  angleOffset: 0,
  distanceOffset: 0,
  sideOffset: 0,
  scaleMultiplier: 1,
  alpha: 1,
};

export const ARPG_WEAPON_VISUALS: readonly WeaponVisualDefinition[] = [
  {
    id: "iron-sword",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 26,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0xffffff,
    motion: "swing",
    displayScale: 2.20,
    motionDurationMs: 175,
    motionIntensity: 0.92,
    holdDistanceOffset: 0,
    idleBob: 0.7,
  },
  {
    id: "forest-bow",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 12,
    originX: 0.5,
    originY: 0.5,
    baseRotation: 0,
    tint: 0xb9e89a,
    motion: "recoil",
    displayScale: 2.10,
    motionDurationMs: 150,
    motionIntensity: 0.82,
    holdDistanceOffset: 2,
    idleBob: 0.85,
  },
  {
    id: "ritual-staff",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 7,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0xc9b0f4,
    motion: "cast",
    displayScale: 2.20,
    motionDurationMs: 230,
    motionIntensity: 0.88,
    holdDistanceOffset: 2,
    idleBob: 1.05,
  },
  {
    id: "thorn-guard-blade",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 47,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0x9ed68b,
    motion: "swing",
    displayScale: 2.32,
    motionDurationMs: 205,
    motionIntensity: 1.08,
    holdDistanceOffset: 2,
    idleBob: 0.65,
  },
  {
    id: "tide-blade",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 25,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0x8be2ed,
    motion: "swing",
    displayScale: 2.22,
    motionDurationMs: 170,
    motionIntensity: 0.98,
    holdDistanceOffset: 1,
    idleBob: 0.9,
  },
  {
    id: "river-bow",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 32,
    originX: 0.5,
    originY: 0.5,
    baseRotation: 0,
    tint: 0xa0e6ed,
    motion: "recoil",
    displayScale: 2.12,
    motionDurationMs: 145,
    motionIntensity: 0.9,
    holdDistanceOffset: 3,
    idleBob: 0.9,
  },
  {
    id: "iara-song-staff",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 63,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0x8eead9,
    motion: "cast",
    displayScale: 2.28,
    motionDurationMs: 245,
    motionIntensity: 1,
    holdDistanceOffset: 3,
    idleBob: 1.15,
  },
  {
    id: "coral-ward-bow",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 12,
    originX: 0.5,
    originY: 0.5,
    baseRotation: 0,
    tint: 0xf3ac99,
    motion: "recoil",
    displayScale: 2.18,
    motionDurationMs: 165,
    motionIntensity: 1,
    holdDistanceOffset: 4,
    idleBob: 0.95,
  },
  {
    id: "runic-sabre",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 45,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0xabc9ff,
    motion: "swing",
    displayScale: 2.20,
    motionDurationMs: 165,
    motionIntensity: 0.94,
    holdDistanceOffset: 1,
    idleBob: 0.8,
  },
  {
    id: "alicanto-bow",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 32,
    originX: 0.5,
    originY: 0.5,
    baseRotation: 0,
    tint: 0xf5da88,
    motion: "recoil",
    displayScale: 2.14,
    motionDurationMs: 150,
    motionIntensity: 0.92,
    holdDistanceOffset: 3,
    idleBob: 0.95,
  },
  {
    id: "raiju-staff",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 67,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0xffec8d,
    motion: "cast",
    displayScale: 2.30,
    motionDurationMs: 220,
    motionIntensity: 1.08,
    holdDistanceOffset: 4,
    idleBob: 1.2,
  },
  {
    id: "frostfall-sword",
    textureKey: EXTERNAL_WEAPON_SHEET.textureKey,
    frame: 21,
    originX: 0.3,
    originY: 0.7,
    baseRotation: Math.PI / 4,
    tint: 0xc5edff,
    motion: "swing",
    displayScale: 2.42,
    motionDurationMs: 240,
    motionIntensity: 1.16,
    holdDistanceOffset: 3,
    idleBob: 0.55,
  },
];

export const ARPG_WEAPON_VISUAL_BY_ID = new Map(
  ARPG_WEAPON_VISUALS.map((visual) => [visual.id, visual]),
);

export function getWeaponVisualDefinition(weaponId: string): WeaponVisualDefinition {
  const definition = ARPG_WEAPON_VISUAL_BY_ID.get(weaponId);
  if (!definition) throw new Error(`Arma ARPG sem perfil visual: ${weaponId}`);
  return definition;
}

export function getWeaponProjectileVisual(kind: WeaponKind) {
  if (kind === "bow") {
    return { textureKey: "arpg-weapon-projectile-arrow", rotateWithVelocity: true } as const;
  }
  if (kind === "staff") {
    return { textureKey: "arpg-weapon-projectile-focus", rotateWithVelocity: false } as const;
  }
  return { textureKey: "arpg-projectile", rotateWithVelocity: false } as const;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getWeaponMotionFrame(
  visual: WeaponVisualDefinition,
  elapsedMs: number,
  reducedMotion = false,
): WeaponMotionFrame {
  if (reducedMotion || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= visual.motionDurationMs) {
    return neutralMotion;
  }

  const progress = clamp01(elapsedMs / visual.motionDurationMs);
  const intensity = visual.motionIntensity;
  const pulse = Math.sin(progress * Math.PI);

  if (visual.motion === "swing") {
    const eased = 1 - Math.pow(1 - progress, 3);
    return {
      angleOffset: (-0.86 + eased * 1.58) * intensity,
      distanceOffset: pulse * 4.5 * intensity,
      sideOffset: 0,
      scaleMultiplier: 1 + pulse * 0.045,
      alpha: 1,
    };
  }

  if (visual.motion === "recoil") {
    return {
      angleOffset: Math.sin(progress * Math.PI * 2) * 0.055 * intensity,
      distanceOffset: -pulse * 8 * intensity,
      sideOffset: 0,
      scaleMultiplier: 1 + pulse * 0.035,
      alpha: 1,
    };
  }

  return {
    angleOffset: Math.sin(progress * Math.PI) * 0.16 * intensity,
    distanceOffset: pulse * 2.5 * intensity,
    sideOffset: Math.sin(progress * Math.PI * 2) * 2 * intensity,
    scaleMultiplier: 1 + pulse * 0.105,
    alpha: 0.94 + pulse * 0.06,
  };
}

export function getSnappedWeaponAngle(
  direction: Readonly<{ x: number; y: number }>,
  angleOffset = 0,
  steps = 16,
) {
  const safeSteps = Math.max(4, Math.round(steps));
  const base = Math.abs(direction.x) + Math.abs(direction.y) > 0.0001
    ? Math.atan2(direction.y, direction.x)
    : 0;
  const step = Math.PI * 2 / safeSteps;
  return Math.round((base + angleOffset) / step) * step;
}
