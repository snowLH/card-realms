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
import { getCardDefinition, isStructureCard } from "../domain/cards";
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
  playKingdomHeartHitChoreography,
  playSummonChoreography,
  playTerritoryShiftChoreography,
} from "./animations";
import type { CardRealmsAudio } from "./audio";
import type { CardRealmsBridge, HighlightedBoardLanes, SelectedBoardSlot } from "./bridge";
import {
  CARD_REALMS_BOARD_VIEWPORT,
  getKingdomHeartCoordinates,
  getLaneBoardCoordinates,
} from "./camera";
import { LivingBoardAmbientController, spawnElementalBurst } from "./effects";
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
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super("card-realms-board-scene");
    }

    preload() {
      queueAuthoredArt(this, "mata-encantada");
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
        bridge.onVisualEvents((events) => {
          this.playVisualEvents(events);
        }),
      );

      this.events.once("shutdown", () => this.cleanup());
      this.events.once("destroy", () => this.cleanup());

      this.currentState = bridge.getState();
      this.highlightedLanes = bridge.getHighlightedLanes();
      this.selectedSlot = bridge.getSelectedSlot();
      this.renderBoardState();
    }

    update(time: number) {
      this.ambientController.update(this.currentState, time, false);
      this.renderBoardState(time);
    }

    private createStaticTabletopSurface() {
      // Outer Sanctuary Table Frame
      authoredPanel(
        this,
        CARD_REALMS_BOARD_VIEWPORT.width / 2,
        CARD_REALMS_BOARD_VIEWPORT.height / 2,
        "panel-dark",
        944,
        526,
      ).setDepth(1);

      // Inner Cartographer War Table Surface (tilted 2.5D board)
      authoredPanel(
        this,
        CARD_REALMS_BOARD_VIEWPORT.width / 2,
        268,
        "panel-parchment",
        878,
        366,
      )
        .setDepth(2)
        .setAlpha(0.24);

      // Corner Sanctuary Braziers & Lanterns giving physical tabletop presence
      authoredImage(this, 62, 92, "props", PROP_ART.brazier, 44, 44).setDepth(4);
      authoredImage(this, 898, 92, "props", PROP_ART.brazier, 44, 44).setDepth(4);
      authoredImage(this, 56, 448, "props", PROP_ART.lantern, 48, 48).setDepth(4);
      authoredImage(this, 904, 448, "props", PROP_ART.lantern, 48, 48).setDepth(4);

      // Center Conflict Frontier Line
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
          .setAlpha(0.68);
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

      for (const side of ["opponent", "player"] as const) {
        for (const lane of BOARD_LANES) {
          this.renderTerritoryLane(side, lane, state, timeMs);
        }
      }

      this.dynamicLayer.end();
    }

    private renderKingdomHeart(side: PlayerSide, state: MatchState) {
      const heart = state.players[side].heart;
      const culture = getCulture(heart.culture);
      const coords = getKingdomHeartCoordinates(side);
      const visualState = getKingdomHeartVisualState(heart);

      const propFrame =
        visualState === "intact"
          ? culture.kingdomHeart.intactPropFrame
          : visualState === "damaged"
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
        140 * coords.scale,
        32 * coords.scale,
        0.75,
      );

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

      if (visualState === "damaged" || visualState === "critical") {
        this.dynamicLayer.image(
          `heart-smoke-${side}`,
          "fx",
          visualState === "critical" ? FX_ART.corruptionBurst : FX_ART.corruptionSmoke,
          coords.x - 132 * coords.scale,
          coords.y - 6,
          44,
          44,
          0.75,
        );
      }

      const bar = this.heartBars.get(side);
      bar?.update(coords.x, coords.y + (side === "opponent" ? 12 : -12), heart.currentHp, heart.maxHp, true);

      const shieldSuffix = heart.shield > 0 ? ` (+${heart.shield} Escudo)` : "";
      this.setLabel(
        `heart-title-${side}`,
        coords.x,
        coords.y + (side === "opponent" ? -12 : 12),
        `${heart.name} · ${heart.currentHp}/${heart.maxHp} PV${shieldSuffix}`,
        {
          fontFamily: "monospace",
          fontSize: side === "opponent" ? "11px" : "12px",
          fontStyle: "bold",
          color: visualState === "critical" ? "#ff9e8e" : "#ffe8b3",
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

      // 1. Render 2x2 biome tiles forming the physical territory base
      const halfTileW = Math.round(coords.tileWidth / 2);
      const halfTileH = Math.round(coords.tileHeight / 2);
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

      // 2. Render Living Biome Environment Props (trees, corals, rocks, braziers, crystals, lanterns)
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
      let textureKey: string = FOLKLARD_ART_MANIFEST.missingActor.key;
      let frameIndex = 0;

      if (actorId && this.textures.exists(actorTextureKey(actorId))) {
        textureKey = actorTextureKey(actorId);
        frameIndex = Math.floor(timeMs / 220 + lane) % 4;
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

      image
        .setPosition(Math.round(x), Math.round(y))
        .setDisplaySize(Math.round(size), Math.round(size))
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

      for (const event of events) {
        switch (event.kind) {
          case "creature-summoned":
            playSummonChoreography(this, event, audio, false);
            break;
          case "creature-attack":
            playAttackChoreography(this, event, audio, false);
            break;
          case "creature-awakening":
            playAwakeningChoreography(this, event, audio, false);
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
          case "event-triggered": {
            audio?.play("event-cast");
            const lane = event.lane ?? 1;
            const coords = getLaneBoardCoordinates(event.side, lane);
            spawnElementalBurst(this, coords.centerX, coords.centerY, "spirit", 72, false);
            break;
          }
          case "turn-started":
            audio?.play("turn-change");
            break;
          case "match-won":
            audio?.play(event.winner === "player" ? "victory" : "defeat");
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
