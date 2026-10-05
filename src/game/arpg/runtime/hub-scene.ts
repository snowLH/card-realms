import { buildHubNavigation, HUB_STATIONS, HUB_WORLD, findNearestHubStation, type HubDestinationId } from "../hub/content";
import { findGridPath, type GridNavigation, type WorldPoint } from "../navigation/grid-path";
import { readBrowserGamepad, type GamepadFrame } from "./gamepad";
import type { ArpgBridge } from "./bridge";
import { ArpgAudio } from "./arpg-audio";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import {
  ARPG_ASSET_MANIFEST,
  getArpgSpriteSheetFrameConfig,
  registerArpgSpriteSheetAnimations,
} from "../assets";
import {
  CARTOGRAPHER_PLAYER_FRAME_SIZE,
  CARTOGRAPHER_PLAYER_SCALE,
  CARTOGRAPHER_PLAYER_TEXTURE,
  createCartographerAvatarSpritesheet,
  playCartographerPlayerAnimation,
  registerCartographerPlayerAnimations,
} from "./player-sprites";

type PhaserModule = typeof import("phaser");
type ArcadeSprite = import("phaser").Physics.Arcade.Sprite;
type Key = import("phaser").Input.Keyboard.Key;

const PLAYER_SPEED = 230;
const BLACKSMITH_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.blacksmith;
const BLACKSMITH_TEXTURE = BLACKSMITH_ASSET.textureKey;
const BLACKSMITH_SCALE = BLACKSMITH_ASSET.scale;
const BLACKSMITH_HOME = { x: 344, y: 254 };
const MERCHANT_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.merchant;
const MERCHANT_TEXTURE = MERCHANT_ASSET.textureKey;
const MERCHANT_SCALE = MERCHANT_ASSET.scale;
const MERCHANT_HOME = { x: 830, y: 484 };
const ARCHIVIST_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.archivist;
const ARCHIVIST_TEXTURE = ARCHIVIST_ASSET.textureKey;
const ARCHIVIST_SCALE = ARCHIVIST_ASSET.scale;
const ARCHIVIST_HOME = { x: 455, y: 452 };
const BESTIARY_KEEPER_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.bestiaryKeeper;
const BESTIARY_KEEPER_TEXTURE = BESTIARY_KEEPER_ASSET.textureKey;
const BESTIARY_KEEPER_SCALE = BESTIARY_KEEPER_ASSET.scale;
const BESTIARY_KEEPER_HOME = { x: 870, y: 310 };
const BLACKSMITH_ANIMATIONS = BLACKSMITH_ASSET.animations;
const MERCHANT_ANIMATIONS = MERCHANT_ASSET.animations;
const ARCHIVIST_ANIMATIONS = ARCHIVIST_ASSET.animations;
const BESTIARY_KEEPER_ANIMATIONS = BESTIARY_KEEPER_ASSET.animations;

