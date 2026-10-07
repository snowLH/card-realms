import { buildHubNavigation, HUB_STATIONS, HUB_WORLD, findNearestHubStation, type HubDestinationId } from "../hub/content";
import { PLAYABLE_LEGEND_BY_ID, type PlayableLegendId } from "../content/legends";
import { findGridPath, type GridNavigation, type WorldPoint } from "../navigation/grid-path";
import { readBrowserGamepad, type GamepadFrame } from "./gamepad";
import type { ArpgBridge } from "./bridge";
import { ArpgAudio } from "./arpg-audio";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_ASSET_MANIFEST } from "../assets";
import { getPixelArtTextureKey } from "./pixel-art-sheet";
import { GENERATED_SPRITE_FRAME_SIZE, queueGeneratedLegendSpriteSheet } from "./legend-sprite-sheets";
import {
  createNativePixelActorSheet,
  NATIVE_PIXEL_ACTOR_ANIMATION_MAP,
  NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE,
  type NativePixelActorAnimation,
  type NativePixelActorId,
} from "./native-pixel-actors";

type PhaserModule = typeof import("phaser");
type ArcadeSprite = import("phaser").Physics.Arcade.Sprite;
type Key = import("phaser").Input.Keyboard.Key;

const PLAYER_SPEED = 230;
const GUILD_BACKGROUND_TEXTURE = "folklard-guild-hall-background-v2";
const GUILD_BACKGROUND_PATH = "/art/guild-room-wide-background-v2.webp";
const NATIVE_PLAYER_FRAME_SIZE = 32;
const NATIVE_PLAYER_SCALE = 2.5;
const GUILD_CHARACTER_SCALE = (NATIVE_PLAYER_FRAME_SIZE * NATIVE_PLAYER_SCALE) / GENERATED_SPRITE_FRAME_SIZE;
// Target visible height for the selection alcove. Scale each sprite from its
// alpha bounds so transparent padding and tall silhouettes do not change the
// apparent character size.
const GUILD_LEGEND_VISIBLE_HEIGHT = 50;
const GUILD_LEGEND_GALLERY_SCALE_FALLBACK = 0.29;
const GUILD_CHARACTER_SCALE_BY_ACTOR: Readonly<Partial<Record<NativePixelActorId, number>>> = {
  curupira: 0.343,
  iara: 0.297,
  boto: 0.276,
  kappa: 0.286,
  raiju: 0.272,
  blacksmith: 0.321,
  merchant: 0.287,
  archivist: 0.274,
  bestiaryKeeper: 0.277,
};
const NATIVE_PLAYER_CYCLES = ["walk", "attack", "shoot", "damage", "defeat"] as const;
const BLACKSMITH_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.blacksmith;
const BLACKSMITH_TEXTURE = getPixelArtTextureKey(BLACKSMITH_ASSET.textureKey);
const BLACKSMITH_HOME = { x: 344, y: 254 };
const MERCHANT_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.merchant;
const MERCHANT_TEXTURE = getPixelArtTextureKey(MERCHANT_ASSET.textureKey);
const MERCHANT_HOME = { x: 830, y: 484 };
const ARCHIVIST_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.archivist;
const ARCHIVIST_TEXTURE = getPixelArtTextureKey(ARCHIVIST_ASSET.textureKey);
const ARCHIVIST_HOME = { x: 455, y: 452 };
const BESTIARY_KEEPER_ASSET = ARPG_ASSET_MANIFEST.guildNpcs.bestiaryKeeper;
const BESTIARY_KEEPER_TEXTURE = getPixelArtTextureKey(BESTIARY_KEEPER_ASSET.textureKey);
const BESTIARY_KEEPER_HOME = { x: 870, y: 310 };
const GUILD_PIXEL_ACTORS = [
  ["blacksmith", BLACKSMITH_ASSET],
  ["merchant", MERCHANT_ASSET],
  ["archivist", ARCHIVIST_ASSET],
  ["bestiaryKeeper", BESTIARY_KEEPER_ASSET],
] as const;
const GUILD_PLAYABLE_LEGENDS = [
  // Keep the character alcove on the east side of the hall, clear of the
  // Events sign and the walking lane between the merchant and portal.
  { actorId: "curupira", x: 1115, y: 345, flipX: false },
  { actorId: "iara", x: 1195, y: 345, flipX: true },
  { actorId: "boto", x: 1115, y: 435, flipX: true },
  { actorId: "amarok", x: 1195, y: 435, flipX: false },
] as const satisfies ReadonlyArray<{ actorId: PlayableLegendId; x: number; y: number; flipX: boolean }>;

