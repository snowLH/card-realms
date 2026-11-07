import type { GameObjects } from "phaser";
import {
  DUNGEON_ART,
  FOLKLARD_ART_MANIFEST,
  FX_ART,
  PROP_ART,
  UI_ART,
} from "@/game/arpg/art/manifest";
import { AuthoredHealthBar } from "@/game/arpg/art/health-bar";
import {
  authoredImage,
  authoredPanel,
   AuthoredEffectLayer,
  queueAuthoredArt,
} from "@/game/arpg/art/runtime-art";
import {
  GENERATED_SPRITE_FRAME_SIZE,
  queueGeneratedLegendSpriteSheet,
} from "@/game/arpg/runtime/legend-sprite-sheets";
import { ARPG_PIXEL_RENDER_SETTINGS } from "@/game/arpg/runtime/render-config";
import { findCardDefinition, getCardDefinition, isStructureCard } from "../domain/cards";
import {
  computeEffectiveCreatureStats,
  getCreatureCardDefinition,
} from "../domain/creatures";
import { getCulture, getKingdomHeartVisualState } from "../domain/cultures";
import { getTerritoryBiome } from "../domain/territories";
import {
  BOARD_LANES,
  type LaneIndex,
  type MatchState,
  type MatchVisualEvent,
  type PlayerSide,
} from "../domain/types";
import {
  playAttackChoreography,
  playAwakeningChoreography,
  playCreatureDefeatedChoreography,
  playKingdomHeartHitChoreography,
  playMatchWonChoreography,
  playStructureDestroyedChoreography,
  playSummonChoreography,
  playTerritoryShiftChoreography,
} from "./animations";
import type { CardRealmsAudio } from "./audio";
import type {
  CardRealmsBridge,
  HighlightedBoardLanes,
  PreviewBoardSlot,
  SelectedBoardSlot,
} from "./bridge";
import {
  CARD_REALMS_BOARD_VIEWPORT,
  applyBoardParallax,
  getKingdomHeartCoordinates,
  getLaneBoardCoordinates,
  type LaneBoardCoordinates,
} from "./camera";
import {
  LivingBoardAmbientController,
  spawnElementalBurst,
  spawnFloatingBannerText,
} from "./effects";
import { resolveBoardPointerTarget } from "./input";

const BESTIARY_SHEETS_TO_LOAD = [
  "/art/folklard-bestiary-catalog-01-v5.webp",
  "/art/folklard-bestiary-catalog-02-v5.webp",
  "/art/folklard-bestiary-catalog-06-v5.webp",
] as const;

const ANIMATED_ACTORS_TO_LOAD = [
  "curupira",
  "iara",
  "mapinguari",
  "kappa",
  "raiju",
] as const;

function bestiaryTextureKey(sheetPath: string): string {
  return `card-realms-sheet:${sheetPath}`;
}

function actorTextureKey(actorId: string): string {
  return `card-realms-actor:${actorId}`;
}

