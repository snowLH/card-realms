import type { Scene } from "phaser";
import { FX_ART, PROP_ART } from "@/game/arpg/art/manifest";
import { authoredImage, authoredPanel } from "@/game/arpg/art/runtime-art";
import { getTerritoryBiome } from "../domain/territories";
import type { MatchVisualEvent } from "../domain/types";
import type { CardRealmsAudio } from "./audio";
import {
  focusCameraOnLane,
  getKingdomHeartCoordinates,
  getLaneBoardCoordinates,
  resetBoardCamera,
  shakeCameraForImpact,
} from "./camera";
import {
  getElementFxConfig,
  spawnElementalBurst,
  spawnFloatingBannerText,
} from "./effects";

/**
 * Choreographs the 10-step Creature Summon Sequence (Section 7):
 * 1. Card flight from hand edge toward chosen territory
 * 2. Physical card lock-in on the territory pedestal
 * 3. Magic rune circle appearance (FX_ART.wardAppear / purificationRing)
 * 4. Territory environment reaction burst
 * 5. Card luminous flash (FX_ART.purificationFlash)
 * 6. Rising shadow & energy column
 * 7. Creature materialization standing upright above the card
 * 8. Entry animation bounce + floating legend callout
 * 9. Subtle camera focus on the territory
 * 10. Camera return to strategic overview
 */
export function playSummonChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "creature-summoned" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const coords = getLaneBoardCoordinates(event.side, event.lane);
  const biome = getTerritoryBiome(event.biomeId);
  const startY = event.side === "player" ? 520 : 20;

  audio?.play("summon-ritual");
  focusCameraOnLane(scene.cameras?.main, event.side, event.lane, reducedMotion);

  // Step 1 & 2: Physical card flights from hand to territory slot
  const flyingCard = authoredPanel(
    scene,
    coords.cardPedestalX,
    reducedMotion ? coords.cardPedestalY : startY,
    "panel-parchment",
    58,
    74,
  ).setDepth(42);

  scene.tweens.add({
    targets: flyingCard,
    x: coords.cardPedestalX,
    y: coords.cardPedestalY,
    scaleX: { from: 1.25, to: 1 },
    scaleY: { from: 1.25, to: 1 },
    duration: reducedMotion ? 80 : 220,
    ease: "Back.easeOut",
    onComplete: () => {
      flyingCard.destroy();

      // Step 3: Magic symbols / rune circle appear on the territory
      const runeCircle = authoredImage(
        scene,
        coords.centerX,
        coords.cardPedestalY,
        "fx",
        FX_ART.wardAppear,
        118,
        82,
      )
        .setDepth(35)
        .setAlpha(0.92);

      // Step 4: Environment reacts with biome aura & elemental particles
      spawnElementalBurst(
        scene,
        coords.creatureX,
        coords.creatureY,
        event.element,
        56,
        reducedMotion,
      );

      // Step 5 & 6: Card flash + rising energy rays & shadow
      const flash = authoredImage(
        scene,
        coords.creatureX,
        coords.creatureY,
        "fx",
        FX_ART.purificationFlash,
        96,
        96,
      ).setDepth(44);

      const rays = authoredImage(
        scene,
        coords.creatureX,
        coords.creatureY - 10,
        "fx",
        FX_ART.purificationRays,
        110,
        110,
      ).setDepth(36);

      const shadow = authoredImage(
        scene,
        coords.creatureX,
        coords.creatureY + 26,
        "props",
        PROP_ART.shadowLarge,
        54,
        22,
      ).setDepth(34);

      // Step 7 & 8: Materialize chime + floating announcement
      audio?.play("creature-materialize");
      spawnFloatingBannerText(
        scene,
        coords.creatureX,
        coords.creatureY - 34,
        `${event.creatureName.toUpperCase()} SURGE EM ${biome.shortName.toUpperCase()}!`,
        "#ffe89e",
        1250,
      );

      scene.tweens.add({
        targets: [runeCircle, flash, rays, shadow],
        alpha: { from: 0.95, to: 0 },
        scaleX: 1.18,
        scaleY: 1.18,
        duration: 540,
        ease: "Sine.easeOut",
        onComplete: () => {
          runeCircle.destroy();
          flash.destroy();
          rays.destroy();
          shadow.destroy();
          // Step 10: Return camera smoothly
          resetBoardCamera(scene.cameras?.main, reducedMotion);
        },
      });
    },
  });
}