const GUILD_ANIMATION_CYCLES: Readonly<Record<string, NativePixelActorAnimation>> = {
  idle: "idle",
  walking: "walk",
  talking: "attack",
  working: "shoot",
  studying: "shoot",
};

function getNativePlayerTextureKey(actorId: NativePixelActorId) {
  return getPixelArtTextureKey(`folklard-guild-player-${actorId}`);
}

function getGuildLegendTextureKey(actorId: NativePixelActorId) {
  return getPixelArtTextureKey(`folklard-guild-legend-${actorId}`);
}

function getGuildCharacterScale(actorId: NativePixelActorId) {
  return GUILD_CHARACTER_SCALE_BY_ACTOR[actorId] ?? GUILD_CHARACTER_SCALE;
}

function getNativePlayerAnimationKey(actorId: NativePixelActorId, animation: NativePixelActorAnimation) {
  return `guild-player-${actorId}-${animation}`;
}

function registerNativePlayerAnimations(scene: import("phaser").Scene, actorId: NativePixelActorId) {
  const textureKey = getNativePlayerTextureKey(actorId);
  const animationRows = NATIVE_PIXEL_ACTOR_ANIMATION_MAP[actorId];
  for (const name of NATIVE_PLAYER_CYCLES) {
    const key = getNativePlayerAnimationKey(actorId, name);
    if (scene.anims.exists(key)) continue;
    const start = animationRows[name] * NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start,
        end: start + NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE - 1,
      }),
      frameRate: name === "walk" ? 9 : name === "defeat" ? 6 : 10,
      repeat: name === "walk" ? -1 : 0,
    });
  }
}

function playNativePlayerAnimation(
  sprite: ArcadeSprite,
  actorId: NativePixelActorId,
  animation: NativePixelActorAnimation,
  restart = false,
) {
  const key = getNativePlayerAnimationKey(actorId, animation);
  if (restart || sprite.anims.currentAnim?.key !== key) sprite.play(key);
}

function setNativePlayerRestPose(sprite: ArcadeSprite, actorId: NativePixelActorId) {
  sprite.anims.stop();
  sprite.setFrame(NATIVE_PIXEL_ACTOR_ANIMATION_MAP[actorId].idle * NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE);
}

function setGuildActorRestPose(sprite: import("phaser").GameObjects.Sprite, actorId: NativePixelActorId) {
  sprite.anims.stop();
  sprite.setFrame(NATIVE_PIXEL_ACTOR_ANIMATION_MAP[actorId].idle * NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE);
}

function registerGuildNativeActorAnimations(
  scene: import("phaser").Scene,
  actorId: NativePixelActorId,
  textureKey: string,
  definition: (typeof GUILD_PIXEL_ACTORS)[number][1],
) {
  const animations = definition.animations as Readonly<Record<string, { frameRate: number; repeat: number }>>;
  const actorRows = NATIVE_PIXEL_ACTOR_ANIMATION_MAP[actorId];
  for (const [name, animation] of Object.entries(animations)) {
    const cycle = GUILD_ANIMATION_CYCLES[name];
    if (!cycle) continue;
    const key = `${definition.animationKeyPrefix!}-${name}`;
    if (scene.anims.exists(key)) continue;
    const start = actorRows[cycle] * NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start,
        end: start + NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE - 1,
      }),
      frameRate: animation.frameRate,
      repeat: animation.repeat,
    });
  }
}