export function createCardRealmsBoardScene(
  PhaserLib: typeof import("phaser"),
  bridge: CardRealmsBridge,
  audio: CardRealmsAudio | null,
) {
  return class CardRealmsBoardScene extends PhaserLib.Scene {
    private readonly dynamicLayer = new AuthoredEffectLayer(this, 20);
    private readonly ambientController = new LivingBoardAmbientController(this);
    private readonly dynamicTexts = new Map<string, GameObjects.Text>();
    private readonly healthBars = new Map<string, AuthoredHealthBar>();
    private readonly heartBars = new Map<PlayerSide, AuthoredHealthBar>();

    private currentState: MatchState | null = null;
    private highlightedLanes: HighlightedBoardLanes = null;
    private selectedSlot: SelectedBoardSlot = null;
    private previewSlot: PreviewBoardSlot = null;
    private unsubscribers: Array<() => void> = [];
    private actorActionState = new Map<
      string,
      {
        mode: "attack" | "awakening" | "damage";
        startedAt: number;
        duration: number;
        targetX?: number;
        targetY?: number;
      }
    >();

    constructor() {
      super("card-realms-board-scene");
    }

    preload() {
      queueAuthoredArt(this, "mata-encantada");
      if (!this.textures.exists("card-realms-arena-backdrop")) {
        this.load.image("card-realms-arena-backdrop", "/art/forest-sanctuary-arena-v2.webp");
      }
      for (const biomeArt of Object.values(DUNGEON_ART)) {
        if (!this.textures.exists(biomeArt.key)) {
          this.load.spritesheet(biomeArt.key, biomeArt.path, {
            frameWidth: 32,
            frameHeight: 32,
            endFrame: 7,
          });
        }
      }

      for (const uiName of [
        "slot-empty",
        "slot-active",
        "button-normal",
        "button-hover",
        "target-marker-locked",
      ] as const) {
        const key = `folklard-ui-${uiName}`;
        if (!this.textures.exists(key)) {
          this.load.image(key, UI_ART[uiName].path);
        }
      }

      for (const actorId of ANIMATED_ACTORS_TO_LOAD) {
        queueGeneratedLegendSpriteSheet(this, actorId, actorTextureKey(actorId));
      }

      for (const sheetPath of BESTIARY_SHEETS_TO_LOAD) {
        const key = bestiaryTextureKey(sheetPath);
        if (!this.textures.exists(key)) {
          this.load.spritesheet(key, sheetPath, {
            frameWidth: GENERATED_SPRITE_FRAME_SIZE,
            frameHeight: GENERATED_SPRITE_FRAME_SIZE,
            endFrame: 15,
          });
        }
      }
    }

    create() {
      this.createStaticTabletopSurface();

      this.heartBars.set("opponent", new AuthoredHealthBar(this, 210, 16, true, [0.35, 0.7]));
      this.heartBars.set("player", new AuthoredHealthBar(this, 220, 16, true, [0.35, 0.7]));

      for (const side of ["opponent", "player"] as const) {
        for (const lane of BOARD_LANES) {
          this.healthBars.set(
            `creature-hp-${side}-${lane}`,
            new AuthoredHealthBar(this, 68, 10, false),
          );
        }
      }

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const target = resolveBoardPointerTarget(pointer.worldX, pointer.worldY);
        if (target) {
          bridge.emitBoardTargetClick(target);
        }
      });

      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        bridge.emitPointerMove(pointer.worldX, pointer.worldY);
        applyBoardParallax(this.cameras?.main, pointer.worldX, pointer.worldY, false);
      });

      this.unsubscribers.push(
        bridge.onState((nextState) => {
          this.currentState = nextState;
          this.renderBoardState();
        }),
        bridge.onHighlightedLanes((highlighted) => {
          this.highlightedLanes = highlighted;
          this.renderBoardState();
        }),
        bridge.onSelectedSlot((selected) => {
          this.selectedSlot = selected;
          this.renderBoardState();
        }),
        bridge.onPreviewSlot((prev) => {
          this.previewSlot = prev;
          this.renderBoardState();
        }),
        bridge.onVisualEvents((events) => {
          this.playVisualEvents(events);
        }),
      );

      this.events.once("shutdown", () => this.cleanup());
      this.events.once("destroy", () => this.cleanup());

      this.currentState = bridge.getState();
      this.highlightedLanes = bridge.getHighlightedLanes();
      this.selectedSlot = bridge.getSelectedSlot();
      this.previewSlot = bridge.getPreviewSlot();
      this.renderBoardState();
    }

    update(time: number) {
      this.ambientController.update(this.currentState, time, false);
      this.renderBoardState(time);
    }

    private createStaticTabletopSurface() {
      // 1. Outer Sanctuary Table Frame (carved wood/stone rim)
      authoredPanel(
        this,
        CARD_REALMS_BOARD_VIEWPORT.width / 2,
        CARD_REALMS_BOARD_VIEWPORT.height / 2,
        "panel-dark",
        950,
        532,
      ).setDepth(1);

      // 2. Four Carved Corner Rune Insets
      authoredImage(this, 30, 30, "props", PROP_ART.rubble, 36, 36).setDepth(2).setAlpha(0.7);
      authoredImage(this, 930, 30, "props", PROP_ART.rubble, 36, 36).setDepth(2).setAlpha(0.7);
      authoredImage(this, 30, 510, "props", PROP_ART.rubble, 36, 36).setDepth(2).setAlpha(0.7);
      authoredImage(this, 930, 510, "props", PROP_ART.rubble, 36, 36).setDepth(2).setAlpha(0.7);

      // 3. Inner Cartographer War Table Surface (tilted 2.5D board) + Pixel Art Arena Backdrop
      if (this.textures.exists("card-realms-arena-backdrop")) {
        this.add
          .image(CARD_REALMS_BOARD_VIEWPORT.width / 2, 268, "card-realms-arena-backdrop")
          .setDisplaySize(882, 370)
          .setDepth(2)
          .setAlpha(0.54);
      }
      authoredPanel(
        this,
        CARD_REALMS_BOARD_VIEWPORT.width / 2,
        268,
        "panel-parchment",
        882,
        370,
      )
        .setDepth(2)
        .setAlpha(0.24);

      // 4. Corner Sanctuary Braziers & Lanterns giving physical tabletop presence
      authoredImage(this, 62, 92, "props", PROP_ART.brazier, 44, 44).setDepth(4);
      authoredImage(this, 898, 92, "props", PROP_ART.brazier, 44, 44).setDepth(4);
      authoredImage(this, 56, 448, "props", PROP_ART.lantern, 48, 48).setDepth(4);
      authoredImage(this, 904, 448, "props", PROP_ART.lantern, 48, 48).setDepth(4);

      // 5. Center Conflict Frontier Line with Runes and Banners
      for (let idx = 0; idx < 7; idx += 1) {
        authoredImage(
          this,
          150 + idx * 110,
          268,
          "props",
          idx % 2 === 0 ? PROP_ART.rune : PROP_ART.banner,
          26,
          26,
        )
          .setDepth(5)
          .setAlpha(0.72);
      }

      // 6. Partition Runes along top and bottom rims for the 4 lanes
      const lanePartitions = [296, 480, 664];
      for (const px of lanePartitions) {
        authoredImage(this, px, 88, "props", PROP_ART.rune, 18, 18).setDepth(3).setAlpha(0.5);
        authoredImage(this, px, 448, "props", PROP_ART.rune, 18, 18).setDepth(3).setAlpha(0.5);
      }
    }

    private setLabel(
      id: string,
      x: number,
      y: number,
      content: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
      depth = 32,
      visible = true,
    ) {
      let label = this.dynamicTexts.get(id);
      if (!label) {
        label = this.add.text(x, y, content, style).setOrigin(0.5);
        this.dynamicTexts.set(id, label);
      } else {
        label.setPosition(x, y).setText(content).setStyle(style);
      }
      label.setDepth(depth).setVisible(visible);
      return label;
    }

    private renderBoardState(timeMs = 0) {
      this.dynamicLayer.begin();
      const state = this.currentState;
      if (!state) {
        this.dynamicLayer.end();
        return;
      }

      this.renderKingdomHeart("opponent", state);
      this.renderKingdomHeart("player", state);
      this.renderConnectedTerrainBridges(state);

      for (const side of ["opponent", "player"] as const) {
        for (const lane of BOARD_LANES) {
          this.renderTerritoryLane(side, lane, state, timeMs);
        }
      }

      this.dynamicLayer.end();
    }

    /**
     * Visually connects the 4 strategic lanes horizontally and across the central frontier
     * so the battlefield feels like a continuous natural landscape rather than isolated boxes.
     */
    private renderConnectedTerrainBridges(state: MatchState) {
      for (const side of ["opponent", "player"] as const) {
        for (let idx = 0; idx < 3; idx += 1) {
          const leftLane = idx as LaneIndex;
          const rightLane = (idx + 1) as LaneIndex;
          const leftCoords = getLaneBoardCoordinates(side, leftLane);
          const rightCoords = getLaneBoardCoordinates(side, rightLane);
          const leftBiome = getTerritoryBiome(state.lanes[side][leftLane].biomeId);
          const rightBiome = getTerritoryBiome(state.lanes[side][rightLane].biomeId);

          const midX = Math.round((leftCoords.centerX + rightCoords.centerX) / 2);
          const midY = leftCoords.centerY;
          const scale = leftCoords.perspectiveScale;

          this.dynamicLayer
            .image(
              `terrain-bridge-left-${side}-${idx}`,
              "props",
              leftBiome.visual.groundOverlayPropFrame,
              midX - 14 * scale,
              midY,
              46 * scale,
              leftCoords.tileHeight * 0.76,
              0.68,
            )
            .setTint(leftBiome.visual.tintHex);

          this.dynamicLayer
            .image(
              `terrain-bridge-right-${side}-${idx}`,
              "props",
              rightBiome.visual.groundOverlayPropFrame,
              midX + 14 * scale,
              midY,
              46 * scale,
              rightCoords.tileHeight * 0.76,
              0.68,
            )
            .setTint(rightBiome.visual.tintHex);

          this.dynamicLayer.image(
            `terrain-bridge-prop-${side}-${idx}`,
            "props",
            idx % 2 === 0 ? leftBiome.visual.tertiaryPropFrame : rightBiome.visual.secondaryPropFrame,
            midX,
            midY - 12 * scale,
            28 * scale,
            28 * scale,
            0.84,
          );
        }
      }

      // Natural crossings across the central battleline connecting Opponent and Player territories
      for (const lane of BOARD_LANES) {
        const topCoords = getLaneBoardCoordinates("opponent", lane);
        const bottomCoords = getLaneBoardCoordinates("player", lane);
        const crossX = Math.round((topCoords.centerX + bottomCoords.centerX) / 2);
        const crossY = 268;
        const playerBiome = getTerritoryBiome(state.lanes.player[lane].biomeId);

        this.dynamicLayer
          .image(
            `frontier-crossing-ground-${lane}`,
            "props",
            playerBiome.visual.groundOverlayPropFrame,
            crossX,
            crossY,
            64,
            42,
            0.62,
          )
          .setTint(playerBiome.visual.tintHex);

        this.dynamicLayer.image(
          `frontier-crossing-marker-${lane}`,
          "props",
          lane % 2 === 0 ? PROP_ART.table : PROP_ART.ruin,
          crossX,
          crossY,
          32,
          24,
          0.78,
        );
      }
    }

    private renderKingdomHeart(side: PlayerSide, state: MatchState) {
      const heart = state.players[side].heart;
      const culture = getCulture(heart.culture);
      const coords = getKingdomHeartCoordinates(side);
      const visualState = getKingdomHeartVisualState(heart);

      const propFrame =
        visualState === "intact" || visualState === "under-pressure"
          ? culture.kingdomHeart.intactPropFrame
          : visualState === "damaged" || visualState === "severely-damaged"
            ? culture.kingdomHeart.damagedPropFrame
            : visualState === "critical"
              ? culture.kingdomHeart.criticalPropFrame
              : culture.kingdomHeart.destroyedPropFrame;

      this.dynamicLayer.image(
        `heart-shadow-${side}`,
        "props",
        PROP_ART.shadowLarge,
        coords.x,
        coords.y + 16 * coords.scale,
        180 * coords.scale,
        34 * coords.scale,
        0.78,
      );

      // Central Sanctuary Citadel Monument + Left and Right Guardians
      this.dynamicLayer.image(
        `heart-monument-center-${side}`,
        "props",
        propFrame,
        coords.x,
        coords.y + (side === "opponent" ? -2 : 2),
        56 * coords.scale,
        56 * coords.scale,
        visualState === "destroyed" ? 0.85 : 0.96,
      );
      this.dynamicLayer.image(
        `heart-banner-left-${side}`,
        "props",
        PROP_ART.banner,
        coords.x - 168 * coords.scale,
        coords.y + 2 * coords.scale,
        32 * coords.scale,
        32 * coords.scale,
        0.88,
      );
      this.dynamicLayer.image(
        `heart-banner-right-${side}`,
        "props",
        PROP_ART.banner,
        coords.x + 168 * coords.scale,
        coords.y + 2 * coords.scale,
        32 * coords.scale,
        32 * coords.scale,
        0.88,
      );

      if (visualState === "destroyed") {
        this.dynamicLayer.image(
          `heart-monument-left-${side}`,
          "props",
          culture.kingdomHeart.destroyedPropFrame,
          coords.x - 132 * coords.scale,
          coords.y + 4 * coords.scale,
          44 * coords.scale,
          44 * coords.scale,
          0.9,
        );
        this.dynamicLayer.image(
          `heart-monument-right-${side}`,
          "props",
          culture.kingdomHeart.destroyedPropFrame,
          coords.x + 132 * coords.scale,
          coords.y + 4 * coords.scale,
          44 * coords.scale,
          44 * coords.scale,
          0.9,
        );
      } else {
        this.dynamicLayer.image(
          `heart-monument-left-${side}`,
          "props",
          propFrame,
          coords.x - 132 * coords.scale,
          coords.y,
          46 * coords.scale,
          46 * coords.scale,
          1,
        );
        this.dynamicLayer.image(
          `heart-monument-right-${side}`,
          "props",
          propFrame,
          coords.x + 132 * coords.scale,
          coords.y,
          46 * coords.scale,
          46 * coords.scale,
          1,
        );
      }

      // Progressive 6-Stage Destruction Visuals
      if (visualState === "intact") {
        this.dynamicLayer.image(
          `heart-fx-${side}`,
          "fx",
          FX_ART.wardIdle,
          coords.x,
          coords.y,
          96 * coords.scale,
          36 * coords.scale,
          0.4,
        );
      } else if (visualState === "under-pressure") {
        this.dynamicLayer.image(
          `heart-fx-${side}`,
          "fx",
          FX_ART.dust,
          coords.x - 132 * coords.scale,
          coords.y + 12 * coords.scale,
          28 * coords.scale,
          20 * coords.scale,
          0.65,
        );
      } else if (visualState === "damaged") {
        this.dynamicLayer.image(
          `heart-fx-${side}`,
          "fx",
          FX_ART.corruptionSmoke,
          coords.x - 132 * coords.scale,
          coords.y - 6,
          44 * coords.scale,
          44 * coords.scale,
          0.75,
        );
        this.dynamicLayer.image(
          `heart-cracks-${side}`,
          "props",
          PROP_ART.cracks,
          coords.x,
          coords.y + 10 * coords.scale,
          92 * coords.scale,
          22 * coords.scale,
          0.7,
        );
      } else if (visualState === "severely-damaged") {
        this.dynamicLayer.image(
          `heart-fx-${side}`,
          "fx",
          FX_ART.spark,
          coords.x + 132 * coords.scale,
          coords.y - 8,
          32 * coords.scale,
          32 * coords.scale,
          0.9,
        );
        this.dynamicLayer.image(
          `heart-smoke-${side}`,
          "fx",
          FX_ART.corruptionSmoke,
          coords.x - 132 * coords.scale,
          coords.y - 8,
          48 * coords.scale,
          48 * coords.scale,
          0.85,
        );
        this.dynamicLayer.image(
          `heart-cracks-${side}`,
          "props",
          PROP_ART.cracks,
          coords.x,
          coords.y + 10 * coords.scale,
          112 * coords.scale,
          26 * coords.scale,
          0.85,
        );
      } else if (visualState === "critical") {
        this.dynamicLayer.image(
          `heart-fx-${side}`,
          "fx",
          FX_ART.circleDanger,
          coords.x,
          coords.y,
          86 * coords.scale,
          46 * coords.scale,
          0.85,
        );
        this.dynamicLayer.image(
          `heart-smoke-${side}`,
          "fx",
          FX_ART.corruptionBurst,
          coords.x - 132 * coords.scale,
          coords.y - 10,
          54 * coords.scale,
          54 * coords.scale,
          0.88,
        );
        this.dynamicLayer.image(
          `heart-cracks-${side}`,
          "props",
          PROP_ART.cracks,
          coords.x,
          coords.y + 10 * coords.scale,
          130 * coords.scale,
          30 * coords.scale,
          0.95,
        );
      } else if (visualState === "destroyed") {
        this.dynamicLayer.image(
          `heart-fx-${side}`,
          "fx",
          FX_ART.corruptionDissolve,
          coords.x,
          coords.y,
          74 * coords.scale,
          74 * coords.scale,
          0.9,
        );
      }

      const bar = this.heartBars.get(side);
      bar?.update(coords.x, coords.y + (side === "opponent" ? 12 : -12), heart.currentHp, heart.maxHp, true);

      const shieldSuffix = heart.shield > 0 ? ` (+${heart.shield} Escudo)` : "";
      const titleColor =
        visualState === "critical"
          ? "#ff6b6b"
          : visualState === "severely-damaged"
            ? "#ff9e78"
            : visualState === "damaged"
              ? "#ffc285"
              : visualState === "destroyed"
                ? "#884444"
                : "#ffe8b3";

      this.setLabel(
        `heart-title-${side}`,
        coords.x,
        coords.y + (side === "opponent" ? -12 : 12),
        `${heart.name} · ${heart.currentHp}/${heart.maxHp} PV${shieldSuffix}`,
        {
          fontFamily: "monospace",
          fontSize: side === "opponent" ? "11px" : "12px",
          fontStyle: "bold",
          color: titleColor,
        },
        105,
        true,
      );
    }

    private renderTerritoryLane(
      side: PlayerSide,
      lane: LaneIndex,
      state: MatchState,
      timeMs: number,
    ) {
      const slot = state.lanes[side][lane];
      const coords = getLaneBoardCoordinates(side, lane);
      const biome = getTerritoryBiome(slot.biomeId);

      const isHighlighted =
        this.highlightedLanes?.side === side &&
        this.highlightedLanes.lanes.includes(lane);
      const isSelected =
        this.selectedSlot?.side === side && this.selectedSlot.lane === lane;

      // 1. Pedestal Drop Shadow for 2.5D contact occlusion
      const halfTileW = Math.round(coords.tileWidth / 2);
      const halfTileH = Math.round(coords.tileHeight / 2);
      this.dynamicLayer.image(
        `lane-pedestal-shadow-${side}-${lane}`,
        "props",
        PROP_ART.shadowLarge,
        coords.centerX,
        coords.centerY + halfTileH * 0.86,
        coords.tileWidth * 1.05,
        28,
        0.65,
      );

      // 2. Render 2x2 biome tiles forming the physical territory base
      const tileOffsets: readonly [number, number, number][] = [
        [-halfTileW / 2, -halfTileH / 2, biome.visual.tileFrames[0]],
        [halfTileW / 2, -halfTileH / 2, biome.visual.tileFrames[1]],
        [-halfTileW / 2, halfTileH / 2, biome.visual.tileFrames[2]],
        [halfTileW / 2, halfTileH / 2, biome.visual.tileFrames[3]],
      ];

      tileOffsets.forEach(([dx, dy], idx) => {
        this.dynamicLayer
          .image(
            `lane-ground-${side}-${lane}-${idx}`,
            "props",
            biome.visual.groundOverlayPropFrame,
            coords.centerX + dx,
            coords.centerY + dy,
            halfTileW,
            halfTileH,
            0.78,
          )
          .setTint(biome.visual.tintHex);
      });

      // 3. Render Living Biome Environment Props in Perspective (primary, secondary, tertiary)
      const propScale = coords.perspectiveScale;
      this.dynamicLayer.image(
        `lane-prop-primary-${side}-${lane}`,
        "props",
        biome.visual.primaryPropFrame,
        coords.centerX - 58 * propScale,
        coords.centerY - 30 * propScale,
        42 * propScale,
        42 * propScale,
        0.95,
      );
      this.dynamicLayer.image(
        `lane-prop-secondary-${side}-${lane}`,
        "props",
        biome.visual.secondaryPropFrame,
        coords.centerX + 58 * propScale,
        coords.centerY - 28 * propScale,
        36 * propScale,
        36 * propScale,
        0.9,
      );
      this.dynamicLayer.image(
        `lane-prop-tertiary-${side}-${lane}`,
        "props",
        biome.visual.tertiaryPropFrame,
        coords.centerX + (side === "player" ? -64 : 64) * propScale,
        coords.centerY + 24 * propScale,
        30 * propScale,
        30 * propScale,
        0.88,
      );

      // Preview Ghost when hovered/dragged over valid territory
      const isPreviewTarget = this.previewSlot?.side === side && this.previewSlot.lane === lane;
      if (isPreviewTarget) {
        const previewCard = this.previewSlot?.cardId
          ? findCardDefinition(this.previewSlot.cardId)
          : undefined;
        this.ambientController.renderPreviewGhost(
          side,
          lane,
          previewCard?.element ?? biome.element,
          timeMs,
          false,
        );
      }

      // Highlight ring when player is choosing a target lane
      if (isHighlighted || isSelected) {
        this.dynamicLayer.image(
          `lane-highlight-${side}-${lane}`,
          "fx",
          isSelected ? FX_ART.wardPulse : FX_ART.purificationRing,
          coords.centerX,
          coords.centerY,
          coords.tileWidth * 0.95,
          coords.tileHeight * 0.95,
          0.88,
        );
      }

      // Territory Biome Label
      this.setLabel(
        `lane-biome-label-${side}-${lane}`,
        coords.centerX,
        coords.labelY,
        `F${lane + 1} · ${biome.shortName}`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          fontStyle: "bold",
          color: isHighlighted ? "#a8ff9e" : "#e9d8a6",
        },
        28,
        true,
      );

      // 3. Render Physical Structure if built on this territory
      if (slot.structure) {
        const structureDef = getCardDefinition(slot.structure.cardId);
        const structFrame = isStructureCard(structureDef)
          ? structureDef.propFrame
          : PROP_ART.forestAltar;

        this.dynamicLayer.image(
          `lane-struct-shadow-${side}-${lane}`,
          "props",
          PROP_ART.shadowMedium,
          coords.structureX,
          coords.structureY + 18 * propScale,
          40 * propScale,
          16 * propScale,
          0.75,
        );

        this.dynamicLayer.image(
          `lane-struct-body-${side}-${lane}`,
          "props",
          structFrame,
          coords.structureX,
          coords.structureY,
          46 * propScale,
          46 * propScale,
          1,
        );

        this.setLabel(
          `lane-struct-hp-${side}-${lane}`,
          coords.structureX,
          coords.structureY + 24 * propScale,
          `${slot.structure.currentHp}PV`,
          {
            fontFamily: "monospace",
            fontSize: "9px",
            fontStyle: "bold",
            color: "#9ef6ff",
          },
          34,
          true,
        );
      } else {
        this.setLabel(
          `lane-struct-hp-${side}-${lane}`,
          coords.structureX,
          coords.structureY,
          "",
          { fontSize: "9px" },
          34,
          false,
        );
      }

      // 4. Render Physical Card Pedestal + Materialized Creature standing above the card
      const hpBar = this.healthBars.get(`creature-hp-${side}-${lane}`);
      if (slot.creature) {
        const creature = slot.creature;
        const cardDef = getCreatureCardDefinition(creature.cardId);
        const stats = computeEffectiveCreatureStats(slot)!;

        // Physical Card lying on the territory beneath the creature
        this.dynamicLayer.image(
          `lane-card-base-${side}-${lane}`,
          "props",
          PROP_ART.rug,
          coords.cardPedestalX,
          coords.cardPedestalY + 6 * propScale,
          68 * propScale,
          36 * propScale,
          0.92,
        );

        // Synergy / Action Ready Aura beneath creature
        if (creature.canAct && side === state.activeSide) {
          this.dynamicLayer.image(
            `lane-ready-aura-${side}-${lane}`,
            "fx",
            stats.isFavoredTerrain ? FX_ART.purificationRing : FX_ART.wardIdle,
            coords.creatureX,
            coords.cardPedestalY,
            78 * propScale,
            46 * propScale,
            0.85,
          );
        }

        // Creature shadow on the card
        this.dynamicLayer.image(
          `lane-creature-shadow-${side}-${lane}`,
          "props",
          PROP_ART.shadowMedium,
          coords.creatureX,
          coords.creatureY + 24 * propScale,
          50 * propScale,
          18 * propScale,
          0.85,
        );

        // Materialized Creature Sprite (breathing gently in 2.5D space)
        const bobOffset = Math.sin(timeMs * 0.005 + lane) * 2.5;
        this.renderMaterializedCreatureActor(
          side,
          lane,
          cardDef.id,
          cardDef.actorId,
          cardDef.portrait.sheet,
          cardDef.portrait.column,
          cardDef.portrait.row,
          cardDef.portrait.columns,
          coords.creatureX,
          coords.creatureY + bobOffset,
          68 * propScale,
          timeMs,
        );

        // Status visual overlays (Veiled, Confused, Burning)
        if (creature.statuses.includes("veiled")) {
          this.dynamicLayer.image(
            `lane-status-veil-${side}-${lane}`,
            "fx",
            FX_ART.wardAppear,
            coords.creatureX,
            coords.creatureY,
            72 * propScale,
            72 * propScale,
            0.55,
          );
        }
        if (creature.statuses.includes("confused")) {
          this.dynamicLayer.image(
            `lane-status-confused-${side}-${lane}`,
            "fx",
            FX_ART.magicStar,
            coords.creatureX + 22 * propScale,
            coords.creatureY - 24 * propScale,
            22 * propScale,
            22 * propScale,
            0.95,
          );
        }
        if (creature.statuses.includes("burning")) {
          this.dynamicLayer.image(
            `lane-status-burn-${side}-${lane}`,
            "fx",
            FX_ART.ember,
            coords.creatureX - 22 * propScale,
            coords.creatureY - 20 * propScale,
            22 * propScale,
            22 * propScale,
            0.95,
          );
        }

        // Folklore character visual aura signatures (embers, kitsunebi, water rings, etc.)
        this.renderFolkloreLegendAura(side, lane, cardDef.id, coords, propScale, timeMs);

        hpBar?.update(
          coords.creatureX,
          coords.creatureY + 32 * propScale,
          creature.currentHp,
          creature.maxHp,
          true,
        );

        const shieldText = creature.shield > 0 ? `+${creature.shield}` : "";
        const readyDot = creature.canAct && side === state.activeSide ? "★ " : "";
        this.setLabel(
          `lane-creature-name-${side}-${lane}`,
          coords.creatureX,
          coords.creatureY - 34 * propScale,
          `${readyDot}${cardDef.name}`,
          {
            fontFamily: "monospace",
            fontSize: "11px",
            fontStyle: "bold",
            color: creature.canAct && side === state.activeSide ? "#fff3a1" : "#f5ebd6",
          },
          36,
          true,
        );

        this.setLabel(
          `lane-creature-stats-${side}-${lane}`,
          coords.creatureX,
          coords.creatureY + 44 * propScale,
          `ATQ ${stats.effectiveAttack}${stats.isFavoredTerrain ? "↑" : ""} · PV ${creature.currentHp}/${creature.maxHp}${shieldText}`,
          {
            fontFamily: "monospace",
            fontSize: "10px",
            fontStyle: "bold",
            color: stats.isFavoredTerrain ? "#a3ff9e" : "#ffe0a3",
          },
          36,
          true,
        );
      } else {
        this.creatureSprites.get(`actor-${side}-${lane}`)?.setVisible(false);
        hpBar?.update(coords.creatureX, coords.creatureY, 0, 1, false);
        this.setLabel(
          `lane-creature-name-${side}-${lane}`,
          coords.creatureX,
          coords.creatureY,
          "",
          { fontSize: "10px" },
          36,
          false,
        );
        this.setLabel(
          `lane-creature-stats-${side}-${lane}`,
          coords.creatureX,
          coords.creatureY,
          "",
          { fontSize: "10px" },
          36,
          false,
        );
      }
    }

    private renderFolkloreLegendAura(
      side: PlayerSide,
      lane: LaneIndex,
      cardId: string,
      coords: LaneBoardCoordinates,
      propScale: number,
      timeMs: number,
    ) {
      switch (cardId) {
        case "legend-curupira": {
          const emberY = coords.creatureY - 32 * propScale - Math.sin(timeMs * 0.007) * 4;
          const emberX = coords.creatureX + Math.sin(timeMs * 0.009) * 4;
          this.dynamicLayer.image(
            `folklore-curupira-ember-${side}-${lane}`,
            "fx",
            FX_ART.ember,
            emberX,
            emberY,
            18 * propScale,
            18 * propScale,
            0.88,
          );
          this.dynamicLayer.image(
            `folklore-curupira-dust-${side}-${lane}`,
            "fx",
            FX_ART.dust,
            coords.creatureX - 10 * propScale,
            coords.creatureY + 22 * propScale,
            16 * propScale,
            14 * propScale,
            0.65,
          );
          break;
        }
        case "legend-boitata": {
          const ringScale = 1 + Math.sin(timeMs * 0.006) * 0.12;
          this.dynamicLayer
            .image(
              `folklore-boitata-ring-${side}-${lane}`,
              "fx",
              FX_ART.purificationRing,
              coords.creatureX,
              coords.creatureY + 12 * propScale,
              72 * propScale * ringScale,
              44 * propScale * ringScale,
              0.82,
            )
            .setTint(0xff6611);
          const sparkX = coords.creatureX + Math.cos(timeMs * 0.008) * 22;
          const sparkY = coords.creatureY + Math.sin(timeMs * 0.008) * 12;
          this.dynamicLayer.image(
            `folklore-boitata-spark-${side}-${lane}`,
            "fx",
            FX_ART.spark,
            sparkX,
            sparkY,
            16 * propScale,
            16 * propScale,
            0.9,
          );
          break;
        }
        case "legend-saci": {
          const vortexX = coords.creatureX + Math.sin(timeMs * 0.016) * 7;
          this.dynamicLayer.image(
            `folklore-saci-vortex-${side}-${lane}`,
            "fx",
            FX_ART.dust,
            vortexX,
            coords.creatureY + 24 * propScale,
            24 * propScale,
            16 * propScale,
            0.85,
          );
          const smokeOffset = ((timeMs * 0.04) % 24) * propScale;
          this.dynamicLayer
            .image(
              `folklore-saci-smoke-${side}-${lane}`,
              "fx",
              FX_ART.corruptionSmoke,
              coords.creatureX + 16 * propScale,
              coords.creatureY - 14 * propScale - smokeOffset,
              18 * propScale,
              18 * propScale,
              0.6,
            )
            .setTint(0xeeeeee);
          break;
        }
        case "legend-iara": {
          const pulse = 1 + Math.sin(timeMs * 0.005) * 0.1;
          this.dynamicLayer
            .image(
              `folklore-iara-water-${side}-${lane}`,
              "fx",
              FX_ART.waterZone,
              coords.creatureX,
              coords.creatureY + 16 * propScale,
              64 * propScale * pulse,
              36 * propScale * pulse,
              0.72,
            )
            .setTint(0x55ccff);
          const dropX = coords.creatureX + Math.sin(timeMs * 0.006) * 18;
          this.dynamicLayer.image(
            `folklore-iara-drop-${side}-${lane}`,
            "fx",
            FX_ART.waterDrop,
            dropX,
            coords.creatureY - 8 * propScale,
            14 * propScale,
            14 * propScale,
            0.8,
          );
          break;
        }
        case "legend-kitsune": {
          const angle = timeMs * 0.004;
          const k1X = coords.creatureX + Math.cos(angle) * 26 * propScale;
          const k1Y = coords.creatureY + Math.sin(angle) * 14 * propScale - 8;
          const k2X = coords.creatureX + Math.cos(angle + Math.PI) * 26 * propScale;
          const k2Y = coords.creatureY + Math.sin(angle + Math.PI) * 14 * propScale - 8;
          this.dynamicLayer
            .image(
              `folklore-kitsune-fire1-${side}-${lane}`,
              "fx",
              FX_ART.magicStar,
              k1X,
              k1Y,
              18 * propScale,
              18 * propScale,
              0.92,
            )
            .setTint(0x77eeff);
          this.dynamicLayer
            .image(
              `folklore-kitsune-fire2-${side}-${lane}`,
              "fx",
              FX_ART.magicStar,
              k2X,
              k2Y,
              18 * propScale,
              18 * propScale,
              0.92,
            )
            .setTint(0x77eeff);
          break;
        }
        case "legend-oni": {
          this.dynamicLayer
            .image(
              `folklore-oni-vapor-${side}-${lane}`,
              "fx",
              FX_ART.corruptionSmoke,
              coords.creatureX - 16 * propScale,
              coords.creatureY - 24 * propScale,
              26 * propScale,
              26 * propScale,
              0.7,
            )
            .setTint(0xcc2222);
          this.dynamicLayer.image(
            `folklore-oni-crack-${side}-${lane}`,
            "props",
            PROP_ART.cracks,
            coords.creatureX,
            coords.creatureY + 22 * propScale,
            36 * propScale,
            18 * propScale,
            0.8,
          );
          break;
        }
        case "legend-tengu": {
          const tenguAngle = timeMs * 0.008;
          const featherX = coords.creatureX + Math.cos(tenguAngle) * 24 * propScale;
          const featherY = coords.creatureY + Math.sin(tenguAngle) * 14 * propScale - 6;
          this.dynamicLayer.image(
            `folklore-tengu-feather-${side}-${lane}`,
            "fx",
            FX_ART.leaf,
            featherX,
            featherY,
            16 * propScale,
            16 * propScale,
            0.85,
          );
          this.dynamicLayer.image(
            `folklore-tengu-gust-${side}-${lane}`,
            "fx",
            FX_ART.wardPulse,
            coords.creatureX,
            coords.creatureY,
            56 * propScale,
            56 * propScale,
            0.35,
          );
          break;
        }
        case "legend-kappa": {
          this.dynamicLayer.image(
            `folklore-kappa-dish-${side}-${lane}`,
            "fx",
            FX_ART.waterDrop,
            coords.creatureX,
            coords.creatureY - 26 * propScale,
            18 * propScale,
            18 * propScale,
            0.95,
          );
          this.dynamicLayer.image(
            `folklore-kappa-drip-${side}-${lane}`,
            "fx",
            FX_ART.waterDrop,
            coords.creatureX - 8 * propScale,
            coords.creatureY + 6 * propScale,
            12 * propScale,
            12 * propScale,
            0.7,
          );
          break;
        }
        case "legend-mapinguari": {
          this.dynamicLayer.image(
            `folklore-mapinguari-cracks-${side}-${lane}`,
            "props",
            PROP_ART.cracks,
            coords.creatureX,
            coords.creatureY + 24 * propScale,
            42 * propScale,
            20 * propScale,
            0.85,
          );
          this.dynamicLayer.image(
            `folklore-mapinguari-dust-${side}-${lane}`,
            "fx",
            FX_ART.dust,
            coords.creatureX + 12 * propScale,
            coords.creatureY + 20 * propScale,
            22 * propScale,
            16 * propScale,
            0.75,
          );
          break;
        }
        case "legend-raiju": {
          const sparkX = coords.creatureX + Math.sin(timeMs * 0.025) * 18 * propScale;
          const sparkY = coords.creatureY + Math.cos(timeMs * 0.02) * 16 * propScale;
          this.dynamicLayer.image(
            `folklore-raiju-spark-${side}-${lane}`,
            "fx",
            FX_ART.lightningFragment,
            sparkX,
            sparkY,
            20 * propScale,
            20 * propScale,
            0.92,
          );
          break;
        }
      }
    }

    private creatureSprites = new Map<string, GameObjects.Image>();

    private renderMaterializedCreatureActor(
      side: PlayerSide,
      lane: LaneIndex,
      cardId: string,
      actorId: string | undefined,
      sheetPath: string,
      column: number,
      row: number,
      columns: number,
      x: number,
      y: number,
      size: number,
      timeMs: number,
    ) {
      const spriteId = `actor-${side}-${lane}`;
      const activeAction = this.actorActionState.get(spriteId);
      const isActionActive =
        activeAction && timeMs >= activeAction.startedAt && timeMs <= activeAction.startedAt + activeAction.duration;
      const actionProgress = isActionActive
        ? Math.max(0, Math.min(1, (timeMs - activeAction.startedAt) / activeAction.duration))
        : 0;

      let textureKey: string = FOLKLARD_ART_MANIFEST.missingActor.key;
      let frameIndex = 0;

      if (actorId && this.textures.exists(actorTextureKey(actorId))) {
        textureKey = actorTextureKey(actorId);
        const actionRow = !isActionActive
          ? 0
          : activeAction.mode === "attack"
            ? 2
            : activeAction.mode === "awakening"
              ? 3
              : 4;
        const subFrame = isActionActive
          ? Math.min(3, Math.floor(actionProgress * 4))
          : Math.floor(timeMs / 220 + lane) % 4;
        frameIndex = actionRow * 4 + subFrame;
      } else if (this.textures.exists(bestiaryTextureKey(sheetPath))) {
        textureKey = bestiaryTextureKey(sheetPath);
        frameIndex = row * columns + column;
      }

      let image = this.creatureSprites.get(spriteId);
      if (!image) {
        image = this.add.image(x, y, textureKey, frameIndex).setDepth(30);
        this.creatureSprites.set(spriteId, image);
      } else {
        image.setTexture(textureKey, frameIndex);
      }

      const isVictor = this.currentState?.winner === side;
      const victoryHop = isVictor ? Math.abs(Math.sin(timeMs * 0.012 + lane)) * -14 : 0;
      const actionImpulse = isActionActive ? Math.sin(actionProgress * Math.PI) : 0;

      let offsetX = 0;
      let offsetY = victoryHop;
      let extraScale = 1;

      if (isActionActive && activeAction.mode === "attack") {
        offsetY += (side === "player" ? -26 : 26) * actionImpulse;
        extraScale = 1 + 0.14 * actionImpulse;
      } else if (isActionActive && activeAction.mode === "awakening") {
        offsetY -= 16 * actionImpulse;
        extraScale = 1 + 0.18 * actionImpulse;
      } else if (isActionActive && activeAction.mode === "damage") {
        offsetX = Math.sin(actionProgress * Math.PI * 6) * 7;
        offsetY += (side === "player" ? 8 : -8) * actionImpulse;
      }

      const breatheScaleX = (1 - Math.sin(timeMs * 0.005 + lane) * 0.025) * size * extraScale;
      const breatheScaleY = (1 + Math.sin(timeMs * 0.005 + lane) * 0.035) * size * extraScale;

      if (isActionActive && activeAction.mode === "damage") {
        image.setTint(0xff8888);
      } else {
        image.clearTint();
      }

      image
        .setPosition(Math.round(x + offsetX), Math.round(y + offsetY))
        .setDisplaySize(Math.round(breatheScaleX), Math.round(breatheScaleY))
        .setFlipX(side === "opponent")
        .setVisible(true);

      // Hide any unused actor sprites during cleanup pass
      void cardId;
    }

    private playVisualEvents(events: readonly MatchVisualEvent[]) {
      // Hide stale actor sprites if a creature was defeated or moved
      for (const [id, sprite] of this.creatureSprites.entries()) {
        const [, side, laneStr] = id.split("-");
        const lane = Number(laneStr) as LaneIndex;
        const slot = this.currentState?.lanes[side as PlayerSide]?.[lane];
        if (!slot?.creature) {
          sprite.setVisible(false);
        }
      }

      const now = this.time?.now ?? 0;

      for (const event of events) {
        switch (event.kind) {
          case "creature-summoned":
            playSummonChoreography(this, event, audio, false);
            break;
          case "creature-attack": {
            const enemySide = event.attackerSide === "player" ? "opponent" : "player";
            this.actorActionState.set(`actor-${event.attackerSide}-${event.lane}`, {
              mode: "attack",
              startedAt: now,
              duration: 460,
            });
            if (!event.hitHeart && !event.blockedByVeil) {
              this.actorActionState.set(`actor-${enemySide}-${event.targetLane}`, {
                mode: "damage",
                startedAt: now + 120,
                duration: 380,
              });
            }
            playAttackChoreography(this, event, audio, false);
            break;
          }
          case "creature-awakening":
            this.actorActionState.set(`actor-${event.side}-${event.lane}`, {
              mode: "awakening",
              startedAt: now,
              duration: 600,
            });
            playAwakeningChoreography(this, event, audio, false);
            break;
          case "creature-defeated":
            playCreatureDefeatedChoreography(this, event, audio, false);
            break;
          case "territory-transformed":
            playTerritoryShiftChoreography(this, event, audio, false);
            break;
          case "heart-damaged":
            playKingdomHeartHitChoreography(this, event, audio, false);
            break;
          case "structure-built": {
            audio?.play("structure-build");
            const coords = getLaneBoardCoordinates(event.side, event.lane);
            spawnElementalBurst(this, coords.structureX, coords.structureY, "nature", 40, false);
            break;
          }
          case "structure-destroyed":
            playStructureDestroyedChoreography(this, event, audio, false);
            break;
          case "event-triggered": {
            audio?.play("event-cast");
            const lane = event.lane ?? 1;
            const coords = getLaneBoardCoordinates(event.side, lane);
            spawnElementalBurst(this, coords.centerX, coords.centerY, "spirit", 72, false);
            break;
          }
          case "card-drawn":
            audio?.play("card-draw");
            break;
          case "creature-moved": {
            audio?.play("creature-move");
            const targetCoords = getLaneBoardCoordinates(event.side, event.toLane);
            spawnFloatingBannerText(
              this,
              targetCoords.centerX,
              targetCoords.centerY - 28,
              `↳ ${event.creatureName} deslocou-se!`,
              "#a8e4a0",
              1200,
            );
            break;
          }
          case "slot-sacrificed": {
            audio?.play("sacrifice");
            const coords = getLaneBoardCoordinates(event.side, event.lane);
            spawnFloatingBannerText(
              this,
              coords.centerX,
              coords.centerY - 28,
              `✨ Sacrifício (+${event.refundBreath} Sopro)`,
              "#ffe082",
              1300,
            );
            break;
          }
          case "weather-changed": {
            audio?.play("weather-change");
            spawnFloatingBannerText(
              this,
              480,
              120,
              `🌪️ Clima: ${event.weatherName}`,
              "#81d4fa",
              1800,
            );
            break;
          }
          case "turn-started":
            audio?.play("turn-change");
            break;
          case "match-won":
            playMatchWonChoreography(this, event, audio, false);
            break;
        }
      }
    }

    private cleanup() {
      for (const unsub of this.unsubscribers) {
        unsub();
      }
      this.unsubscribers = [];
      this.dynamicLayer.destroy();
      this.ambientController.destroy();
      for (const text of this.dynamicTexts.values()) {
        text.destroy();
      }
      this.dynamicTexts.clear();
      for (const bar of this.healthBars.values()) {
        bar.destroy();
      }
      this.healthBars.clear();
      for (const bar of this.heartBars.values()) {
        bar.destroy();
      }
      this.heartBars.clear();
      for (const sprite of this.creatureSprites.values()) {
        sprite.destroy();
      }
      this.creatureSprites.clear();
    }
  };
}

export async function createCardRealmsBoardGame(
  parent: HTMLElement,
  bridge: CardRealmsBridge,
  audio: CardRealmsAudio | null,
) {
  const PhaserLib = await import("phaser");
  const BoardScene = createCardRealmsBoardScene(PhaserLib, bridge, audio);

  const game = new PhaserLib.Game({
    type: PhaserLib.AUTO,
    parent,
    ...CARD_REALMS_BOARD_VIEWPORT,
    backgroundColor: "rgba(0,0,0,0)",
    transparent: true,
    ...ARPG_PIXEL_RENDER_SETTINGS,
    scale: {
      mode: PhaserLib.Scale.FIT,
      autoCenter: PhaserLib.Scale.CENTER_BOTH,
      ...CARD_REALMS_BOARD_VIEWPORT,
    },
    scene: [BoardScene],
  });

  return {
    game,
    destroy() {
      game.destroy(true);
    },
  };
}