export function createArpgHubScene(
  Phaser: PhaserModule,
  bridge: ArpgBridge,
  onNavigate: (destination: HubDestinationId) => void,
  onPrompt: (message: string) => void,
  avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
) {
  return class ArpgHubScene extends Phaser.Scene {
    private player!: ArcadeSprite;
    private keys!: { up: Key; down: Key; left: Key; right: Key; interact: Key };
    private gamepadPressedButtons = new Set<number>();
    private gamepad: GamepadFrame = {
      connected: false, moveX: 0, moveY: 0, aimX: 0, aimY: 0,
      attack: false, dashPressed: false, interactPressed: false,
      abilityPressed: [false, false],
    };
    private highlightedId: HubDestinationId | null = null;
    private stationVisuals = new Map<HubDestinationId, import("phaser").GameObjects.Ellipse>();
    private blacksmith!: import("phaser").GameObjects.Sprite;
    private merchant!: import("phaser").GameObjects.Sprite;
    private archivist!: import("phaser").GameObjects.Sprite;
    private bestiaryKeeper!: import("phaser").GameObjects.Sprite;
    private navigation!: GridNavigation;
    private clickPath: WorldPoint[] = [];
    private clickPathIndex = 0;

    constructor() {
      super("card-realms-hub");
    }
    create() {
      const audio = new ArpgAudio("guild-hub");
      audio.setEnabled(bridge.getSoundEnabled());
      const offSoundEnabled = bridge.onSoundEnabled((enabled) => audio.setEnabled(enabled));
      const disposeAudio = () => {
        offSoundEnabled();
        audio.destroy();
      };
      this.events.once("shutdown", disposeAudio);
      this.events.once("destroy", disposeAudio);

      this.physics.world.setBounds(0, 0, HUB_WORLD.width, HUB_WORLD.height);
      this.cameras.main.setBounds(0, 0, HUB_WORLD.width, HUB_WORLD.height);
      this.cameras.main.setBackgroundColor("#1c1718");
      this.drawGuildHall();
      registerCartographerPlayerAnimations(this);
      this.drawStations();
      this.createBlacksmith();
      this.createMerchant();
      this.createArchivist();
      this.createBestiaryKeeper();

      this.player = this.physics.add.sprite(HUB_WORLD.spawnX, HUB_WORLD.spawnY, CARTOGRAPHER_PLAYER_TEXTURE, 0);
      this.player.setDepth(20).setCollideWorldBounds(true).setScale(CARTOGRAPHER_PLAYER_SCALE);
      const playerRadius = 12 / CARTOGRAPHER_PLAYER_SCALE;
      this.player.setCircle(
        playerRadius,
        CARTOGRAPHER_PLAYER_FRAME_SIZE / 2 - playerRadius,
        143 - playerRadius,
      );
      playCartographerPlayerAnimation(this.player, "idle");
      for (const visual of this.stationVisuals.values()) {
        this.physics.add.existing(visual, true);
        this.physics.add.collider(this.player, visual);
      }
      this.navigation = buildHubNavigation();
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

      if (!this.input.keyboard) throw new Error("Teclado indisponível no HUB ARPG.");
      this.keys = {
        up: this.input.keyboard.addKey("W"),
        down: this.input.keyboard.addKey("S"),
        left: this.input.keyboard.addKey("A"),
        right: this.input.keyboard.addKey("D"),
        interact: this.input.keyboard.addKey("E"),
      };
      this.input.on("pointerdown", this.setClickDestination, this);
      this.events.once("shutdown", () => this.input.off("pointerdown", this.setClickDestination, this));
      onPrompt("Clique ou toque no chão para andar. WASD e joystick também funcionam; aproxime-se de uma estação e pressione E.");
    }
    private drawGuildHall() {
      const floor = this.add.graphics().setDepth(0);
      floor.fillStyle(0x1e2c25, 1).fillRect(0, 0, HUB_WORLD.width, HUB_WORLD.height);
      const paverColors = [0x29392f, 0x304035, 0x334237, 0x2c3b31, 0x37453a];
      for (let row = 0, y = 0; y < HUB_WORLD.height; row += 1, y += 34) {
        const offset = row % 2 === 0 ? 0 : 24;
        for (let x = -48; x < HUB_WORLD.width; x += 48) {
          const column = Math.floor((x + offset + 48) / 48);
          const colorIndex = Math.abs((column * 13 + row * 7 + column * row * 3) % paverColors.length);
          floor.fillStyle(paverColors[colorIndex], 0.78).fillRect(x + offset + 2, y + 2, 43, 29);
          if ((column + row) % 4 === 0) {
            floor.fillStyle(0x82906b, 0.16).fillRect(x + offset + 8, y + 7, 7, 3);
          }
        }
      }

      const paths = this.add.graphics().setDepth(1);
      const plazaCenter = { x: HUB_WORLD.width / 2, y: 365 };
      HUB_STATIONS.forEach((station, index) => {
        const dx = station.x - plazaCenter.x;
        const dy = station.y - plazaCenter.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const end = {
          x: station.x - (dx / length) * (station.radius + 32),
          y: station.y - (dy / length) * (station.radius + 32),
        };
        const bend = (index % 2 === 0 ? 1 : -1) * 34;
        const control = {
          x: (plazaCenter.x + end.x) / 2 - (dy / length) * bend,
          y: (plazaCenter.y + end.y) / 2 + (dx / length) * bend,
        };
        const points = Array.from({ length: 15 }, (_, pointIndex) => {
          const t = pointIndex / 14;
          const inverse = 1 - t;
          return {
            x: inverse * inverse * plazaCenter.x + 2 * inverse * t * control.x + t * t * end.x,
            y: inverse * inverse * plazaCenter.y + 2 * inverse * t * control.y + t * t * end.y,
          };
        });

        paths.lineStyle(52, 0x18231e, 0.78).beginPath().moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => paths.lineTo(point.x, point.y));
        paths.strokePath();
        paths.lineStyle(38, 0x706047, 0.82).beginPath().moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => paths.lineTo(point.x, point.y));
        paths.strokePath();
        points.slice(2, -1).filter((_, pointIndex) => pointIndex % 3 === 0).forEach((point, pointIndex) => {
          paths.fillStyle(pointIndex % 2 ? 0xb19a6d : 0x8c7959, 0.54)
            .fillRect(point.x - 3, point.y - 2, 6, 4);
        });
      });

      const walls = this.add.graphics().setDepth(2);
      walls.fillStyle(0x17211c, 0.96)
        .fillRect(0, 0, HUB_WORLD.width, 23)
        .fillRect(0, HUB_WORLD.height - 22, HUB_WORLD.width, 22)
        .fillRect(0, 0, 23, HUB_WORLD.height)
        .fillRect(HUB_WORLD.width - 23, 0, 23, HUB_WORLD.height);
      walls.fillStyle(0x52604b, 0.52);
      for (let x = 28; x < HUB_WORLD.width - 28; x += 76) {
        walls.fillRect(x, 9, 34, 4).fillRect(x + 36, HUB_WORLD.height - 14, 34, 4);
      }

      const edgeGarden = [
        [82, 142], [185, 660], [1166, 145], [1190, 632], [86, 562], [370, 126], [920, 648],
      ] as const;
      edgeGarden.forEach(([x, y], index) => {
        this.add.ellipse(x, y + 12, 68, 26, 0x14221b, 0.78).setDepth(3);
        this.add.ellipse(x - 14, y, 25, 31, index % 2 ? 0x385c3d : 0x426344, 0.95).setAngle(-24).setDepth(4);
        this.add.ellipse(x + 7, y - 5, 28, 36, index % 3 ? 0x527448 : 0x66814e, 0.94).setAngle(20).setDepth(4);
        this.add.circle(x - 4, y - 5, 4, index % 2 ? 0xd9b971 : 0xc99362, 0.88).setDepth(5);
      });

      [[158, 194], [1122, 190], [164, 558], [1120, 554]].forEach(([x, y], index) => {
        const post = this.add.rectangle(x, y + 12, 12, 32, 0x49392a).setStrokeStyle(2, 0x241c19).setDepth(5);
        this.add.rectangle(x, y - 8, 22, 15, 0x59442e).setStrokeStyle(2, 0x1c1715).setDepth(6);
        this.add.circle(x, y - 9, 5, index % 2 ? 0xe7bd68 : 0xa9d5a3, 0.88).setDepth(7);
        post.setAlpha(0.96);
      });

      this.add.ellipse(plazaCenter.x, plazaCenter.y, 394, 268, 0x26372f, 0.96)
        .setStrokeStyle(7, 0x725d3d, 0.96).setDepth(2);
      this.add.ellipse(plazaCenter.x, plazaCenter.y, 354, 230, 0x354337, 0.94)
        .setStrokeStyle(2, 0xb0935c, 0.7).setDepth(2);
      for (let index = 0; index < 16; index += 1) {
        const angle = (Math.PI * 2 * index) / 16;
        const stone = this.add.ellipse(
          plazaCenter.x + Math.cos(angle) * 168,
          plazaCenter.y + Math.sin(angle) * 108,
          18,
          9,
          index % 2 ? 0x857353 : 0x9b835b,
          0.78,
        ).setDepth(3);
        stone.setRotation(angle);
      }
      this.add.ellipse(plazaCenter.x, plazaCenter.y, 326, 104, 0x1c2924, 0.92)
        .setStrokeStyle(4, 0xa77a42, 0.9).setDepth(3);
      this.add.ellipse(plazaCenter.x, plazaCenter.y, 304, 82, 0x29362e, 0.82)
        .setStrokeStyle(2, 0xd1a85c, 0.45).setDepth(3);
      this.add.text(640, 304, "GUILDA DOS CARTÓGRAFOS", {
        fontFamily: "monospace", fontSize: "23px", color: "#f2d58b", stroke: "#201519", strokeThickness: 5,
      }).setOrigin(0.5).setDepth(3);
      this.add.text(640, 338, "Aurória · HUB ARPG", {
        fontFamily: "monospace", fontSize: "13px", color: "#d4c7a4",
      }).setOrigin(0.5).setDepth(3);
      [[76, 130], [1204, 130], [76, 650], [1204, 650]].forEach(([x, y]) => {
        this.add.circle(x, y, 13, 0xf3b84b, 0.74).setDepth(4);
        this.add.circle(x, y, 28, 0xf3b84b, 0.08).setDepth(3);
      });
    }

    preload() {
      this.load.spritesheet(CARTOGRAPHER_PLAYER_TEXTURE, createCartographerAvatarSpritesheet(avatarConfig), {
        ...getArpgSpriteSheetFrameConfig(ARPG_ASSET_MANIFEST.player),
      });
      this.load.spritesheet(BLACKSMITH_ASSET.textureKey, BLACKSMITH_ASSET.path, getArpgSpriteSheetFrameConfig(BLACKSMITH_ASSET));
      this.load.spritesheet(MERCHANT_ASSET.textureKey, MERCHANT_ASSET.path, getArpgSpriteSheetFrameConfig(MERCHANT_ASSET));
      this.load.spritesheet(ARCHIVIST_ASSET.textureKey, ARCHIVIST_ASSET.path, getArpgSpriteSheetFrameConfig(ARCHIVIST_ASSET));
      this.load.spritesheet(BESTIARY_KEEPER_ASSET.textureKey, BESTIARY_KEEPER_ASSET.path, getArpgSpriteSheetFrameConfig(BESTIARY_KEEPER_ASSET));
    }

    private createBlacksmith() {
      registerArpgSpriteSheetAnimations(this, {
        textureKey: BLACKSMITH_ASSET.textureKey,
        animations: BLACKSMITH_ANIMATIONS,
        columns: BLACKSMITH_ASSET.columns,
        keyPrefix: BLACKSMITH_ASSET.animationKeyPrefix!,
      });

      this.blacksmith = this.add.sprite(BLACKSMITH_HOME.x, BLACKSMITH_HOME.y, BLACKSMITH_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(BLACKSMITH_SCALE)
        .setDepth(19);
      this.playBlacksmithAnimation("working");
    }

    private playBlacksmithAnimation(animation: keyof typeof BLACKSMITH_ANIMATIONS) {
      const key = `${BLACKSMITH_ASSET.animationKeyPrefix}-${animation}`;
      if (this.blacksmith.anims.currentAnim?.key !== key) this.blacksmith.play(key);
    }

    private createMerchant() {
      registerArpgSpriteSheetAnimations(this, {
        textureKey: MERCHANT_ASSET.textureKey,
        animations: MERCHANT_ANIMATIONS,
        columns: MERCHANT_ASSET.columns,
        keyPrefix: MERCHANT_ASSET.animationKeyPrefix!,
      });

      this.merchant = this.add.sprite(MERCHANT_HOME.x, MERCHANT_HOME.y, MERCHANT_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(MERCHANT_SCALE)
        .setDepth(10);
      this.playMerchantAnimation("working");
    }

    private playMerchantAnimation(animation: keyof typeof MERCHANT_ANIMATIONS) {
      const key = `${MERCHANT_ASSET.animationKeyPrefix}-${animation}`;
      if (this.merchant.anims.currentAnim?.key !== key) this.merchant.play(key);
    }

    private createArchivist() {
      registerArpgSpriteSheetAnimations(this, {
        textureKey: ARCHIVIST_ASSET.textureKey,
        animations: ARCHIVIST_ANIMATIONS,
        columns: ARCHIVIST_ASSET.columns,
        keyPrefix: ARCHIVIST_ASSET.animationKeyPrefix!,
      });

      this.archivist = this.add.sprite(ARCHIVIST_HOME.x, ARCHIVIST_HOME.y, ARCHIVIST_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(ARCHIVIST_SCALE)
        .setDepth(19);
      this.playArchivistAnimation("working");
    }

    private playArchivistAnimation(animation: keyof typeof ARCHIVIST_ANIMATIONS) {
      const key = `${ARCHIVIST_ASSET.animationKeyPrefix}-${animation}`;
      if (this.archivist.anims.currentAnim?.key !== key) this.archivist.play(key);
    }

    private createBestiaryKeeper() {
      registerArpgSpriteSheetAnimations(this, {
        textureKey: BESTIARY_KEEPER_ASSET.textureKey,
        animations: BESTIARY_KEEPER_ANIMATIONS,
        columns: BESTIARY_KEEPER_ASSET.columns,
        keyPrefix: BESTIARY_KEEPER_ASSET.animationKeyPrefix!,
      });

      this.bestiaryKeeper = this.add.sprite(
        BESTIARY_KEEPER_HOME.x,
        BESTIARY_KEEPER_HOME.y,
        BESTIARY_KEEPER_TEXTURE,
        0,
      )
        .setOrigin(0.5, 0.82)
        .setScale(BESTIARY_KEEPER_SCALE)
        .setDepth(19);
      this.add.text(BESTIARY_KEEPER_HOME.x, BESTIARY_KEEPER_HOME.y - 59, "Luzia · Naturalista", {
        fontFamily: "monospace", fontSize: "10px", color: "#e4edbd",
        stroke: "#261719", strokeThickness: 4,
      }).setOrigin(0.5).setDepth(19);
      this.playBestiaryKeeperAnimation("studying");
    }

    private playBestiaryKeeperAnimation(animation: keyof typeof BESTIARY_KEEPER_ANIMATIONS) {
      const key = `${BESTIARY_KEEPER_ASSET.animationKeyPrefix}-${animation}`;
      if (this.bestiaryKeeper.anims.currentAnim?.key !== key) this.bestiaryKeeper.play(key);
    }

    private drawStations() {
      HUB_STATIONS.forEach((station) => {
        const visual = this.add.ellipse(station.x, station.y + 13, 178, 82, station.tint, 0.1)
          .setAlpha(0.52)
          .setStrokeStyle(2, station.tint, 0.2)
          .setDepth(7)
          .setInteractive({ useHandCursor: true });
        this.stationVisuals.set(station.id, visual);
        this.drawStationProp(station.id, station.x, station.y + 8, station.tint);
        if (station.id === "loadout") {
          this.drawStationSign(station.label, station.x, 158, 100);
        } else if (station.id === "archive") {
          this.drawStationSign(station.label, station.x, 357, 194);
        } else if (station.id === "portal") {
          this.drawStationSign(station.label, station.x, 533, 220);
        } else {
          this.add.text(station.x, station.y - 50, station.label, {
            fontFamily: "monospace", fontSize: "15px", color: "#fff0bd",
            stroke: "#261719", strokeThickness: 4,
          }).setOrigin(0.5).setDepth(12);
          this.add.text(station.x, station.y - 31, station.kicker, {
            fontFamily: "monospace", fontSize: "9px", color: "#dfc999",
          }).setOrigin(0.5).setDepth(12);
        }
      });
    }

    private drawStationSign(label: string, x: number, y: number, width: number) {
      const sign = this.add.graphics().setDepth(11);
      sign.fillStyle(0x30241e, 0.96).fillRect(x - width / 2, y - 12, width, 24);
      sign.lineStyle(2, 0x9c8056, 0.95).strokeRect(x - width / 2, y - 12, width, 24);
      sign.fillStyle(0x59412b, 1).fillRect(x - width / 2 + 4, y - 8, 4, 16);
      sign.fillRect(x + width / 2 - 8, y - 8, 4, 16);
      this.add.text(x, y, label, {
        fontFamily: "monospace", fontSize: label.length > 14 ? "11px" : "13px", color: "#fff0bd",
        stroke: "#261719", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(12);
    }

    private drawStationProp(id: HubDestinationId, x: number, y: number, tint: number) {
      if (id === "expeditions") {
        this.add.rectangle(x, y + 13, 112, 38, 0x6d432d).setStrokeStyle(3, 0x2b1815).setDepth(9);
        this.add.rectangle(x, y + 4, 70, 34, 0xd7bd80).setStrokeStyle(2, 0x7f6139).setDepth(10).setAngle(-3);
        this.add.line(x - 2, y + 3, -23, -8, 23, 8, 0x8f7044, 0.9).setLineWidth(2).setDepth(11);
        this.add.circle(x + 38, y + 4, 12, 0x493c2a).setStrokeStyle(3, 0xe1b95c).setDepth(11);
        this.add.line(x + 38, y + 4, 0, -8, 5, 7, 0xf3d47b).setLineWidth(2).setDepth(12);
        return;
      }
      if (id === "loadout") {
        this.drawForge();
        return;
      }
      if (id === "collection") {
        this.add.rectangle(x, y + 8, 112, 62, 0x4b2a22).setStrokeStyle(4, 0x291715).setDepth(9);
        [-36, -12, 12, 36].forEach((offset, index) => {
          const colors = [0x9b4b42, 0x4f718b, 0x92723d, 0x6f4e8b];
          this.add.rectangle(x + offset, y + 6, 16, 42, colors[index]).setStrokeStyle(2, 0x261617).setDepth(10);
        });
        this.add.rectangle(x, y + 30, 110, 6, 0xb07845).setDepth(11);
        return;
      }
      if (id === "archive") {
        this.drawArchiveFurniture();
        return;
      }
      if (id === "merchant") {
        this.add.rectangle(x, y - 13, 124, 25, 0x74432f).setStrokeStyle(3, 0x301c18).setDepth(9);
        [-43, -22, 0, 22, 43].forEach((offset, index) => {
          this.add.rectangle(x + offset, y - 13, 12, 21, index % 2 ? 0xd79b56 : 0x9c4f3e).setDepth(10);
        });
        this.add.rectangle(x - 51, y + 17, 10, 47, 0x5a3628).setDepth(9);
        this.add.rectangle(x + 51, y + 17, 10, 47, 0x5a3628).setDepth(9);
        this.add.rectangle(x, y + 34, 120, 18, 0x6b412d).setStrokeStyle(3, 0x301c18).setDepth(11);
        this.add.rectangle(x - 31, y + 21, 19, 18, 0x74a297).setStrokeStyle(2, 0x34443a).setDepth(12);
        this.add.circle(x + 1, y + 20, 11, 0xd8ad5c).setStrokeStyle(2, 0x5c3b29).setDepth(12);
        this.add.rectangle(x + 34, y + 22, 16, 21, 0x8271a7).setStrokeStyle(2, 0x392a43).setDepth(12);
        return;
      }
      if (id === "avatar") {
        this.add.ellipse(x, y + 20, 96, 23, 0x171d18, 0.48).setDepth(9);
        this.add.rectangle(x - 29, y - 11, 42, 70, 0x704a35).setStrokeStyle(3, 0x2d211c).setDepth(10);
        this.add.rectangle(x - 29, y - 12, 32, 58, 0x273e42).setStrokeStyle(3, 0xd1ad68).setDepth(11);
        this.add.ellipse(x - 29, y - 15, 23, 32, 0x8c6650, 0.74).setStrokeStyle(1, 0xe5bd75, 0.64).setDepth(12);
        this.add.rectangle(x + 25, y + 10, 38, 5, 0x7b5236).setStrokeStyle(2, 0x34221b).setDepth(10);
        this.add.rectangle(x + 13, y - 1, 5, 33, 0x795336).setDepth(10);
        this.add.rectangle(x + 37, y - 1, 5, 33, 0x795336).setDepth(10);
        this.add.rectangle(x + 25, y - 6, 31, 8, 0xa97948).setStrokeStyle(2, 0x34221b).setDepth(11);
        this.add.polygon(x + 25, y - 17, [0, -18, 13, 0, 0, 18, -13, 0], tint, 0.9)
          .setStrokeStyle(2, 0xffe0a0, 0.92).setDepth(12);
        this.add.circle(x + 25, y - 17, 4, 0xffe4a6).setDepth(13);
        return;
      }
      if (id === "refuge") {
        this.add.rectangle(x - 12, y + 10, 88, 42, 0x6c4937).setStrokeStyle(3, 0x2a1815).setDepth(9);
        this.add.rectangle(x - 26, y + 2, 48, 26, 0xb99a72).setStrokeStyle(2, 0x4c3025).setDepth(10);
        this.add.circle(x + 44, y + 2, 15, 0x315f3b).setStrokeStyle(2, 0x1d3524).setDepth(10);
        this.add.rectangle(x + 44, y + 21, 18, 17, 0x865638).setDepth(10);
        return;
      }
      if (id === "raid") {
        this.add.circle(x, y + 8, 34).setStrokeStyle(7, tint, 0.95).setDepth(9);
        this.add.circle(x, y + 8, 22, 0x241323, 0.88).setStrokeStyle(3, 0xf0b5d4, 0.7).setDepth(10);
        this.add.circle(x, y + 8, 8, 0xe17db2, 0.72).setDepth(11);
        return;
      }
      if (id === "portal") {
        this.drawExpeditionPortal();
        return;
      }
      if (id === "altar") {
        this.add.rectangle(x, y + 27, 98, 18, 0x3b2e3c).setStrokeStyle(3, 0x1e151f).setDepth(9);
        this.add.rectangle(x, y + 12, 66, 20, 0x54435f).setStrokeStyle(2, 0xa78bc0).setDepth(10);
        this.add.circle(x, y - 2, 18, 0x6f91bc, 0.38).setStrokeStyle(4, 0xc9dcf4, 0.88).setDepth(11);
        this.add.polygon(x, y - 2, [0, -13, 10, 0, 0, 13, -10, 0], tint, 0.95).setStrokeStyle(2, 0xf1e1ad).setDepth(12);
        this.add.circle(x, y - 2, 30).setStrokeStyle(2, tint, 0.38).setDepth(10);
      }
    }

    private drawForge() {
      const rack = this.add.graphics().setDepth(8);
      rack.fillStyle(0x3c2a21).fillRect(291, 165, 76, 38);
      rack.lineStyle(2, 0x1d1714).strokeRect(291, 165, 76, 38);
      rack.fillStyle(0x855a37).fillRect(297, 171, 64, 5);
      rack.fillRect(299, 184, 60, 4);
      rack.fillStyle(0x63513d).fillRect(304, 173, 4, 24).fillRect(321, 173, 4, 24).fillRect(341, 173, 4, 24);
      rack.fillStyle(0xc4a679).fillRect(307, 180, 3, 18).fillRect(324, 179, 3, 19);
      rack.fillStyle(0x99a5a8).fillRect(343, 179, 6, 19);

      const ground = this.add.graphics().setDepth(9);
      ground.fillStyle(0x161b17, 0.48).fillEllipse(278, 254, 76, 18);
      ground.fillStyle(0x493e32).fillRect(252, 246, 52, 12);
      ground.lineStyle(2, 0x211a16).strokeRect(252, 246, 52, 12);
      ground.fillStyle(0x744734).fillRect(252, 178, 52, 69);
      ground.lineStyle(3, 0x2e2019).strokeRect(252, 178, 52, 69);
      ground.fillStyle(0x98603c).fillRect(258, 184, 40, 8);
      ground.fillStyle(0x68422f).fillRect(258, 197, 40, 8);
      ground.fillRect(258, 211, 40, 8);
      ground.fillStyle(0x523527).fillRect(258, 226, 40, 15);
      ground.fillStyle(0x241b18).fillRect(264, 214, 28, 20);
      ground.lineStyle(2, 0x281b17).strokeRect(264, 214, 28, 20);
      ground.fillStyle(0xb06d32).fillRect(271, 225, 14, 7);
      ground.fillStyle(0xd99b42).fillRect(275, 220, 6, 8);
      ground.fillStyle(0x6e4932).fillRect(257, 201, 7, 4).fillRect(291, 201, 7, 4);

      const glow = this.add.ellipse(278, 223, 28, 18, 0xffa23c, 0.36).setDepth(10);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.46 },
        scale: { from: 0.94, to: 1.08 },
        duration: 860,
        yoyo: true,
        repeat: -1,
      });
    }

    private drawArchiveFurniture() {
      const shelf = this.add.graphics().setDepth(9);
      shelf.fillStyle(0x30211d).fillRect(472, 374, 76, 60);
      shelf.lineStyle(3, 0x211816).strokeRect(472, 374, 76, 60);
      shelf.fillStyle(0x75523b).fillRect(478, 380, 64, 7);
      shelf.fillRect(478, 397, 64, 7);
      shelf.fillRect(478, 414, 64, 7);
      shelf.fillStyle(0x4a3328).fillRect(478, 430, 64, 4);
      shelf.fillStyle(0x8b493d).fillRect(482, 383, 9, 13).fillRect(497, 381, 11, 15);
      shelf.fillStyle(0x48647e).fillRect(513, 382, 10, 14).fillRect(527, 385, 9, 11);
      shelf.fillStyle(0x806b42).fillRect(483, 400, 10, 14).fillRect(499, 401, 8, 13);
      shelf.fillStyle(0x566848).fillRect(513, 399, 9, 15).fillRect(529, 400, 9, 14);
      shelf.fillStyle(0xa98a5d).fillRect(484, 417, 11, 12).fillRect(502, 417, 8, 12);

      const table = this.add.graphics().setDepth(10);
      table.fillStyle(0x241a17, 0.32).fillEllipse(518, 484, 126, 18);
      table.fillStyle(0x714c35).fillRect(462, 450, 112, 12);
      table.lineStyle(2, 0x2b1d19).strokeRect(462, 450, 112, 12);
      table.fillStyle(0x4f3527).fillRect(469, 462, 9, 20).fillRect(558, 462, 9, 20);
      table.fillStyle(0x876143).fillRect(479, 455, 20, 3).fillRect(511, 455, 18, 3).fillRect(538, 455, 22, 3);
      table.fillStyle(0xd9c89d).fillRect(493, 446, 27, 10);
      table.lineStyle(1, 0x8d7955).strokeRect(493, 446, 27, 10);
      table.fillStyle(0x76543a).fillRect(497, 449, 17, 1).fillRect(499, 452, 15, 1);
      table.fillStyle(0x5c4634).fillRect(536, 443, 5, 10);
      table.fillStyle(0xead38b).fillRect(535, 439, 7, 5);
      table.fillStyle(0xf1dda0, 0.58).fillRect(533, 435, 11, 3);
    }

    private drawExpeditionPortal() {
      const step = this.add.graphics().setDepth(10);
      step.fillStyle(0x111915, 0.35).fillEllipse(640, 692, 184, 20);
      step.fillStyle(0x584c3b).fillRect(556, 682, 168, 16);
      step.lineStyle(3, 0x271f1a).strokeRect(556, 682, 168, 16);
      step.fillStyle(0x8a7656).fillRect(566, 674, 148, 9);
      step.lineStyle(2, 0x352b22).strokeRect(566, 674, 148, 9);
      step.fillStyle(0xb19b6f).fillRect(574, 674, 16, 3).fillRect(690, 674, 16, 3);

      const aperture = this.add.graphics().setDepth(9.8);
      aperture.fillStyle(0x12251f).fillRect(608, 574, 64, 90);
      aperture.fillStyle(0x0b1715).fillRect(615, 582, 50, 78);
      aperture.lineStyle(2, 0x17221d).strokeRect(608, 574, 64, 90);

      const stones = this.add.graphics().setDepth(10);
      const block = (bx: number, by: number, width: number, height: number, fill: number, outline: number) => {
        stones.fillStyle(fill).fillRect(bx, by, width, height);
        stones.lineStyle(2, outline).strokeRect(bx, by, width, height);
      };
      block(572, 558, 136, 26, 0x786950, 0x30271f);
      block(580, 548, 120, 12, 0x998663, 0x30271f);
      block(572, 576, 36, 82, 0x786950, 0x30271f);
      block(672, 576, 36, 82, 0x786950, 0x30271f);
      block(572, 658, 42, 16, 0x8a785a, 0x30271f);
      block(666, 658, 42, 16, 0x8a785a, 0x30271f);
      stones.fillStyle(0xa3936a).fillRect(578, 562, 24, 5).fillRect(678, 562, 24, 5);
      stones.fillRect(578, 590, 5, 52).fillRect(697, 590, 5, 52);
      stones.fillStyle(0x4e5943).fillRect(584, 592, 4, 13).fillRect(590, 599, 4, 12).fillRect(584, 610, 4, 13);
      stones.fillRect(692, 592, 4, 13).fillRect(686, 599, 4, 12).fillRect(692, 610, 4, 13);
      stones.fillStyle(0xb0a076).fillRect(588, 554, 12, 3).fillRect(680, 554, 12, 3);

      const portalLight = this.add.ellipse(640, 619, 44, 80, 0x78c8ac, 0.44).setDepth(9.9);
        this.tweens.add({ targets: portalLight, alpha: { from: 0.3, to: 0.76 }, scaleX: { from: 0.86, to: 1.08 }, duration: 1050, yoyo: true, repeat: -1 });
      this.add.circle(640, 619, 5, 0xe8df9d, 0.95).setDepth(10.1);
    }

    update() {
      this.handleInteraction();
      this.handleMovement();
      this.updateBlacksmith(this.time.now);
      this.updateMerchant(this.time.now);
      this.updateArchivist(this.time.now);
      this.updateBestiaryKeeper(this.time.now);
    }

    private updateBlacksmith(now: number) {
      if (this.highlightedId === "loadout") {
        this.blacksmith.setX(BLACKSMITH_HOME.x).setFlipX(false);
        this.playBlacksmithAnimation("talking");
        return;
      }

      const phase = now % 18000;
      if (phase < 6500) {
        this.blacksmith.setX(BLACKSMITH_HOME.x).setFlipX(false);
        this.playBlacksmithAnimation("working");
      } else if (phase < 10000 || phase >= 14000) {
        this.blacksmith.setX(BLACKSMITH_HOME.x).setFlipX(false);
        this.playBlacksmithAnimation("idle");
      } else {
        const walkPhase = phase - 10000;
        const movingRight = walkPhase < 2000;
        const progress = movingRight ? walkPhase / 2000 : (walkPhase - 2000) / 2000;
        const offset = movingRight ? progress * 14 : (1 - progress) * 14;
        this.blacksmith.setX(BLACKSMITH_HOME.x + offset).setFlipX(!movingRight);
        this.playBlacksmithAnimation("walking");
      }
    }

    private updateMerchant(now: number) {
      if (this.highlightedId === "merchant") {
        this.merchant.setX(MERCHANT_HOME.x).setFlipX(false);
        this.playMerchantAnimation("talking");
        return;
      }

      const phase = now % 16000;
      if (phase < 7000) {
        this.merchant.setX(MERCHANT_HOME.x).setFlipX(false);
        this.playMerchantAnimation("working");
      } else if (phase < 11000 || phase >= 14000) {
        this.merchant.setX(MERCHANT_HOME.x).setFlipX(false);
        this.playMerchantAnimation("idle");
      } else {
        const walkPhase = phase - 11000;
        const movingRight = walkPhase < 1500;
        const progress = movingRight ? walkPhase / 1500 : (walkPhase - 1500) / 1500;
        const offset = movingRight ? progress * 9 : (1 - progress) * 9;
        this.merchant.setX(MERCHANT_HOME.x + offset).setFlipX(!movingRight);
        this.playMerchantAnimation("walking");
      }
    }

    private updateArchivist(now: number) {
      if (this.highlightedId === "archive") {
        this.archivist.setX(ARCHIVIST_HOME.x).setFlipX(false);
        this.playArchivistAnimation("talking");
        return;
      }

      const phase = now % 20000;
      if (phase < 7000) {
        this.archivist.setX(ARCHIVIST_HOME.x).setFlipX(false);
        this.playArchivistAnimation("working");
      } else if (phase < 11000 || phase >= 15000) {
        this.archivist.setX(ARCHIVIST_HOME.x).setFlipX(false);
        this.playArchivistAnimation("idle");
      } else {
        const walkPhase = phase - 11000;
        const movingRight = walkPhase < 2000;
        const progress = movingRight ? walkPhase / 2000 : (walkPhase - 2000) / 2000;
        const offset = movingRight ? progress * 9 : (1 - progress) * 9;
        this.archivist.setX(ARCHIVIST_HOME.x + offset).setFlipX(!movingRight);
        this.playArchivistAnimation("walking");
      }
    }

    private updateBestiaryKeeper(now: number) {
      if (this.highlightedId === "collection") {
        this.bestiaryKeeper.setX(BESTIARY_KEEPER_HOME.x).setFlipX(false);
        this.playBestiaryKeeperAnimation("talking");
        return;
      }

      const phase = now % 18000;
      if (phase < 7000) {
        this.bestiaryKeeper.setX(BESTIARY_KEEPER_HOME.x).setFlipX(false);
        this.playBestiaryKeeperAnimation("studying");
      } else if (phase < 11000 || phase >= 15000) {
        this.bestiaryKeeper.setX(BESTIARY_KEEPER_HOME.x).setFlipX(false);
        this.playBestiaryKeeperAnimation("idle");
      } else {
        const walkPhase = phase - 11000;
        const movingRight = walkPhase < 2000;
        const progress = movingRight ? walkPhase / 2000 : (walkPhase - 2000) / 2000;
        const offset = movingRight ? progress * 10 : (1 - progress) * 10;
        this.bestiaryKeeper.setX(BESTIARY_KEEPER_HOME.x + offset).setFlipX(!movingRight);
        this.playBestiaryKeeperAnimation("walking");
      }
    }

    private handleMovement() {
      let x = 0;
      let y = 0;
      if (this.keys.left.isDown) x -= 1;
      if (this.keys.right.isDown) x += 1;
      if (this.keys.up.isDown) y -= 1;
      if (this.keys.down.isDown) y += 1;

      const touch = bridge.getInput();
      x += touch.moveX + this.gamepad.moveX;
      y += touch.moveY + this.gamepad.moveY;
      let magnitude = Math.hypot(x, y);
      if (magnitude > 0.08) {
        this.clearClickPath();
        if (magnitude > 1) {
          x /= magnitude;
          y /= magnitude;
          magnitude = 1;
        }
      } else {
        const clickVector = this.getClickMovementVector();
        x = clickVector?.x ?? 0;
        y = clickVector?.y ?? 0;
        magnitude = clickVector ? 1 : 0;
      }
      this.player.setVelocity(x * PLAYER_SPEED, y * PLAYER_SPEED);
      if (magnitude < 0.001) {
        playCartographerPlayerAnimation(this.player, "idle");
      } else if (Math.abs(x) > Math.abs(y)) {
        playCartographerPlayerAnimation(this.player, x < 0 ? "walk-left" : "walk-right");
      } else {
        playCartographerPlayerAnimation(this.player, y < 0 ? "walk-up" : "walk-down");
      }
    }

    private setClickDestination(pointer: import("phaser").Input.Pointer) {
      if (pointer.button !== 0 && !pointer.wasTouch) return;
      const path = findGridPath(this.navigation, this.player, { x: pointer.worldX, y: pointer.worldY });
      this.clickPath = path?.slice(1) ?? [];
      this.clickPathIndex = 0;
    }

    private getClickMovementVector() {
      while (this.clickPathIndex < this.clickPath.length) {
        const target = this.clickPath[this.clickPathIndex];
        const dx = target.x - this.player.x;
        const dy = target.y - this.player.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 16) return { x: dx / distance, y: dy / distance };
        this.clickPathIndex += 1;
      }
      this.clearClickPath();
      return null;
    }

    private clearClickPath() {
      this.clickPath = [];
      this.clickPathIndex = 0;
    }

    private handleInteraction() {
      const gamepadResult = readBrowserGamepad(this.gamepadPressedButtons);
      this.gamepad = gamepadResult.frame;
      this.gamepadPressedButtons = gamepadResult.pressedButtons;
      const nearest = findNearestHubStation(this.player.x, this.player.y);
      this.updateHighlight(nearest?.id ?? null);
      const interact = Phaser.Input.Keyboard.JustDown(this.keys.interact)
        || bridge.consumeInteract()
        || this.gamepad.interactPressed;
      if (interact && nearest) onNavigate(nearest.id);
    }

    private updateHighlight(nextId: HubDestinationId | null) {
      if (nextId === this.highlightedId) return;
      if (this.highlightedId) {
        const previous = this.stationVisuals.get(this.highlightedId);
        previous?.setStrokeStyle(4, 0xf0d79a, 0.52).setScale(1);
      }
      this.highlightedId = nextId;
      if (!nextId) {
        onPrompt("Explore a Guilda. Aproxime-se de uma estação e pressione E.");
        return;
      }
      const station = HUB_STATIONS.find((item) => item.id === nextId);
      const visual = this.stationVisuals.get(nextId);
      visual?.setStrokeStyle(6, 0xffefb0, 1).setScale(1.04);
      if (station?.id === "loadout") {
        onPrompt(`Mestre da Forja: Arsenal · pressione E para entrar.`);
      } else if (station?.id === "archive") {
        onPrompt("Arquivista: aprenda ataques das lendas por moedas e escolha dois. Pressione E para entrar.");
      } else if (station?.id === "avatar") {
        onPrompt("Ateliê do Cartógrafo: personalize seu próprio personagem. Pressione E para entrar.");
      } else if (station?.id === "collection") {
        onPrompt("Luzia, naturalista: cada povo conta a lenda a seu modo. Pressione E para ver registros e origens.");
      } else if (station) {
        onPrompt(`${station.kicker}: ${station.label} · pressione E para entrar.`);
      }
    }
  };
}
