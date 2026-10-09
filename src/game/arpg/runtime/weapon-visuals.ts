import type { WeaponKind } from "../domain/types";

export type WeaponVisualMotion = "swing" | "recoil" | "cast";
export type WeaponVisualDesign =
  | "iron-straight"
  | "forest-longbow"
  | "ritual-orb"
  | "thorn-guardian"
  | "tide-wave"
  | "river-recurve"
  | "iara-song"
  | "coral-ward"
  | "runic-sabre"
  | "alicanto-mineral"
  | "raiju-thunder"
  | "frostfall-greatsword";

export type WeaponVisualDefinition = Readonly<{
  id: string;
  textureKey: string;
  design: WeaponVisualDesign;
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
    textureKey: "arpg-weapon-iron-sword",
    design: "iron-straight",
    motion: "swing",
    displayScale: 1.16,
    motionDurationMs: 175,
    motionIntensity: 0.92,
    holdDistanceOffset: 0,
    idleBob: 0.7,
  },
  {
    id: "forest-bow",
    textureKey: "arpg-weapon-forest-bow",
    design: "forest-longbow",
    motion: "recoil",
    displayScale: 1.12,
    motionDurationMs: 150,
    motionIntensity: 0.82,
    holdDistanceOffset: 2,
    idleBob: 0.85,
  },
  {
    id: "ritual-staff",
    textureKey: "arpg-weapon-ritual-staff",
    design: "ritual-orb",
    motion: "cast",
    displayScale: 1.18,
    motionDurationMs: 230,
    motionIntensity: 0.88,
    holdDistanceOffset: 2,
    idleBob: 1.05,
  },
  {
    id: "thorn-guard-blade",
    textureKey: "arpg-weapon-thorn-guard-blade",
    design: "thorn-guardian",
    motion: "swing",
    displayScale: 1.22,
    motionDurationMs: 205,
    motionIntensity: 1.08,
    holdDistanceOffset: 2,
    idleBob: 0.65,
  },
  {
    id: "tide-blade",
    textureKey: "arpg-weapon-tide-blade",
    design: "tide-wave",
    motion: "swing",
    displayScale: 1.18,
    motionDurationMs: 170,
    motionIntensity: 0.98,
    holdDistanceOffset: 1,
    idleBob: 0.9,
  },
  {
    id: "river-bow",
    textureKey: "arpg-weapon-river-bow",
    design: "river-recurve",
    motion: "recoil",
    displayScale: 1.13,
    motionDurationMs: 145,
    motionIntensity: 0.9,
    holdDistanceOffset: 3,
    idleBob: 0.9,
  },
  {
    id: "iara-song-staff",
    textureKey: "arpg-weapon-iara-song-staff",
    design: "iara-song",
    motion: "cast",
    displayScale: 1.21,
    motionDurationMs: 245,
    motionIntensity: 1,
    holdDistanceOffset: 3,
    idleBob: 1.15,
  },
  {
    id: "coral-ward-bow",
    textureKey: "arpg-weapon-coral-ward-bow",
    design: "coral-ward",
    motion: "recoil",
    displayScale: 1.16,
    motionDurationMs: 165,
    motionIntensity: 1,
    holdDistanceOffset: 4,
    idleBob: 0.95,
  },
  {
    id: "runic-sabre",
    textureKey: "arpg-weapon-runic-sabre",
    design: "runic-sabre",
    motion: "swing",
    displayScale: 1.17,
    motionDurationMs: 165,
    motionIntensity: 0.94,
    holdDistanceOffset: 1,
    idleBob: 0.8,
  },
  {
    id: "alicanto-bow",
    textureKey: "arpg-weapon-alicanto-bow",
    design: "alicanto-mineral",
    motion: "recoil",
    displayScale: 1.14,
    motionDurationMs: 150,
    motionIntensity: 0.92,
    holdDistanceOffset: 3,
    idleBob: 0.95,
  },
  {
    id: "raiju-staff",
    textureKey: "arpg-weapon-raiju-staff",
    design: "raiju-thunder",
    motion: "cast",
    displayScale: 1.23,
    motionDurationMs: 220,
    motionIntensity: 1.08,
    holdDistanceOffset: 4,
    idleBob: 1.2,
  },
  {
    id: "frostfall-sword",
    textureKey: "arpg-weapon-frostfall-sword",
    design: "frostfall-greatsword",
    motion: "swing",
    displayScale: 1.28,
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
