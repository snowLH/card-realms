import { buildHubNavigation, HUB_STATIONS, HUB_WORLD, findNearestHubStation, type HubDestinationId } from "../hub/content";
import { PLAYABLE_LEGEND_BY_ID, type PlayableLegendId } from "../content/legends";
import { findGridPath, type GridNavigation, type WorldPoint } from "../navigation/grid-path";
import { readBrowserGamepad, type GamepadFrame } from "./gamepad";
import { ARPG_MOVEMENT_KEY_BINDINGS, readKeyboardMovement, type ArpgMovementKeys } from "./keyboard-controls";
import type { ArpgBridge } from "./bridge";
import { ArpgAudio } from "./arpg-audio";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_ASSET_MANIFEST } from "../assets";
import { getPixelArtTextureKey } from "./pixel-art-sheet";
import { playActorIdle } from "./actor-idle";
import { queueAuthoredArt, authoredImage, authoredPanel } from '../art/runtime-art';
import { FX_ART, PROP_ART } from '../art/manifest';
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
const NATIVE_PLAYER_CYCLES = ["idle", "walk", "attack", "shoot", "damage", "defeat"] as const;
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
      frameRate: name === "walk" ? 9 : name === "idle" ? 5 : name === "defeat" ? 6 : 10,
      repeat: name === "walk" || name === "idle" ? -1 : 0,
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

function setNativePlayerRestPose(sprite: ArcadeSprite, actorId: NativePixelActorId, reducedMotion = false) {
  playActorIdle(sprite, getNativePlayerAnimationKey(actorId, "idle"), 0, reducedMotion);
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
  const idleMotionQuery = typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-motion: reduce)");
  return class ArpgHubScene extends Phaser.Scene {
    private player!: ArcadeSprite;
    private keys!: ArpgMovementKeys<Key> & { interact: Key };
    private gamepadPressedButtons = new Set<number>();
    private gamepad: GamepadFrame = {
      connected: false, moveX: 0, moveY: 0, aimX: 0, aimY: 0,
      attack: false, dashPressed: false, interactPressed: false,
      abilityPressed: [false, false],
    };
    private highlightedId: HubDestinationId | null = null;
    private stationVisuals = new Map<HubDestinationId, import("phaser").GameObjects.Image>();
    private stationColliders:import("phaser").GameObjects.Zone[]=[];
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
      queueAuthoredArt(this);
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
      this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
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
        ? GUILD_CHARACTER_SCALE
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
      setNativePlayerRestPose(this.player, playerActorId, idleMotionQuery?.matches);
      for (const visual of this.stationColliders) {
        this.physics.add.existing(visual, true);
        this.physics.add.collider(this.player, visual);
      }
      this.navigation = buildHubNavigation();
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

      if (!this.input.keyboard) throw new Error("Teclado indisponível no HUB ARPG.");
      this.keys = this.input.keyboard.addKeys({
        ...ARPG_MOVEMENT_KEY_BINDINGS,
        interact: "E",
      }) as ArpgMovementKeys<Key> & { interact: Key };
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
    private drawGuildHall(){
  console.error('Missing authored Guild background.');
  authoredImage(this,HUB_WORLD.width/2,HUB_WORLD.height/2,'props',PROP_ART.missing,HUB_WORLD.width,HUB_WORLD.height).setDepth(0);
}

    private createBlacksmith() {
      registerGuildNativeActorAnimations(this, "blacksmith", BLACKSMITH_TEXTURE, BLACKSMITH_ASSET);

      this.blacksmith = this.add.sprite(BLACKSMITH_HOME.x, BLACKSMITH_HOME.y, BLACKSMITH_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(GUILD_CHARACTER_SCALE)
        .setDepth(19);
      setGuildActorRestPose(this.blacksmith, "blacksmith");
      this.scheduleNpcBlink(this.blacksmith, "blacksmith", 4400);
    }

    private createMerchant() {
      registerGuildNativeActorAnimations(this, "merchant", MERCHANT_TEXTURE, MERCHANT_ASSET);

      this.merchant = this.add.sprite(MERCHANT_HOME.x, MERCHANT_HOME.y, MERCHANT_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(GUILD_CHARACTER_SCALE)
        .setDepth(10);
      setGuildActorRestPose(this.merchant, "merchant");
      this.scheduleNpcBlink(this.merchant, "merchant", 5100);
    }

    private createArchivist() {
      registerGuildNativeActorAnimations(this, "archivist", ARCHIVIST_TEXTURE, ARCHIVIST_ASSET);

      this.archivist = this.add.sprite(ARCHIVIST_HOME.x, ARCHIVIST_HOME.y, ARCHIVIST_TEXTURE, 0)
        .setOrigin(0.5, 0.82)
        .setScale(GUILD_CHARACTER_SCALE)
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
        .setScale(GUILD_CHARACTER_SCALE)
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
        authoredPanel(this,x,y-8,'panel-dark',68,84).setDepth(16);
        authoredImage(this,x,y+8,'props',PROP_ART.shadowSmall,47,12).setAlpha(0.6).setDepth(17);

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
        const visual=authoredImage(this,station.x,station.y+13,'fx',FX_ART.ringWarning,178*stationScale,82*stationScale).setAlpha(0.5).setDepth(7).setVisible(false);
        this.stationColliders.push(this.add.zone(station.x,station.y+13,178*stationScale,82*stationScale));
        if (this.clickToMoveEnabled) {
          visual.setInteractive({ useHandCursor: true });
          visual.on("pointerdown", (pointer: import("phaser").Input.Pointer) => {
            this.setClickDestination(pointer);
          });
        }
        this.stationVisuals.set(station.id, visual);
        if (!this.generatedBackgroundActive) {
          this.drawStationProp(station.id, station.x, station.y + 8);
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
      const height=kicker?34:26;
      width=Math.max(width*0.78,label.length*7+20,kicker?kicker.length*5+20:0);
      authoredPanel(this,x,y,'panel-dark',width,height).setDepth(11);
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

    private drawStationProp(id:HubDestinationId,x:number,y:number){
  const frame={expeditions:PROP_ART.mapTable,loadout:PROP_ART.forge,archive:PROP_ART.archivist,collection:PROP_ART.naturalist,avatar:PROP_ART.legendShrine,merchant:PROP_ART.merchant,refuge:PROP_ART.refuge,raid:PROP_ART.banner,altar:PROP_ART.relic,portal:PROP_ART.portalOpen}[id];
  const art=authoredImage(this,x,y,'props',frame,120,100).setDepth(9);
  if(id==='portal')this.tweens.add({targets:art,alpha:{from:0.75,to:1},duration:800,yoyo:true,repeat:-1});
}







    update() {
      this.handleInteraction();
      this.handleMovement();
    }

    private handleMovement() {
      const keyboard = readKeyboardMovement(this.keys);
      let x = keyboard.x;
      let y = keyboard.y;

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
        setNativePlayerRestPose(this.player, playerActorId, idleMotionQuery?.matches);
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
        previous?.setVisible(false).setScale(1);
      }
      this.highlightedId = nextId;
      if (!nextId) {
        onPrompt("Explore a Guilda. Aproxime-se de uma estação e pressione E.");
        return;
      }
      const station = HUB_STATIONS.find((item) => item.id === nextId);
      const visual = this.stationVisuals.get(nextId);
      visual?.setVisible(true).setScale(1.04);
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