export function createArpgHubScene(
  Phaser: PhaserModule,
  bridge: ArpgBridge,
  onNavigate: (destination: HubDestinationId, legendId?: PlayableLegendId) => void,
  onPrompt: (message: string) => void,
  avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
) {
  const playerActorId: NativePixelActorId = avatarConfig.legendId;
  const playerTextureKey = getNativePlayerTextureKey(playerActorId);
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
    private guildLegends: import("phaser").GameObjects.Sprite[] = [];
    private generatedBackgroundActive = false;
    private navigation!: GridNavigation;
    private clickPath: WorldPoint[] = [];
    private clickPathIndex = 0;
    // Direct movement is the normal game flow. Click-to-move remains available
    // as an explicit accessibility option through ?clickToMove=1.
    private clickToMoveEnabled = false;

    constructor() {
      super("card-realms-hub");
    }
    preload() {
      this.load.image(GUILD_BACKGROUND_TEXTURE, GUILD_BACKGROUND_PATH);
      queueGeneratedLegendSpriteSheet(this, playerActorId, playerTextureKey);
      for (const [actorId, definition] of GUILD_PIXEL_ACTORS) {
        queueGeneratedLegendSpriteSheet(
          this,
          actorId,
          getPixelArtTextureKey(definition.textureKey),
        );
      }
      for (const { actorId } of GUILD_PLAYABLE_LEGENDS) {
        queueGeneratedLegendSpriteSheet(this, actorId, getGuildLegendTextureKey(actorId));
      }
    }
    create() {
      this.clickToMoveEnabled = typeof window !== "undefined"
        && new URLSearchParams(window.location.search).get("clickToMove") === "1";
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
      this.generatedBackgroundActive = this.textures.exists(GUILD_BACKGROUND_TEXTURE);
      if (this.generatedBackgroundActive) {
        this.add.image(0, 0, GUILD_BACKGROUND_TEXTURE)
          .setOrigin(0, 0)
          .setDisplaySize(HUB_WORLD.width, HUB_WORLD.height)
          .setDepth(0);
      } else {
        this.drawGuildHall();
      }
      if (!this.textures.exists(playerTextureKey)) {
        createNativePixelActorSheet(
          this,
          playerActorId,
          playerTextureKey,
          NATIVE_PLAYER_FRAME_SIZE,
          NATIVE_PLAYER_FRAME_SIZE,
        );
      }
      registerNativePlayerAnimations(this, playerActorId);
      for (const [actorId, definition] of GUILD_PIXEL_ACTORS) {
        const textureKey = getPixelArtTextureKey(definition.textureKey);
        if (!this.textures.exists(textureKey)) {
          createNativePixelActorSheet(
            this,
            actorId,
            textureKey,
            definition.frameWidth,
            definition.frameHeight,
          );
        }
      }
      this.drawStations();
      this.createBlacksmith();
      this.createMerchant();
      this.createArchivist();
      this.createBestiaryKeeper();
      this.createPlayableLegendGallery(onNavigate);

      this.player = this.physics.add.sprite(HUB_WORLD.spawnX, HUB_WORLD.spawnY, playerTextureKey, 0);
      const playerScale = this.player.texture.getSourceImage().width === GENERATED_SPRITE_FRAME_SIZE * 4
        ? getGuildCharacterScale(playerActorId)
        : NATIVE_PLAYER_SCALE;
      this.player
        .setOrigin(0.5, 0.82)
        .setDepth(20)
        .setCollideWorldBounds(true)
        .setScale(playerScale);
      const playerFrameSize = playerScale === NATIVE_PLAYER_SCALE ? NATIVE_PLAYER_FRAME_SIZE : GENERATED_SPRITE_FRAME_SIZE;
      const playerRadius = playerScale === NATIVE_PLAYER_SCALE ? 5 : 40;
      const playerGroundY = playerScale === NATIVE_PLAYER_SCALE ? 23 : 202;
      this.player.setCircle(playerRadius, playerFrameSize / 2 - playerRadius, playerGroundY - playerRadius);
      setNativePlayerRestPose(this.player, playerActorId);
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
      if (this.clickToMoveEnabled) {
        this.input.on("pointerdown", this.setClickDestination, this);
        this.events.once("shutdown", () => this.input.off("pointerdown", this.setClickDestination, this));
      }
      onPrompt(
        this.clickToMoveEnabled
          ? "WASD, joystick ou direcional movem sua Lenda. Clique ou toque no chão é a assistência de movimento ativa; aproxime-se de uma estação e pressione E."
          : "WASD, joystick ou direcional movem sua Lenda. Aproxime-se de uma estação e pressione E para interagir.",
      );
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

      // Soft pools break up the tiled floor and give the plaza a warm, lived-in center.
      floor.fillStyle(0xb18d56, 0.055).fillEllipse(HUB_WORLD.width / 2, 360, 480, 268);
      floor.fillStyle(0x789679, 0.035).fillEllipse(640, 176, 580, 236);
      floor.fillStyle(0x8e7650, 0.045).fillEllipse(640, 600, 436, 156);

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

        // Layered stone runners read as connected routes instead of broad flat brown bands.
        paths.lineStyle(48, 0x17231e, 0.9).beginPath().moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => paths.lineTo(point.x, point.y));
        paths.strokePath();
        paths.lineStyle(32, 0x4d5140, 0.98).beginPath().moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => paths.lineTo(point.x, point.y));
        paths.strokePath();
        paths.lineStyle(18, 0x9a8a60, 0.3).beginPath().moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => paths.lineTo(point.x, point.y));
        paths.strokePath();

        for (let pointIndex = 2; pointIndex < points.length - 2; pointIndex += 2) {
          const point = points[pointIndex];
          const previous = points[pointIndex - 1];
          const next = points[pointIndex + 1];
          const tangentX = next.x - previous.x;
          const tangentY = next.y - previous.y;
          const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY));
          const normalX = -tangentY / tangentLength;
          const normalY = tangentX / tangentLength;

          // Short joints and worn brass flecks add a hand-laid paving rhythm to each route.
          paths.lineStyle(1, 0x302f27, 0.68).beginPath()
            .moveTo(point.x - normalX * 16, point.y - normalY * 16)
            .lineTo(point.x + normalX * 16, point.y + normalY * 16)
            .strokePath();
          if (pointIndex % 4 === 2) {
            paths.fillStyle(0xc0a56d, 0.56).fillRect(point.x - 2, point.y - 2, 4, 4);
          }
        }
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

      this.add.polygon(plazaCenter.x, plazaCenter.y, [
        -186, -70, -154, -112, 154, -112, 186, -70,
        186, 70, 154, 112, -154, 112, -186, 70,
      ], 0x26372f, 0.96).setStrokeStyle(7, 0x725d3d, 0.96).setDepth(2);
      this.add.polygon(plazaCenter.x, plazaCenter.y, [
        -164, -61, -139, -96, 139, -96, 164, -61,
        164, 61, 139, 96, -139, 96, -164, 61,
      ], 0x354337, 0.94).setStrokeStyle(2, 0xb0935c, 0.7).setDepth(2);
      const inlays = this.add.graphics().setDepth(3);
      inlays.fillStyle(0xa58a57, 0.72);
      inlays.fillRect(plazaCenter.x - 176, plazaCenter.y - 53, 16, 6)
        .fillRect(plazaCenter.x + 160, plazaCenter.y - 53, 16, 6)
        .fillRect(plazaCenter.x - 176, plazaCenter.y + 47, 16, 6)
        .fillRect(plazaCenter.x + 160, plazaCenter.y + 47, 16, 6);
      this.add.polygon(plazaCenter.x, plazaCenter.y, [
        -154, -26, -136, -48, 136, -48, 154, -26,
        154, 26, 136, 48, -136, 48, -154, 26,
      ], 0x1c2924, 0.96).setStrokeStyle(4, 0xa77a42, 0.9).setDepth(3);
      this.add.polygon(plazaCenter.x, plazaCenter.y, [
        -143, -19, -128, -39, 128, -39, 143, -19,
        143, 19, 128, 39, -128, 39, -143, 19,
      ], 0x29362e, 0.9).setStrokeStyle(2, 0xd1a85c, 0.45).setDepth(3);
      const guildPlate = this.add.graphics().setDepth(3);
      guildPlate.fillStyle(0x171f1d, 0.94).fillRect(462, 281, 356, 66);
      guildPlate.lineStyle(3, 0xb0935c, 0.94).strokeRect(462, 281, 356, 66);
      guildPlate.fillStyle(0x725d3d, 0.96).fillRect(472, 286, 4, 56).fillRect(804, 286, 4, 56);
      guildPlate.fillStyle(0xd1a85c, 0.74).fillRect(487, 340, 306, 2);
      guildPlate.fillStyle(0xd5bc7b, 0.78)
        .fillRect(468, 286, 4, 4).fillRect(808, 286, 4, 4)
        .fillRect(468, 338, 4, 4).fillRect(808, 338, 4, 4);
      this.add.text(640, 304, "GUILDA DOS CARTÓGRAFOS", {
        fontFamily: "monospace", fontSize: "21px", color: "#f2d58b", stroke: "#201519", strokeThickness: 4,
      }).setOrigin(0.5).setDepth(3);
      this.add.text(640, 328, "AURÓRIA · ARQUIVO E EXPEDIÇÕES", {
        fontFamily: "monospace", fontSize: "10px", color: "#d4c7a4",
      }).setOrigin(0.5).setDepth(3);
      [[76, 130], [1204, 130], [76, 650], [1204, 650]].forEach(([x, y]) => {
        this.add.circle(x, y, 13, 0xf3b84b, 0.74).setDepth(4);
        this.add.circle(x, y, 28, 0xf3b84b, 0.08).setDepth(3);
      });
    }

    private createBlacksmith() {
      registerGuildNativeActorAnimations(this, "blacksmith", BLACKSMITH_TEXTURE, BLACKSMITH_ASSET);

      this.blacksmith = this.add.sprite(BLACKSMITH_HOME.x, BLACKSMITH_HOME.y, BLACKSMITH_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(getGuildCharacterScale("blacksmith"))
        .setDepth(19);
      setGuildActorRestPose(this.blacksmith, "blacksmith");
      this.scheduleNpcBlink(this.blacksmith, "blacksmith", 4400);
    }

    private createMerchant() {
      registerGuildNativeActorAnimations(this, "merchant", MERCHANT_TEXTURE, MERCHANT_ASSET);

      this.merchant = this.add.sprite(MERCHANT_HOME.x, MERCHANT_HOME.y, MERCHANT_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(getGuildCharacterScale("merchant"))
        .setDepth(10);
      setGuildActorRestPose(this.merchant, "merchant");
      this.scheduleNpcBlink(this.merchant, "merchant", 5100);
    }

    private createArchivist() {
      registerGuildNativeActorAnimations(this, "archivist", ARCHIVIST_TEXTURE, ARCHIVIST_ASSET);

      this.archivist = this.add.sprite(ARCHIVIST_HOME.x, ARCHIVIST_HOME.y, ARCHIVIST_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(getGuildCharacterScale("archivist"))
        .setDepth(19);
      setGuildActorRestPose(this.archivist, "archivist");
      this.scheduleNpcBlink(this.archivist, "archivist", 4700);
    }

    private createBestiaryKeeper() {
      registerGuildNativeActorAnimations(this, "bestiaryKeeper", BESTIARY_KEEPER_TEXTURE, BESTIARY_KEEPER_ASSET);

      this.bestiaryKeeper = this.add.sprite(
        BESTIARY_KEEPER_HOME.x,
        BESTIARY_KEEPER_HOME.y,
        BESTIARY_KEEPER_TEXTURE,
        0,
      )
        .setOrigin(0.5, 0.82)
        .setScale(getGuildCharacterScale("bestiaryKeeper"))
        .setDepth(19);
      this.add.text(BESTIARY_KEEPER_HOME.x, BESTIARY_KEEPER_HOME.y - 59, "Luzia · Naturalista", {
        fontFamily: "monospace", fontSize: "10px", color: "#e4edbd",
        stroke: "#261719", strokeThickness: 4,
      }).setOrigin(0.5).setDepth(19);
      setGuildActorRestPose(this.bestiaryKeeper, "bestiaryKeeper");
      this.scheduleNpcBlink(this.bestiaryKeeper, "bestiaryKeeper", 5800);
    }

    private scheduleNpcBlink(sprite: import("phaser").GameObjects.Sprite, actorId: NativePixelActorId, delay: number) {
      const baseFrame = NATIVE_PIXEL_ACTOR_ANIMATION_MAP[actorId].idle * NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE;
      this.time.addEvent({
        delay,
        loop: true,
        callback: () => {
          if (!sprite.active) return;
          sprite.setFrame(baseFrame + 1);
          this.time.delayedCall(110, () => {
            if (sprite.active) sprite.setFrame(baseFrame);
          });
        },
      });
    }

    private createPlayableLegendGallery(onNavigate: (destination: HubDestinationId, legendId?: PlayableLegendId) => void) {
      this.guildLegends = GUILD_PLAYABLE_LEGENDS.flatMap(({ actorId, x, y, flipX }, index) => {
        const textureKey = getGuildLegendTextureKey(actorId);
        if (!this.textures.exists(textureKey)) return [];
        const definition = PLAYABLE_LEGEND_BY_ID.get(actorId);
        const name = definition?.name ?? actorId;
        const card = this.add.graphics().setDepth(16);
        card.fillStyle(0x201c1a, 0.82).fillRect(x - 34, y - 50, 68, 84);
        card.lineStyle(3, 0x171311, 0.98).strokeRect(x - 34, y - 50, 68, 84);
        card.lineStyle(1, 0xd0a961, 0.86).strokeRect(x - 31, y - 47, 62, 78);
        card.fillStyle(0x141a16, 0.66).fillEllipse(x, y + 8, 47, 12);

        const legend = this.add.sprite(x, y, textureKey, 0)
          .setOrigin(0.5, 0.82)
          .setScale(this.getGuildGalleryScale(textureKey))
          .setFlipX(flipX)
          .setDepth(18);
        this.add.text(x, y + 19, name, {
          fontFamily: "monospace", fontSize: "8px", fontStyle: "bold", color: "#fff0bd",
          stroke: "#261719", strokeThickness: 3,
        }).setOrigin(0.5).setDepth(20);
        this.add.text(x, y + 29, "ESCOLHER", {
          fontFamily: "monospace", fontSize: "6px", fontStyle: "bold", color: "#d9c27f",
          stroke: "#261719", strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);
        const hitArea = this.add.zone(x, y - 6, 68, 84)
          .setInteractive({ useHandCursor: true })
          .setDepth(22);
        hitArea.on("pointerdown", (
          _pointer: import("phaser").Input.Pointer,
          _localX: number,
          _localY: number,
          event: import("phaser").Types.Input.EventData,
        ) => {
          event.stopPropagation();
          onNavigate("avatar", actorId);
        });
        setGuildActorRestPose(legend, actorId);
        this.scheduleNpcBlink(legend, actorId, 3600 + index * 430);
        return [legend];
      });
    }

    private getGuildGalleryScale(textureKey: string) {
      const source = this.textures.get(textureKey).getSourceImage() as CanvasImageSource;
      const canvas = document.createElement("canvas");
      canvas.width = GENERATED_SPRITE_FRAME_SIZE;
      canvas.height = GENERATED_SPRITE_FRAME_SIZE;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return GUILD_LEGEND_GALLERY_SCALE_FALLBACK;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        source,
        0,
        0,
        GENERATED_SPRITE_FRAME_SIZE,
        GENERATED_SPRITE_FRAME_SIZE,
        0,
        0,
        GENERATED_SPRITE_FRAME_SIZE,
        GENERATED_SPRITE_FRAME_SIZE,
      );
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let top = canvas.height;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3];
          if (alpha < 24) continue;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      const visibleHeight = bottom - top + 1;
      if (visibleHeight <= 0) return GUILD_LEGEND_GALLERY_SCALE_FALLBACK;
      return Math.min(0.42, Math.max(0.18, GUILD_LEGEND_VISIBLE_HEIGHT / visibleHeight));
    }

    private drawStations() {
      HUB_STATIONS.forEach((station) => {
        const stationScale = station.id === "refuge" ? 0.78 : 1;
        if (station.id === "archive" || station.id === "portal" || station.id === "expeditions") {
          this.add.ellipse(station.x, station.y + 15, 182, 88, station.tint, 0.055)
            .setAlpha(this.generatedBackgroundActive ? 0.35 : 1)
            .setDepth(5);
        }
        const visual = this.add.ellipse(station.x, station.y + 13, 178 * stationScale, 82 * stationScale, station.tint, 0.1)
          .setAlpha(this.generatedBackgroundActive ? 0.26 : 0.52)
          .setStrokeStyle(2, station.tint, 0.2)
          .setDepth(7);
        if (this.clickToMoveEnabled) {
          visual.setInteractive({ useHandCursor: true });
          visual.on("pointerdown", (pointer: import("phaser").Input.Pointer) => {
            this.setClickDestination(pointer);
          });
        }
        this.stationVisuals.set(station.id, visual);
        if (!this.generatedBackgroundActive) {
          this.drawStationProp(station.id, station.x, station.y + 8, station.tint);
        }
        if (station.id === "loadout") {
          this.drawStationSign(station.label, station.kicker, station.x, 142, 174);
        } else if (station.id === "archive") {
          this.drawStationSign(station.label, undefined, station.x, 361, 202);
        } else if (station.id === "portal") {
          this.drawStationSign(station.label, station.kicker, station.x, 516, 220);
        } else if (station.id === "expeditions") {
          this.drawStationSign(station.label, station.kicker, station.x, 91, 156);
        } else if (station.id === "collection") {
          this.drawStationSign(station.label, station.kicker, station.x, 154, 142);
        } else if (station.id === "avatar") {
          this.drawStationSign(station.label, station.kicker, station.x, 258, 222);
        } else if (station.id === "merchant") {
          this.drawStationSign(station.label, station.kicker, station.x, 374, 154);
        } else if (station.id === "refuge") {
          this.drawStationSign(station.label, station.kicker, station.x, 430, 150);
        } else if (station.id === "raid") {
          this.drawStationSign(station.label, station.kicker, station.x, 430, 146);
        } else {
          this.drawStationSign(station.label, station.kicker, station.x, 486, 154);
        }
      });
    }

    private drawStationSign(label: string, kicker: string | undefined, x: number, y: number, width: number) {
      const sign = this.add.graphics().setDepth(11);
      const height = kicker ? 34 : 26;
      width = Math.max(width * 0.78, label.length * 7 + 20, kicker ? kicker.length * 5 + 20 : 0);
      sign.fillStyle(0x30241e, 1).fillRect(x - width / 2, y - height / 2, width, height);
      sign.lineStyle(4, 0x1c151a, 1).strokeRect(x - width / 2, y - height / 2, width, height);
      sign.lineStyle(2, 0xd0a961, 1).strokeRect(x - width / 2 + 3, y - height / 2 + 3, width - 6, height - 6);
      sign.fillStyle(0x59412b, 1).fillRect(x - width / 2 + 4, y - height / 2 + 4, 4, height - 8);
      sign.fillRect(x + width / 2 - 8, y - height / 2 + 4, 4, height - 8);
      this.add.text(x, y - (kicker ? 7 : 0), label, {
        fontFamily: "monospace", fontSize: "11px", fontStyle: "bold", color: "#fff0bd",
        stroke: "#261719", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12);
      if (kicker) {
        this.add.text(x, y + 10, kicker, {
          fontFamily: "monospace", fontSize: "8px", color: "#f1dba8",
          stroke: "#261719", strokeThickness: 2,
        }).setOrigin(0.5).setDepth(12);
      }
    }

    private drawStationProp(id: HubDestinationId, x: number, y: number, tint: number) {
      if (id === "expeditions") {
        this.add.ellipse(x, y + 37, 166, 22, 0x121b17, 0.52).setDepth(8);
        const chart = this.add.graphics().setDepth(8);
        chart.fillStyle(0x4b3428).fillRect(x - 68, y - 58, 136, 52);
        chart.lineStyle(3, 0x241a17).strokeRect(x - 68, y - 58, 136, 52);
        chart.fillStyle(0xd1b77a).fillRect(x - 61, y - 52, 122, 40);
        chart.lineStyle(1, 0x8e7045, 0.95).strokeRect(x - 61, y - 52, 122, 40);
        chart.lineStyle(2, 0x52715f, 0.96).beginPath()
          .moveTo(x - 51, y - 21).lineTo(x - 31, y - 40).lineTo(x - 9, y - 33)
          .lineTo(x + 14, y - 46).lineTo(x + 42, y - 31).strokePath();
        chart.lineStyle(1, 0x9e7446, 0.9).beginPath()
          .moveTo(x - 47, y - 43).lineTo(x - 26, y - 30).lineTo(x - 7, y - 43)
          .lineTo(x + 17, y - 25).lineTo(x + 44, y - 48).strokePath();
        chart.fillStyle(0x873f39).fillRect(x - 34, y - 42, 5, 5).fillRect(x + 17, y - 28, 5, 5);
        chart.fillStyle(0x52715f).fillRect(x + 41, y - 47, 5, 5);
        this.add.rectangle(x, y + 18, 154, 32, 0x70482f).setStrokeStyle(3, 0x2b1815).setDepth(9);
        this.add.rectangle(x, y + 5, 164, 12, 0x9a7049).setStrokeStyle(2, 0x33211a).setDepth(10);
        this.add.rectangle(x - 59, y + 30, 9, 30, 0x4b3023).setDepth(9);
        this.add.rectangle(x + 59, y + 30, 9, 30, 0x4b3023).setDepth(9);
        this.add.rectangle(x - 12, y + 4, 83, 20, 0xd7bd80).setStrokeStyle(2, 0x7f6139).setDepth(11).setAngle(-3);
        this.add.line(x - 11, y + 4, -30, -4, 27, 4, 0x8f7044, 0.9).setLineWidth(2).setDepth(12);
        this.add.circle(x + 52, y + 2, 12, 0x493c2a).setStrokeStyle(3, 0xe1b95c).setDepth(11);
        this.add.line(x + 52, y + 2, 0, -8, 5, 7, 0xf3d47b).setLineWidth(2).setDepth(12);
        this.add.rectangle(x - 56, y - 1, 26, 7, 0x7e5132).setStrokeStyle(1, 0x301f19).setDepth(11).setAngle(-13);
        this.add.circle(x + 28, y - 1, 4, 0x91bdd1).setStrokeStyle(2, 0x304756).setDepth(12);
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
        this.add.ellipse(x, y + 34, 78, 17, 0x111a16, 0.42).setDepth(8);
        this.add.polygon(x, y + 1, [0, -23, 38, 10, -38, 10], 0x66432e)
          .setStrokeStyle(3, 0x2a1815).setDepth(9);
        this.add.rectangle(x, y + 22, 62, 31, 0x8c5c3c).setStrokeStyle(3, 0x2a1815).setDepth(10);
        this.add.rectangle(x, y + 20, 52, 22, 0xc4a177).setStrokeStyle(2, 0x4c3025).setDepth(11);
        this.add.rectangle(x - 17, y + 16, 14, 12, 0x557d77).setStrokeStyle(2, 0x3a2920).setDepth(12);
        this.add.rectangle(x + 9, y + 29, 13, 24, 0x67432f).setStrokeStyle(2, 0x2b1c18).setDepth(12);
        this.add.circle(x + 27, y + 23, 7, 0x315f3b).setStrokeStyle(2, 0x1d3524).setDepth(12);
        this.add.rectangle(x + 27, y + 31, 10, 7, 0x865638).setDepth(12);
        return;
      }
      if (id === "raid") {
        this.add.ellipse(x, y + 23, 94, 34, 0x111a17, 0.4).setDepth(8);
        this.add.circle(x, y + 8, 34, tint, 0.24).setStrokeStyle(4, tint, 0.46).setDepth(9);
        this.add.circle(x, y + 8, 22, 0x241b25, 0.78).setStrokeStyle(2, 0xd99ab6, 0.42).setDepth(10);
        this.add.circle(x, y + 8, 8, 0xb86d91, 0.58).setDepth(11);
        return;
      }
      if (id === "portal") {
        this.drawExpeditionPortal();
        return;
      }
      if (id === "altar") {
        this.add.rectangle(x, y + 27, 98, 18, 0x3b2e3c).setStrokeStyle(3, 0x1e151f).setDepth(9);
        this.add.rectangle(x, y + 12, 66, 20, 0x54435f).setStrokeStyle(2, 0xa78bc0).setDepth(10);
        this.add.circle(x, y - 2, 18, 0x6f91bc, 0.2).setStrokeStyle(2, 0xc9dcf4, 0.48).setDepth(11);
        this.add.polygon(x, y - 2, [0, -13, 10, 0, 0, 13, -10, 0], tint, 0.9).setStrokeStyle(2, 0xf1e1ad, 0.78).setDepth(12);
        this.add.circle(x, y - 2, 30).setStrokeStyle(2, tint, 0.2).setDepth(10);
        this.add.circle(x, y - 2, 28).setStrokeStyle(1, tint, 0.1).setDepth(10);
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
      this.add.ellipse(500, 421, 118, 106, 0x37577a, 0.16)
        .setStrokeStyle(3, 0x9bc8d3, 0.54).setDepth(7);
      this.add.ellipse(500, 421, 88, 78, 0x2d4663, 0.2)
        .setStrokeStyle(1, 0x789db6, 0.7).setDepth(7);
      const sealMarks = this.add.graphics().setDepth(8);
      sealMarks.fillStyle(0xc0d9cd, 0.9);
      [[500, 362], [558, 421], [500, 480], [442, 421]].forEach(([x, y]) => {
        sealMarks.fillRect(x - 2, y - 7, 4, 14).fillRect(x - 6, y - 2, 12, 4);
      });
      sealMarks.fillStyle(0x98c5d4, 0.75);
      [[460, 380], [540, 380], [460, 462], [540, 462]].forEach(([x, y]) => {
        sealMarks.fillRect(x - 3, y - 3, 6, 6);
      });

      const sideShelves = this.add.graphics().setDepth(8);
      sideShelves.fillStyle(0x28211f).fillRect(407, 386, 44, 60).fillRect(549, 386, 44, 60);
      sideShelves.lineStyle(2, 0x604838, 0.95).strokeRect(407, 386, 44, 60).strokeRect(549, 386, 44, 60);
      sideShelves.fillStyle(0x75523b).fillRect(411, 401, 36, 4).fillRect(411, 422, 36, 4)
        .fillRect(553, 401, 36, 4).fillRect(553, 422, 36, 4);
      sideShelves.fillStyle(0x934b42).fillRect(413, 389, 7, 11).fillRect(425, 388, 8, 13)
        .fillRect(554, 389, 8, 11).fillRect(566, 388, 9, 13);
      sideShelves.fillStyle(0x617b8e).fillRect(436, 389, 8, 12).fillRect(414, 408, 9, 12)
        .fillRect(428, 408, 8, 12).fillRect(555, 408, 9, 12).fillRect(574, 408, 11, 12);
      sideShelves.fillStyle(0x8d794e).fillRect(414, 427, 10, 13).fillRect(430, 427, 8, 13)
        .fillRect(557, 427, 8, 13).fillRect(571, 427, 12, 13);

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

      const portalLight = this.add.ellipse(640, 619, 44, 80, 0x78c8ac, 0.4).setDepth(9.9);
        this.tweens.add({ targets: portalLight, alpha: { from: 0.26, to: 0.6 }, scaleX: { from: 0.9, to: 1.04 }, duration: 1250, yoyo: true, repeat: -1 });
      this.add.circle(640, 619, 5, 0xe8df9d, 0.95).setDepth(10.1);
    }

    update() {
      this.handleInteraction();
      this.handleMovement();
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
      if (Math.abs(x) > 0.01) this.player.setFlipX(x < 0);
      this.player.setVelocity(x * PLAYER_SPEED, y * PLAYER_SPEED);
      if (magnitude < 0.001) {
        setNativePlayerRestPose(this.player, playerActorId);
      } else {
        playNativePlayerAnimation(this.player, playerActorId, "walk");
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
        onPrompt("Galeria das Lendas: clique em um retrato ou pressione E para escolher sua Lenda e os dois ataques próprios.");
      } else if (station?.id === "collection") {
        onPrompt("Luzia, naturalista: conheça os monstros, elites e chefes encontrados nas masmorras. Pressione E para abrir o Bestiário.");
      } else if (station) {
        onPrompt(`${station.kicker}: ${station.label} · pressione E para entrar.`);
      }
    }
  };
}
