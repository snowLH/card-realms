import type { Scene } from "phaser";
import { FX_ART, WORLD_ART } from "@/game/arpg/art/manifest";
import { authoredImage, AuthoredEffectLayer } from "@/game/arpg/art/runtime-art";
import type { Element } from "@/game/types";
import { getTerritoryBiome } from "../domain/territories";
import {
  BOARD_LANES,
  type LaneIndex,
  type MatchState,
  type PlayerSide,
  type TerritoryBiomeId,
} from "../domain/types";
import { getLaneBoardCoordinates } from "./camera";

export function getElementFxConfig(element: Element) {
  switch (element) {
    case "nature":
      return {
        projectileFrame: WORLD_ART.arrow,
        impactFrame: FX_ART.rootZone,
        auraFrame: FX_ART.rootZone,
        particleFrame: FX_ART.leaf,
      };
    case "water":
      return {
        projectileFrame: WORLD_ART.wave,
        impactFrame: FX_ART.waterImpact,
        auraFrame: FX_ART.waterZone,
        particleFrame: FX_ART.waterDrop,
      };
    case "fire":
      return {
        projectileFrame: WORLD_ART.fire,
        impactFrame: FX_ART.corruptedImpact,
        auraFrame: FX_ART.corruptionBurst,
        particleFrame: FX_ART.ember,
      };
    case "storm":
      return {
        projectileFrame: WORLD_ART.lightning,
        impactFrame: FX_ART.lightningImpact,
        auraFrame: FX_ART.purificationRing,
        particleFrame: FX_ART.lightningFragment,
      };
    case "spirit":
    default:
      return {
        projectileFrame: WORLD_ART.magic,
        impactFrame: FX_ART.magicImpact,
        auraFrame: FX_ART.purificationRing,
        particleFrame: FX_ART.magicStar,
      };
  }
}

export function spawnElementalBurst(
  scene: Scene,
  x: number,
  y: number,
  element: Element,
  radius = 48,
  reducedMotion = false,
) {
  const fx = getElementFxConfig(element);
  const ring = authoredImage(scene, x, y, "fx", fx.auraFrame, radius * 1.9).setDepth(38);
  const targetScale = ring.scaleX;

  scene.tweens.add({
    targets: ring,
    scale: { from: targetScale * (reducedMotion ? 1 : 0.45), to: targetScale * 1.15 },
    alpha: { from: 0.92, to: 0 },
    duration: 460,
    ease: "Quad.easeOut",
    onComplete: () => ring.destroy(),
  });

  if (reducedMotion) return;

  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    const particle = authoredImage(scene, x, y, "fx", fx.particleFrame, 18).setDepth(39);
    scene.tweens.add({
      targets: particle,
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius * 0.75 - 10,
      alpha: { from: 1, to: 0 },
      rotation: angle * 0.5,
      duration: 520,
      ease: "Sine.easeOut",
      onComplete: () => particle.destroy(),
    });
  }
}

export function spawnFloatingBannerText(
  scene: Scene,
  x: number,
  y: number,
  label: string,
  color = "#fff2c6",
  durationMs = 950,
) {
  const textObj = scene.add
    .text(x, y, label, {
      fontFamily: "monospace",
      fontSize: "13px",
      fontStyle: "bold",
      color,
    })
    .setOrigin(0.5)
    .setDepth(55);

  scene.tweens.add({
    targets: textObj,
    y: y - 28,
    alpha: { from: 1, to: 0 },
    duration: durationMs,
    ease: "Cubic.easeOut",
    onComplete: () => textObj.destroy(),
  });
}

/**
 * Maintains the living ambient atmosphere over all 8 territory slots on the board:
 * drifting leaves in Mata Encantada, water droplets in Rio dos Espíritos, rising embers in Terra Vulcânica,
 * snowflakes in Reino Congelado, mystic stars in Reino Espiritual, etc.
 */
export class LivingBoardAmbientController {
  private readonly layer: AuthoredEffectLayer;

  constructor(scene: Scene) {
    this.layer = new AuthoredEffectLayer(scene, 24);
  }

  update(state: MatchState | null, nowMs: number, reducedMotion = false) {
    this.layer.begin();
    if (!state) {
      this.layer.end();
      return;
    }

    const sides: readonly PlayerSide[] = ["opponent", "player"];
    this.renderTorchHalos(nowMs, reducedMotion);

    for (const side of sides) {
      for (const lane of BOARD_LANES) {
        const slot = state.lanes[side][lane];
        this.renderSlotAmbience(side, lane, slot.biomeId, nowMs, reducedMotion);
      }
    }

    this.layer.end();
  }

