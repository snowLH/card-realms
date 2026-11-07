import type { Scene } from "phaser";
import { FX_ART, PROP_ART } from "@/game/arpg/art/manifest";
import { authoredImage, authoredPanel } from "@/game/arpg/art/runtime-art";
import { getTerritoryBiome } from "../domain/territories";
import type { MatchVisualEvent } from "../domain/types";
import type { CardRealmsAudio } from "./audio";
import {
  focusCameraOnHeart,
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

function spawnFolkloreSummonSignature(
  scene: Scene,
  cardId: string,
  x: number,
  y: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;
  let accentFrame: number = FX_ART.leaf;
  let ringFrame: number = FX_ART.purificationRing;
  let tint = 0xffffff;

  switch (cardId) {
    case "legend-curupira":
      accentFrame = FX_ART.leaf;
      ringFrame = FX_ART.forestCircleWarning;
      tint = 0x7fd878;
      break;
    case "legend-iara":
    case "legend-kappa":
      accentFrame = FX_ART.waterDrop;
      ringFrame = FX_ART.waterCircleWarning;
      tint = 0x6fd2ff;
      break;
    case "legend-boitata":
      accentFrame = FX_ART.ember;
      ringFrame = FX_ART.corruptionBurst;
      tint = 0xff7722;
      break;
    case "legend-saci":
    case "legend-tengu":
      accentFrame = FX_ART.dust;
      ringFrame = FX_ART.wardPulse;
      tint = 0xc8e8ff;
      break;
    case "legend-kitsune":
      accentFrame = FX_ART.magicStar;
      ringFrame = FX_ART.wardAppear;
      tint = 0x99eeff;
      break;
    case "legend-oni":
      accentFrame = FX_ART.corruptionSmoke;
      ringFrame = FX_ART.circleDanger;
      tint = 0xff4444;
      shakeCameraForImpact(scene.cameras?.main, 0.006, 180, reducedMotion);
      break;
    case "legend-mapinguari":
      accentFrame = FX_ART.dust;
      ringFrame = FX_ART.rootZone;
      tint = 0xa8d672;
      shakeCameraForImpact(scene.cameras?.main, 0.005, 160, reducedMotion);
      break;
    case "legend-raiju":
      accentFrame = FX_ART.lightningFragment;
      ringFrame = FX_ART.lightningImpact;
      tint = 0xffee77;
      break;
  }

  const signatureRing = authoredImage(scene, x, y + 8, "fx", ringFrame, 96, 62)
    .setDepth(37)
    .setTint(tint)
    .setAlpha(0.88);

  const leftOrb = authoredImage(scene, x - 26, y, "fx", accentFrame, 24, 24)
    .setDepth(43)
    .setTint(tint);
  const rightOrb = authoredImage(scene, x + 26, y, "fx", accentFrame, 24, 24)
    .setDepth(43)
    .setTint(tint);

  scene.tweens.add({
    targets: [signatureRing, leftOrb, rightOrb],
    y: "-=18",
    scaleX: 1.28,
    scaleY: 1.28,
    alpha: 0,
    duration: 480,
    ease: "Cubic.easeOut",
    onComplete: () => {
      signatureRing.destroy();
      leftOrb.destroy();
      rightOrb.destroy();
    },
  });
}

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

      // Step 4: Environment reacts with biome aura & elemental particles + creature signature
      spawnElementalBurst(
        scene,
        coords.creatureX,
        coords.creatureY,
        event.element,
        56,
        reducedMotion,
      );
      spawnFolkloreSummonSignature(
        scene,
        event.cardId,
        coords.creatureX,
        coords.creatureY,
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

  if (event.hitHeart) {
    focusCameraOnHeart(scene.cameras?.main, enemySide, reducedMotion);
  } else {
    focusCameraOnLane(scene.cameras?.main, enemySide, event.targetLane, reducedMotion);
  }

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

      const intensity = Math.min(0.012, 0.003 + event.damage * 0.002);
      shakeCameraForImpact(scene.cameras?.main, intensity, 160, reducedMotion);

      const relationTag =
        event.elementalRelation === "weakness"
          ? " · FRAQUEZA ELEMENTAL!"
          : event.elementalRelation === "resistance"
            ? " · RESISTÊNCIA!"
            : "";

      const label = event.blockedByVeil
        ? "ILUSÃO DESFEITA (0 DANO)"
        : event.redirectedByConfusion
          ? `CONFUSO! -${event.damage} PV${relationTag}`
          : `-${event.damage} PV${relationTag}`;

      spawnFloatingBannerText(
        scene,
        targetX,
        targetY - 22,
        label,
        event.blockedByVeil
          ? "#c8b6ff"
          : event.elementalRelation === "weakness"
            ? "#ffdf6b"
            : "#ff9b85",
        950,
      );

      scene.tweens.add({
        targets: impact,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0,
        duration: 280,
        onComplete: () => {
          impact.destroy();
          resetBoardCamera(scene.cameras?.main, reducedMotion);
        },
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

export function playCreatureDefeatedChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "creature-defeated" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const coords = getLaneBoardCoordinates(event.side, event.lane);
  audio?.play("defeat");
  shakeCameraForImpact(scene.cameras?.main, 0.003, 120, reducedMotion);

  const burst = authoredImage(
    scene,
    coords.creatureX,
    coords.creatureY,
    "fx",
    FX_ART.corruptionDissolve,
    84,
    84,
  ).setDepth(47);

  const fragments = authoredImage(
    scene,
    coords.creatureX,
    coords.creatureY - 12,
    "fx",
    FX_ART.purificationFragments,
    72,
    72,
  ).setDepth(48);

  spawnFloatingBannerText(
    scene,
    coords.creatureX,
    coords.creatureY - 28,
    `💀 ${event.creatureName.toUpperCase()} DERROTADA!`,
    "#ff8b8b",
    1200,
  );

  scene.tweens.add({
    targets: [burst, fragments],
    scaleX: 1.4,
    scaleY: 1.4,
    alpha: 0,
    y: "-=24",
    duration: 420,
    ease: "Sine.easeOut",
    onComplete: () => {
      burst.destroy();
      fragments.destroy();
    },
  });
}

export function playStructureDestroyedChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "structure-destroyed" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const coords = getLaneBoardCoordinates(event.side, event.lane);
  audio?.play("structure-destroy");
  shakeCameraForImpact(scene.cameras?.main, 0.005, 160, reducedMotion);

  const rubble = authoredImage(
    scene,
    coords.structureX,
    coords.structureY,
    "props",
    PROP_ART.rubble,
    52,
    52,
  ).setDepth(45);

  const dust = authoredImage(
    scene,
    coords.structureX,
    coords.structureY - 10,
    "fx",
    FX_ART.dust,
    64,
    48,
  ).setDepth(46);

  spawnFloatingBannerText(
    scene,
    coords.structureX,
    coords.structureY - 24,
    `🏛️ ${event.structureName.toUpperCase()} DESTRUÍDA!`,
    "#ffad7b",
    1100,
  );

  scene.tweens.add({
    targets: dust,
    alpha: 0,
    scaleX: 1.5,
    scaleY: 1.5,
    duration: 380,
    onComplete: () => dust.destroy(),
  });

  scene.tweens.add({
    targets: rubble,
    alpha: 0,
    duration: 700,
    delay: 400,
    onComplete: () => rubble.destroy(),
  });
}

export function playMatchWonChoreography(
  scene: Scene,
  event: Extract<MatchVisualEvent, { kind: "match-won" }>,
  audio: CardRealmsAudio | null,
  reducedMotion = false,
) {
  const loserSide = event.winner === "player" ? "opponent" : "player";
  const loserHeart = getKingdomHeartCoordinates(loserSide);
  const winnerHeart = getKingdomHeartCoordinates(event.winner);

  audio?.play(event.winner === "player" ? "victory" : "defeat");
  focusCameraOnHeart(scene.cameras?.main, loserSide, reducedMotion);
  shakeCameraForImpact(scene.cameras?.main, 0.009, 320, reducedMotion);

  const collapse = authoredImage(
    scene,
    loserHeart.x,
    loserHeart.y,
    "fx",
    FX_ART.corruptionBurst,
    132,
    132,
  ).setDepth(55);

  scene.tweens.add({
    targets: collapse,
    scaleX: 1.6,
    scaleY: 1.6,
    alpha: 0,
    duration: 480,
    onComplete: () => {
      collapse.destroy();
      focusCameraOnHeart(scene.cameras?.main, event.winner, reducedMotion);

      const rays = authoredImage(
        scene,
        winnerHeart.x,
        winnerHeart.y - 12,
        "fx",
        FX_ART.purificationRays,
        140,
        140,
      ).setDepth(56);

      const ring = authoredImage(
        scene,
        winnerHeart.x,
        winnerHeart.y,
        "fx",
        FX_ART.purificationRing,
        150,
        100,
      ).setDepth(55);

      spawnFloatingBannerText(
        scene,
        winnerHeart.x,
        winnerHeart.y - 42,
        `👑 VITÓRIA DE ${event.winner === "player" ? "SEU REINO" : "ADVERSÁRIO"}!`,
        "#ffe89e",
        2400,
      );

      scene.tweens.add({
        targets: [rays, ring],
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 800,
        ease: "Sine.easeOut",
        onComplete: () => {
          rays.destroy();
          ring.destroy();
          resetBoardCamera(scene.cameras?.main, reducedMotion);
        },
      });
    },
  });
}