export function playAttackChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "creature-attack" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const enemySide = event.attackerSide === "player" ? "opponent" : "player";
  const fromCoords = getLaneBoardCoordinates(event.attackerSide, event.lane);
  const toCoords = event.hitHeart
    ? getKingdomHeartCoordinates(enemySide)
    : getLaneBoardCoordinates(enemySide, event.targetLane);

  const targetX = "creatureX" in toCoords ? toCoords.creatureX : toCoords.x;
  const targetY = "creatureY" in toCoords ? toCoords.creatureY : toCoords.y;

  audio?.play("attack-clash");

  const projectile = authoredImage(
    scene,
    fromCoords.creatureX,
    fromCoords.creatureY,
    "fx",
    FX_ART.swordImpact,
    46,
    46,
  ).setDepth(48);

  scene.tweens.add({
    targets: projectile,
    x: targetX,
    y: targetY,
    duration: reducedMotion ? 90 : 210,
    ease: "Quad.easeIn",
    onComplete: () => {
      projectile.destroy();
      const impactFrame = event.blockedByVeil ? FX_ART.wardPulse : FX_ART.swordImpact;
      const impact = authoredImage(scene, targetX, targetY, "fx", impactFrame, 78, 78).setDepth(49);

      shakeCameraForImpact(scene.cameras?.main, 0.004, 140, reducedMotion);

      const label = event.blockedByVeil
        ? "ILUSÃO DESFEITA (0 DANO)"
        : event.redirectedByConfusion
          ? `CONFUSO! -${event.damage} PV`
          : `-${event.damage} PV`;

      spawnFloatingBannerText(
        scene,
        targetX,
        targetY - 22,
        label,
        event.blockedByVeil ? "#c8b6ff" : "#ff9b85",
        950,
      );

      scene.tweens.add({
        targets: impact,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0,
        duration: 280,
        onComplete: () => impact.destroy(),
      });
    },
  });
}

export function playAwakeningChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "creature-awakening" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const coords = getLaneBoardCoordinates(event.side, event.lane);
  const fx = getElementFxConfig(event.element);

  audio?.play("awakening-power");
  focusCameraOnLane(scene.cameras?.main, event.side, event.lane, reducedMotion);

  const ritualRing = authoredImage(
    scene,
    coords.creatureX,
    coords.creatureY,
    "fx",
    fx.auraFrame,
    116,
    116,
  ).setDepth(45);

  spawnElementalBurst(
    scene,
    coords.creatureX,
    coords.creatureY,
    event.element,
    64,
    reducedMotion,
  );

  spawnFloatingBannerText(
    scene,
    coords.creatureX,
    coords.creatureY - 38,
    `DESPERTAR: ${event.powerName.toUpperCase()}!`,
    "#9ef6ff",
    1300,
  );

  scene.tweens.add({
    targets: ritualRing,
    scaleX: 1.35,
    scaleY: 1.35,
    alpha: { from: 0.95, to: 0 },
    duration: 560,
    ease: "Cubic.easeOut",
    onComplete: () => {
      ritualRing.destroy();
      resetBoardCamera(scene.cameras?.main, reducedMotion);
    },
  });
}

export function playTerritoryShiftChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "territory-transformed" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const coords = getLaneBoardCoordinates(event.side, event.lane);
  const biome = getTerritoryBiome(event.nextBiomeId);

  audio?.play("territory-shift");
  spawnElementalBurst(
    scene,
    coords.centerX,
    coords.centerY,
    biome.element,
    58,
    reducedMotion,
  );
  spawnFloatingBannerText(
    scene,
    coords.centerX,
    coords.centerY - 26,
    `TERRITÓRIO: ${biome.name.toUpperCase()}`,
    "#b7f7b0",
    1100,
  );
}

export function playKingdomHeartHitChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "heart-damaged" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const heartCoords = getKingdomHeartCoordinates(event.side);
  audio?.play("heart-hit");
  shakeCameraForImpact(scene.cameras?.main, 0.007, 240, reducedMotion);

  const burst = authoredImage(
    scene,
    heartCoords.x,
    heartCoords.y,
    "fx",
    FX_ART.corruptionBurst,
    98,
    98,
  ).setDepth(50);

  spawnFloatingBannerText(
    scene,
    heartCoords.x,
    heartCoords.y - 26,
    `CORAÇÃO DO REINO -${event.damage} PV!`,
    "#ff7b7b",
    1200,
  );

  scene.tweens.add({
    targets: burst,
    scaleX: 1.35,
    scaleY: 1.35,
    alpha: 0,
    duration: 380,
    onComplete: () => burst.destroy(),
  });
}