  private renderTorchHalos(nowMs: number, reducedMotion: boolean) {
    const torchPositions = [
      { id: "torch-tl", x: 62, y: 92, frame: FX_ART.wardIdle, tint: 0xffaa55, size: 58 },
      { id: "torch-tr", x: 898, y: 92, frame: FX_ART.wardIdle, tint: 0xffaa55, size: 58 },
      { id: "lantern-bl", x: 56, y: 448, frame: FX_ART.wardAppear, tint: 0x88ccff, size: 52 },
      { id: "lantern-br", x: 904, y: 448, frame: FX_ART.wardAppear, tint: 0x88ccff, size: 52 },
    ];

    torchPositions.forEach((torch, idx) => {
      const flicker = reducedMotion ? 0.35 : 0.35 + 0.14 * Math.sin(nowMs * 0.005 + idx * 1.7);
      const scale = reducedMotion ? 1 : 0.95 + 0.08 * Math.cos(nowMs * 0.004 + idx * 2.1);
      this.layer
        .image(
          torch.id,
          "fx",
          torch.frame,
          torch.x,
          torch.y - 6,
          torch.size * scale,
          torch.size * scale,
          flicker,
        )
        .setTint(torch.tint);
    });
  }

  private renderSlotAmbience(
    side: PlayerSide,
    lane: LaneIndex,
    biomeId: TerritoryBiomeId,
    nowMs: number,
    reducedMotion: boolean,
  ) {
    const coords = getLaneBoardCoordinates(side, lane);
    const biome = getTerritoryBiome(biomeId);
    const phaseBase = (lane * 1.3 + (side === "player" ? 0 : 2.1)) + nowMs * 0.0018;

    // 1. Primary ambient drifting particles
    for (let i = 0; i < 2; i += 1) {
      const p = phaseBase + i * Math.PI;
      const offsetX = reducedMotion ? (i === 0 ? -34 : 34) : Math.sin(p) * 44;
      const offsetY = reducedMotion ? (i === 0 ? -18 : 14) : Math.cos(p * 0.85) * 24;
      const alpha = reducedMotion ? 0.55 : 0.38 + 0.28 * Math.sin(p * 1.4);

      this.layer.image(
        `ambient-${side}-${lane}-${i}`,
        "fx",
        biome.visual.ambientFxFrame,
        coords.centerX + offsetX,
        coords.centerY + offsetY,
        16,
        16,
        alpha,
      );
    }

    // 2. Secondary elemental accent
    if (!reducedMotion) {
      const p2 = phaseBase * 1.3 + lane;
      const offsetX2 = Math.cos(p2) * 36;
      const offsetY2 = Math.sin(p2 * 0.9) * 18 - 8;
      const alpha2 = 0.26 + 0.22 * Math.sin(p2 * 1.7);
      const secondaryFrame =
        biome.element === "fire"
          ? FX_ART.spark
          : biome.element === "water"
            ? FX_ART.waterDrop
            : biome.element === "nature"
              ? FX_ART.leaf
              : biome.element === "storm"
                ? FX_ART.lightningFragment
                : FX_ART.magicStar;

      this.layer.image(
        `ambient-accent-${side}-${lane}`,
        "fx",
        secondaryFrame,
        coords.centerX + offsetX2,
        coords.centerY + offsetY2,
        14,
        14,
        alpha2,
      );
    }
  }

  renderPreviewGhost(
    side: PlayerSide,
    lane: LaneIndex,
    element: Element,
    nowMs: number,
    reducedMotion: boolean,
  ) {
    const coords = getLaneBoardCoordinates(side, lane);
    const pulse = reducedMotion ? 0.8 : 0.65 + 0.25 * Math.sin(nowMs * 0.007);
    const scale = reducedMotion ? 1.05 : 1.0 + 0.08 * Math.cos(nowMs * 0.007);
    const fx = getElementFxConfig(element);

    // Glowing preview halo on the targeted pedestal
    this.layer
      .image(
        `preview-halo-${side}-${lane}`,
        "fx",
        fx.auraFrame,
        coords.centerX,
        coords.centerY,
        coords.tileWidth * 0.92 * scale,
        coords.tileHeight * 0.92 * scale,
        pulse,
      )
      .setTint(0xffe888);

    // Target lock marker above the pedestal
    this.layer.image(
      `preview-marker-${side}-${lane}`,
      "fx",
      FX_ART.crosshairLocked,
      coords.creatureX,
      coords.creatureY - 14,
      36 * coords.perspectiveScale,
      36 * coords.perspectiveScale,
      0.95,
    );
  }

  destroy() {
    this.layer.destroy();
  }
}
