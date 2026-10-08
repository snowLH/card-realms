import { ARPG_ABILITY_CARD_BY_ID } from "../content/ability-cards";
import { ARPG_BASE_HP as PLAYER_BASE_HP, ARPG_BASE_SPEED as PLAYER_BASE_SPEED, ARPG_DASH_SPEED as DASH_SPEED, ARPG_DASH_DURATION_MS as DASH_MS, ARPG_DASH_COOLDOWN_MS as DASH_COOLDOWN_MS } from "../domain/combat-config";
import { ARPG_ASSET_MANIFEST, getArpgSpriteSheetFrameConfig, registerArpgSpriteSheetAnimations } from "../assets";
import type { ArpgDungeonRuntimeConfig, DungeonLoot } from "../content/dungeons";
import {
  ARPG_ARMOR_BY_ID,
  ARPG_ARMORS,
  ARPG_WEAPON_BY_ID,
  ARPG_WEAPONS,
  getArmorAbilityCooldownMs,
  getArmorDashCooldownMs,
  getArmorMovingDefenseBonus,
  getArmorRetaliationDamage,
  getWeaponAttackIntervalMs,
  getWeaponAttackProc,
} from "../content/equipment";
import {
  ARPG_RELIC_BY_ID,
  getRelicAbilityCooldownMs,
  getRelicChestHeal,
  getRelicXpMultiplier,
  STARTER_ARPG_RELIC_ID,
} from "../content/relics";
import {
  DEFAULT_ARPG_LOADOUT,
  MATA_CARDS,
} from "../content/mata-encantada";
import type {
  ArpgDungeonMapState,
  ArpgHudState,
  ArpgLoadout,
  ArpgMiniMapRoomState,
  ArpgRoomChoiceState,
  ArpgRunLootEntry,
  ArpgRuntimeBridge,
} from "../domain/types";
import type { ArpgDungeonCombatCommand, ArpgDungeonCombatState } from "../dungeon/combat-authority";
import type { DungeonManager } from "../dungeon/manager";
import { DUNGEON_CORRIDOR_WIDTH } from "../dungeon/layout";
import { buildDungeonNavigation } from "../dungeon/navigation";
import {
  applyBreakableObjectDamage,
  createBreakableObjectPlacements,
  getUnbrokenBreakablePlacements,
} from "../dungeon/breakable-objects";
import { CombatRoomController } from "../dungeon/room-controller";
import { createRunLootAssignments, rollCombatRoomCache, type RunCacheReward } from "../dungeon/rewards";
import {
  getRunShardReward,
  getSpecialRoomEncounter,
  isWithinSpecialRoomInteractionRange,
  resolveSpecialRoomChoice,
  type SpecialRoomChoiceId,
  type SpecialRoomEncounter,
} from "../dungeon/special-rooms";
import type { DungeonRoom } from "../dungeon/types";
import { snapshotArpgRunCheckpoint, type ArpgRunCheckpoint } from "../dungeon/run-checkpoint";
import {
  DUNGEON_BIOME_PROPS_ASSET_PATH,
  DUNGEON_BIOME_PROPS_FRAME_SIZE,
  DUNGEON_BIOME_PROPS_TEXTURE_KEY,
  DungeonWorldRuntime,
} from "./dungeon-world";
import { ArpgAudio, type ArpgSoundCue } from "./arpg-audio";
import { acceptServerConfirmedCombatResponse } from "./visual-events";
import { createDungeonRuntimeTextures } from "./dungeon-runtime-textures";
import { getEnemyMovementIntent, type EnemyCombatRole } from "./enemy-behavior";
import { indexRuntimeEntities } from "./entity-index";
import { selectNearestTarget, selectStableTarget, resolveCombatDirection } from "./combat-targeting";
import { getCurupiraBossPattern, getCurupiraBossPhase } from "./boss-patterns";
import { getRegionalBossPattern } from "../dungeon/region-boss-patterns";
import { readBrowserGamepad, type GamepadFrame } from "./gamepad";
import { pickGroupMember } from "./group-member";
import {
  findGridPath,
  gridCellKey,
  hasGridLineOfSight,
  worldToGridCell,
  type GridNavigation,
  type WorldPoint,
} from "../navigation/grid-path";
import type { Rarity } from "../../domain/creatures";
import {
  CHEST_LOOT_RARITY_PRESENTATION,
  claimChestLootVisualSlot,
  findChestLootLandingPoint,
  getChestLootVisualDetails,
} from "./chest-loot-presentation";
import {
  CARTOGRAPHER_PLAYER_FRAME_SIZE,
  CARTOGRAPHER_PLAYER_SCALE,
} from "./player-sprites";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import {
  getArpgEnemyAnimationProfile,
  isArpgEnemyAnimationProfile,
  playArpgEnemyAnimation,
  type ArpgEnemyAnimation,
  type ArpgEnemyAnimationProfile,
} from "./enemy-sprites";
import { getPixelArtTextureKey } from "./pixel-art-sheet";
import { playActorIdle } from "./actor-idle";
import { GENERATED_SPRITE_FRAME_SIZE, queueGeneratedLegendSpriteSheet } from "./legend-sprite-sheets";
import {
  createNativePixelActorSheet,
  NATIVE_PIXEL_ACTOR_ANIMATION_MAP,
  NATIVE_PIXEL_ACTOR_FRAME_COLUMNS,
  type NativePixelActorAnimation,
  type NativePixelActorId,
} from "./native-pixel-actors";
import { getFloatingWeaponPose, getFloatingWeaponReach } from "./floating-weapon";
import {
  createWeaponSlots,
  pickUpWeapon,
  switchWeaponSlot,
  type WeaponSlot,
  type WeaponSlots,
} from "./weapon-slots";
import {
  alignTreasureChestToGround,
  getTreasureChestFrameBounds,
  registerTreasureChestAnimation,
  TREASURE_CHEST_ASSET_PATH,
  TREASURE_CHEST_DISPLAY_SCALE,
  TREASURE_CHEST_OPEN_ANIMATION_KEY,
  TREASURE_CHEST_TEXTURE,
} from "./treasure-chest-sprites";

type PhaserModule = typeof import("phaser");
type ArcadeSprite = import("phaser").Physics.Arcade.Sprite;
type Key = import("phaser").Input.Keyboard.Key;

type KeyMap = {
  up: Key;
  down: Key;
  left: Key;
  right: Key;
  dash: Key;
  interact: Key;
  one: Key;
  two: Key;
  switchWeapon: Key;
};
type ClickPointer = Pick<import("phaser").Input.Pointer, "button" | "wasTouch" | "worldX" | "worldY">;
type ChestPresentationPhase = "rise" | "pause" | "fall" | "contact" | "waiting-choice" | "cache";
type ChestLootPresentation = {
  id: number;
  kind: "loot" | "cache";
  roomId: string | null;
  itemId: string;
  rarity: Rarity | null;
  phase: ChestPresentationPhase;
  chest: import("phaser").GameObjects.Sprite;
  item: import("phaser").GameObjects.Image | null;
  shadow: import("phaser").GameObjects.Ellipse | null;
  effects: import("phaser").GameObjects.GameObject[];
  tweens: import("phaser").Tweens.Tween[];
  timers: import("phaser").Time.TimerEvent[];
  visualSlot: { claimed: boolean };
  itemSpawnCount: number;
  landingPoint: WorldPoint;
  loot: DungeonLoot | null;
  resolved: boolean;
};
const CACHE_FRAGMENT_FEEDBACK = { color: 0x9bcf69, sparkleCount: 6, outlineCount: 1 };
type SpecialRoomAnchor = {
  encounter: SpecialRoomEncounter;
  x: number;
  y: number;
  display: import("phaser").GameObjects.Container;
  prompt: import("phaser").GameObjects.Text;
};

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const DUNGEON_CAMERA_FOLLOW_LERP = 0.16;
const NATIVE_LEGEND_FRAME_SIZE = 32;
const NATIVE_LEGEND_PLAYER_SCALE = CARTOGRAPHER_PLAYER_FRAME_SIZE
  * CARTOGRAPHER_PLAYER_SCALE
  / NATIVE_LEGEND_FRAME_SIZE;
const PLAYER_BODY_WIDTH = 22;
const PLAYER_BODY_HEIGHT = 28;
const NATIVE_FALLBACK_ACTORS: Readonly<Record<string, Readonly<Partial<Record<string, NativePixelActorId>>>>> = {
  "mata-encantada": { miniBoss: "mapinguari" },
};
const NATIVE_ENEMY_ACTORS_BY_PROFILE: Partial<Record<ArpgEnemyAnimationProfile, NativePixelActorId>> = {
  "sprout-enemy": "sprout",
};
const NATIVE_FALLBACK_ANIMATIONS = {
  idle: { row: 0, frameRate: 5, repeat: -1 },
  walk: { row: 1, frameRate: 9, repeat: -1 },
  attack: { row: 2, frameRate: 12, repeat: 0 },
  shoot: { row: 3, frameRate: 12, repeat: 0 },
  damage: { row: 4, frameRate: 10, repeat: 0 },
  defeat: { row: 5, frameRate: 7, repeat: 0 },
} as const;
const NATIVE_ACTOR_ANIMATIONS = {
  ...NATIVE_FALLBACK_ANIMATIONS,
};

function getNativeDungeonFallbackActors(dungeonId: string) {
  return new Set(
    Object.values(NATIVE_FALLBACK_ACTORS[dungeonId] ?? {})
      .filter((actorId): actorId is NativePixelActorId => Boolean(actorId)),
  );
}
const ABILITY_COLORS = {
  fire: 0xff6b33,
  water: 0x73d8ff,
  nature: 0x81c66c,
  storm: 0x9edcff,
  spirit: 0xc9a9ff,
} as const;
export function createArpgDungeonScene(
  Phaser: PhaserModule,
  bridge: ArpgRuntimeBridge,
  dungeon: ArpgDungeonRuntimeConfig,
  loadout: ArpgLoadout = DEFAULT_ARPG_LOADOUT,
  lootPlan: readonly DungeonLoot[] = dungeon.createLootPlan(),
  dungeonManager?: DungeonManager,
  checkpoint?: ArpgRunCheckpoint,
  avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
) {
  const startingArmor = ARPG_ARMOR_BY_ID.get(checkpoint?.armorId ?? loadout.armorId) ?? ARPG_ARMORS[0];
  const selectedRelic = ARPG_RELIC_BY_ID.get(loadout.relicId)
    ?? ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID)!;
  const selectedCards = loadout.abilityIds.map((id) =>
    ARPG_ABILITY_CARD_BY_ID.get(id) ?? MATA_CARDS[0]
  ) as [typeof MATA_CARDS[number], typeof MATA_CARDS[number]];
  const playerActorId: NativePixelActorId = avatarConfig.legendId;
  const playerTextureKey = `folklard-playable-legend-${playerActorId}`;
  const playerAnimationKeyPrefix = `folklard-playable-legend-${playerActorId}`;

  const setNativePlayerRestPose = (sprite: ArcadeSprite, reducedMotion = false) => {
    playActorIdle(sprite, `${playerAnimationKeyPrefix}-idle`, 0, reducedMotion);
  };

  const playNativePlayerAnimation = (
    sprite: ArcadeSprite,
    animation: NativePixelActorAnimation,
    restart = false,
  ) => {
    if (animation === "idle") {
      setNativePlayerRestPose(sprite);
      return;
    }
    const key = `${playerAnimationKeyPrefix}-${animation}`;
    if (restart || sprite.anims.currentAnim?.key !== key) sprite.play(key);
  };

  return class ArpgDungeonScene extends Phaser.Scene {
    private player!: ArcadeSprite;
    private floatingWeapon: import("phaser").GameObjects.Graphics | null = null;
    private targetMarker: import("phaser").GameObjects.Graphics | null = null;
    private autoAimTarget: ArcadeSprite | null = null;
    private enemies!: import("phaser").Physics.Arcade.Group;
    private readonly entityGroundShadows = new Map<ArcadeSprite, import("phaser").GameObjects.Image>();
    private projectiles!: import("phaser").Physics.Arcade.Group;
    private enemyProjectiles!: import("phaser").Physics.Arcade.Group;
    private benchmarkParticleEmitter: import("phaser").GameObjects.Particles.ParticleEmitter | null = null;
    private breakableObjects!: import("phaser").Physics.Arcade.Group;
    private breakableRooms = new Set<string>();
    private pendingEnemySpawns = new Map<ArcadeSprite, { activateAt: number; scaleX: number; scaleY: number }>();
    private keys!: KeyMap;
    private gamepadPressedButtons = new Set<number>();
    private gamepad: GamepadFrame = {
      connected: false, moveX: 0, moveY: 0, aimX: 0, aimY: 0,
      attack: false, dashPressed: false,
      interactPressed: false,
      abilityPressed: [false, false],
    };
    private hp = Math.max(0, Math.min(PLAYER_BASE_HP, checkpoint?.playerHp ?? PLAYER_BASE_HP));
    private maxHp = PLAYER_BASE_HP;
    private roomIndex = 0;
    private roomWaves = dungeon.createRoomPlan();
    private dungeonWorld: DungeonWorldRuntime | null = null;
    private navigation: GridNavigation | null = null;
    private clickPath: WorldPoint[] = [];
    private clickPathIndex = 0;
    // Click-to-move is kept behind an explicit accessibility flag so attacks
    // and camera-facing pointer input never move the Legend by accident.
    private clickToMoveEnabled = false;
    private suppressDesktopAttackUntil = 0;
    private audio: ArpgAudio | null = null;
    private proceduralRoomId: string | null = dungeonManager?.getCurrentRoom().id ?? null;
    private proceduralController: CombatRoomController | null = null;
    private proceduralWaveTransitionScheduled = false;
    private serverCombatState: ArpgDungeonCombatState | null = checkpoint?.serverCombatState ?? null;
    private serverCombatActionSequence = 0;
    private serverCombatLastRequestAt = 0;
    private serverCombatRequestsInFlight = 0;
    private serverActionPending = false;
    private readonly serverDefeatedEnemyIds = new Set<string>();
    private readonly serverProjectileVisuals = new Map<string, import("phaser").GameObjects.Arc>();
    private readonly serverHazardVisuals = new Map<string, import("phaser").GameObjects.Shape>();
    private serverProjectileRoomId: string | null = null;
    private serverHazardRoomId: string | null = null;
    private readonly runLootAssignments = dungeonManager ? createRunLootAssignments(dungeonManager.getGraph()) : {};
    private readonly brokenBreakableIds = new Set(checkpoint?.brokenBreakableIds ?? []);
    private chestLoot: DungeonLoot | null = null;
    private chestRoomId: string | null = null;
    private chestLootIndex: number | null = null;
    private chestCacheReward: Extract<RunCacheReward, { kind: "cache" }> | null = null;
    private exitPortal: import("phaser").GameObjects.Container | null = null;
    private exitPortalAvailable = checkpoint?.exitPortalAvailable ?? false;
    private xpEarned = checkpoint?.xpEarned ?? 0;
    private weaponSlots: WeaponSlots = createWeaponSlots(
      checkpoint?.weaponAId ?? checkpoint?.weaponId ?? loadout.weaponId,
      checkpoint?.weaponBId ?? null,
      checkpoint?.activeWeaponSlot ?? "A",
    );
    private currentArmorId = checkpoint?.armorId ?? startingArmor.id;
    private runLoot: ArpgRunLootEntry[] = checkpoint?.runLoot.map((item) => ({ ...item })) ?? [];
    private runShards = checkpoint?.runShards ?? 0;
    private pendingLoot: DungeonLoot | null = null;
    private pendingRoomChoice: ArpgRoomChoiceState | null = null;
    private readonly specialRoomAnchors = new Map<string, SpecialRoomAnchor>();
    private runMoveSpeedBonus = checkpoint?.runMoveSpeedBonus ?? 0;
    private runBasicDamageMultiplier = checkpoint?.runBasicDamageMultiplier ?? 1;
    private chest: import("phaser").GameObjects.Sprite | null = null;
    private chestPresentation: ChestLootPresentation | null = null;
    private nextChestPresentationId = 1;
    private chestPhysicsPausedByPresentation = false;
    private chestPrompt: import("phaser").GameObjects.Text | null = null;
    private dungeonDebugText: import("phaser").GameObjects.Text | null = null;
    private visualReferenceText: import("phaser").GameObjects.Text | null = null;
    private visualReferenceEnabled = false;
    private lastVisualReferenceAt = 0;
    private prefersReducedMotion = false;
    private reducedMotionQuery: MediaQueryList | null = null;
    private exitPortalMotionTweens: import("phaser").Tweens.Tween[] = [];
    private exitPortalMotionVisuals: {
      outer: import("phaser").GameObjects.Ellipse;
      inner: import("phaser").GameObjects.Ellipse;
      core: import("phaser").GameObjects.Ellipse;
    } | null = null;
    private playerLifecycleEvents: Array<{ event: string; sceneTime: number; stack?: string }> = [];
    private activeCurupiraRootBarriers = 0;
    private chestAvailable = false;
    private chestOpening = false;
    private nextAttackAt = 0;
    private basicAttackCounter = 0;
    private nextDashAt = 0;
    private nextPlayerDamageAt = 0;
    private dashingUntil = 0;
    private moveVector = new Phaser.Math.Vector2();
    private aimVector = new Phaser.Math.Vector2(1, 0);
    private dashVector = new Phaser.Math.Vector2(1, 0);
    private abilityReadyAt: Record<string, number> = Object.fromEntries(
      selectedCards.map((card) => [card.id, 0]),
    );
    private lastHudAt = 0;
    private runEnded = false;
    private victory = false;
    private roomTransitionScheduled = false;
    private playerActionUntil = 0;

    constructor() {
      super(dungeon.sceneKey);
    }

    preload() {
      this.load.spritesheet(
        DUNGEON_BIOME_PROPS_TEXTURE_KEY,
        DUNGEON_BIOME_PROPS_ASSET_PATH,
        {
          frameWidth: DUNGEON_BIOME_PROPS_FRAME_SIZE,
          frameHeight: DUNGEON_BIOME_PROPS_FRAME_SIZE,
        },
      );
      queueGeneratedLegendSpriteSheet(this, playerActorId, playerTextureKey);
      const enemyProfiles = new Set(
        Object.values(dungeon.enemyAnimations ?? {}).filter(isArpgEnemyAnimationProfile),
      );
      for (const profile of enemyProfiles) {
        const definition = getArpgEnemyAnimationProfile(profile);
        const textureKey = getPixelArtTextureKey(definition.textureKey);
        const actorId = NATIVE_ENEMY_ACTORS_BY_PROFILE[profile];
        if (actorId) {
          queueGeneratedLegendSpriteSheet(this, actorId, textureKey);
        } else {
          this.load.spritesheet(textureKey, definition.path, getArpgSpriteSheetFrameConfig(definition));
        }
      }
      for (const actorId of getNativeDungeonFallbackActors(dungeon.id)) {
        queueGeneratedLegendSpriteSheet(
          this,
          actorId,
          getPixelArtTextureKey(`folklard-native-${actorId}`),
        );
      }
      this.load.image(ARPG_ASSET_MANIFEST.runtimeTextureKeys.dungeonBackground, dungeon.background);
      this.load.spritesheet(
        TREASURE_CHEST_TEXTURE,
        TREASURE_CHEST_ASSET_PATH,
        getArpgSpriteSheetFrameConfig(ARPG_ASSET_MANIFEST.props.treasureChest),
      );
      this.load.spritesheet(
        ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreatures.textureKey,
        ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreatures.path,
        getArpgSpriteSheetFrameConfig(ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreatures),
      );
      this.load.spritesheet(
        ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreaturesSecond.textureKey,
        ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreaturesSecond.path,
        getArpgSpriteSheetFrameConfig(ARPG_ASSET_MANIFEST.characterAtlases.folkloreCreaturesSecond),
      );
    }
    create() {
      this.clickToMoveEnabled = typeof window !== "undefined"
        && new URLSearchParams(window.location.search).get("clickToMove") === "1";
      this.cameras.main.setBackgroundColor("#102018");
      this.setupReducedMotionPreference();
      const audio = new ArpgAudio(dungeonManager?.getGraph().regionId ?? dungeon.id);
      this.audio = audio;
      audio.setEnabled(bridge.getSoundEnabled());
      const offSoundEnabled = bridge.onSoundEnabled((enabled) => audio.setEnabled(enabled));
      const disposeAudio = () => {
        offSoundEnabled();
        audio.destroy();
        if (this.audio === audio) this.audio = null;
      };
      this.events.once("shutdown", disposeAudio);
      this.events.once("destroy", disposeAudio);
      this.events.once("shutdown", () => this.clearChestPresentation(false));
      this.events.once("destroy", () => this.clearChestPresentation(false));
      this.events.once("shutdown", () => this.clearServerProjectileVisuals());
      this.events.once("destroy", () => this.clearServerProjectileVisuals());
      this.events.once("shutdown", () => this.clearServerHazardVisuals());
      this.events.once("destroy", () => this.clearServerHazardVisuals());
      createDungeonRuntimeTextures(this);
      if (!this.textures.exists(playerTextureKey)) {
        createNativePixelActorSheet(
          this,
          playerActorId,
          playerTextureKey,
          NATIVE_LEGEND_FRAME_SIZE,
          NATIVE_LEGEND_FRAME_SIZE,
        );
      }
      const playerTextureFrameSize = this.textures.get(playerTextureKey).getSourceImage().width === GENERATED_SPRITE_FRAME_SIZE * 4
        ? GENERATED_SPRITE_FRAME_SIZE
        : NATIVE_LEGEND_FRAME_SIZE;
      const playerAnimationRows = NATIVE_PIXEL_ACTOR_ANIMATION_MAP[playerActorId];
      registerArpgSpriteSheetAnimations(this, {
        textureKey: playerTextureKey,
        columns: NATIVE_PIXEL_ACTOR_FRAME_COLUMNS,
        keyPrefix: playerAnimationKeyPrefix,
        animations: {
          idle: { row: playerAnimationRows.idle, frameRate: 5, repeat: -1 },
          walk: { row: playerAnimationRows.walk, frameRate: 9, repeat: -1 },
          attack: { row: playerAnimationRows.attack, frameRate: 12, repeat: 0 },
          shoot: { row: playerAnimationRows.shoot, frameRate: 12, repeat: 0 },
          damage: { row: playerAnimationRows.damage, frameRate: 10, repeat: 0 },
          defeat: { row: playerAnimationRows.defeat, frameRate: 7, repeat: 0 },
        },
      });
      registerTreasureChestAnimation(this);
      for (const profile of new Set(Object.values(dungeon.enemyAnimations ?? {}).filter(isArpgEnemyAnimationProfile))) {
        const definition = getArpgEnemyAnimationProfile(profile);
        const textureKey = getPixelArtTextureKey(definition.textureKey);
        if (!this.textures.exists(textureKey)) {
          const actorId = NATIVE_ENEMY_ACTORS_BY_PROFILE[profile];
          if (actorId) {
            createNativePixelActorSheet(
              this,
              actorId,
              textureKey,
              definition.frameWidth,
              definition.frameHeight,
            );
          }
        }
        if (!this.textures.exists(textureKey)) continue;
        registerArpgSpriteSheetAnimations(this, {
          textureKey,
          animations: NATIVE_ACTOR_ANIMATIONS,
          columns: 4,
          keyPrefix: definition.animationKeyPrefix!,
        });
      }
      const nativeFallbackActors = getNativeDungeonFallbackActors(dungeon.id);
      for (const actorId of nativeFallbackActors) {
        const textureKey = getPixelArtTextureKey(`folklard-native-${actorId}`);
        if (!this.textures.exists(textureKey)) {
          createNativePixelActorSheet(this, actorId, textureKey, 250, 250);
        }
        registerArpgSpriteSheetAnimations(this, {
          textureKey,
          animations: NATIVE_FALLBACK_ANIMATIONS,
          columns: 4,
          keyPrefix: `folklard-fallback-${actorId}`,
        });
      }

      let playerStart = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
      if (dungeonManager) {
        this.registry.set("dungeonGraph", dungeonManager.getGraph());
        this.dungeonWorld = new DungeonWorldRuntime(
          this,
          dungeonManager.getGraph(),
          (locked) => this.playSound(locked ? "door-close" : "door-open"),
        ).build();
        this.navigation = buildDungeonNavigation(dungeonManager.getGraph(), this.dungeonWorld.layout);
        const currentRoom = dungeonManager.getCurrentRoom();
        playerStart = this.dungeonWorld.getRoomCenter(currentRoom.id);
        if (checkpoint?.serverCombatState?.roomId === currentRoom.id) {
          const layout = this.dungeonWorld.layout.rooms[currentRoom.id];
          playerStart = {
            x: layout.left + checkpoint.serverCombatState.playerX,
            y: layout.top + checkpoint.serverCombatState.playerY,
          };
        }
      } else {
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        const background = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "dungeon-arena");
        background.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
        background.setAlpha(1);
        this.drawRoomFrame();
      }

      this.player = this.physics.add.sprite(playerStart.x, playerStart.y, playerTextureKey, 0);
      const playerScale = playerTextureFrameSize === GENERATED_SPRITE_FRAME_SIZE
        ? (CARTOGRAPHER_PLAYER_FRAME_SIZE * CARTOGRAPHER_PLAYER_SCALE) / GENERATED_SPRITE_FRAME_SIZE
        : NATIVE_LEGEND_PLAYER_SCALE;
      this.player.setScale(playerScale);
      this.player.setDepth(10);
      this.player.setCollideWorldBounds(true);
      const playerBodyWidth = PLAYER_BODY_WIDTH / playerScale;
      const playerBodyHeight = PLAYER_BODY_HEIGHT / playerScale;
      this.player.setSize(playerBodyWidth, playerBodyHeight)
        .setOffset((playerTextureFrameSize - playerBodyWidth) / 2, playerTextureFrameSize - playerBodyHeight - 6);
      this.ensureEntityGroundShadow(this.player, 30);
      this.events.once("shutdown", () => this.clearEntityGroundShadows());
      this.events.once("destroy", () => this.clearEntityGroundShadows());
      setNativePlayerRestPose(this.player, this.prefersReducedMotion);
      this.floatingWeapon = this.add.graphics().setDepth(11);
      this.targetMarker = this.add.graphics().setDepth(18);
      this.events.once("shutdown", () => this.clearFloatingWeapon());
      this.events.once("destroy", () => this.clearFloatingWeapon());
      this.dungeonWorld?.attachPlayer(this.player);

      this.enemies = this.physics.add.group();
      this.projectiles = this.physics.add.group({ maxSize: 320 });
      this.enemyProjectiles = this.physics.add.group({ maxSize: 320 });
      this.breakableObjects = this.physics.add.group({ maxSize: 36 });
      this.dungeonWorld?.attachEnemies(this.enemies);

      this.physics.add.overlap(
        this.projectiles,
        this.enemies,
        (projectile, enemy) => this.handleProjectileHit(projectile as ArcadeSprite, enemy as ArcadeSprite),
      );
      this.physics.add.overlap(
        this.projectiles,
        this.breakableObjects,
        (objectA, objectB) => {
          const projectile = pickGroupMember(
            (candidate) => this.projectiles.contains(candidate),
            objectA as ArcadeSprite,
            objectB as ArcadeSprite,
          );
          const breakable = pickGroupMember(
            (candidate) => this.breakableObjects.contains(candidate),
            objectA as ArcadeSprite,
            objectB as ArcadeSprite,
          );
          if (projectile && breakable) this.handleProjectileBreakableHit(projectile, breakable);
        },
      );
      this.physics.add.overlap(
        this.enemyProjectiles,
        this.player,
        (objectA, objectB) => {
          const projectile = pickGroupMember(
            (candidate) => this.enemyProjectiles.contains(candidate),
            objectA as ArcadeSprite,
            objectB as ArcadeSprite,
          );
          if (projectile) this.handleEnemyProjectileHit(projectile);
        },
      );

      this.keys = this.input.keyboard!.addKeys({
        up: "W", down: "S", left: "A", right: "D",
        dash: "SPACE", interact: "E",
        one: "ONE", two: "TWO", switchWeapon: "Q",
      }) as KeyMap;

      this.game.canvas.oncontextmenu = (event) => event.preventDefault();
      this.input.mouse?.disableContextMenu();
      if (this.clickToMoveEnabled) {
        this.input.on("pointerdown", this.setClickDestination, this);
        this.events.once("shutdown", () => this.input.off("pointerdown", this.setClickDestination, this));
      }
      this.cameras.main.startFollow(
        this.player,
        true,
        DUNGEON_CAMERA_FOLLOW_LERP,
        DUNGEON_CAMERA_FOLLOW_LERP,
      );
      if (dungeonManager && this.dungeonWorld) {
        this.dungeonWorld.focusCamera(dungeonManager.getCurrentRoom().id);
        this.createDungeonDebugOverlay();
        this.createVisualReferenceOverlay();
        if (checkpoint) {
          const room = dungeonManager.getCurrentRoom();
          if (checkpoint.exitPortalAvailable) this.createExitPortal(room);
          else if (checkpoint.rewardRoomId === room.id) this.spawnProceduralReward(room, this.time.now);
          else if (room.id !== dungeonManager.getGraph().startRoomId && room.state !== "cleared") {
            this.activateProceduralRoom(room, this.time.now);
          }
          bridge.emitMessage(`Run retomada em ${this.proceduralRoomLabel(room)}. WASD, joystick ou direcional movem sua Lenda; atravesse as portas para avançar.`);
        } else {
          bridge.emitMessage(`Expedição gerada: ${dungeon.name}. WASD, joystick ou direcional movem sua Lenda; atravesse uma porta para explorar a run.`);
        }
      } else {
        this.spawnCurrentRoom();
        bridge.emitMessage(`${dungeon.messages.intro} WASD, joystick ou direcional movem sua Lenda.`);
      }
      this.emitHud(0);
      this.emitRunCheckpoint();
    }
    update(time: number) {
      if (this.runEnded) return;

      if (this.visualReferenceEnabled && time - this.lastVisualReferenceAt >= 250) {
        this.updateVisualReferenceOverlay();
        this.lastVisualReferenceAt = time;
      }

      const gamepadRead = readBrowserGamepad(this.gamepadPressedButtons);
      this.gamepad = gamepadRead.frame;
      this.gamepadPressedButtons = gamepadRead.pressedButtons;

      const lootDecision = bridge.consumeLootDecision();
      if (this.pendingLoot && lootDecision) this.resolvePendingLoot(lootDecision, time);
      const weaponSwitchRequested = bridge.consumeWeaponSwitch()
        || Phaser.Input.Keyboard.JustDown(this.keys.switchWeapon);
      if (
        weaponSwitchRequested
        && !this.pendingLoot
        && !this.pendingRoomChoice
        && !this.chestOpening
      ) {
        this.switchActiveWeapon(time);
      }
      const roomChoice = bridge.consumeRoomChoice();
      if (this.pendingRoomChoice && roomChoice) this.resolvePendingRoomChoice(roomChoice, time);
      if (this.pendingLoot || this.pendingRoomChoice || this.chestOpening) {
        this.player.setVelocity(0, 0);
        this.updateTreasureChestPrompt();
        this.updateEntityGroundShadows();
        if (time - this.lastHudAt >= 100) {
          this.emitHud(time);
          this.lastHudAt = time;
        }
        return;
      }

      this.cleanupExpiredProjectiles(time);
      this.handleMovement(time);
      if (dungeonManager && this.dungeonWorld) this.updateProceduralRoom(time);
      this.syncServerCombatHeartbeat(time);
      this.activatePendingEnemySpawns(time);
      this.handleCombatInput(time);
      this.updateEnemies(time);
      this.updateFloatingWeapon();
      this.checkRoomProgress(time);
      this.updateTreasureChestPrompt();
      this.updateEntityGroundShadows();

      if (time - this.lastHudAt >= 100) {
        this.emitHud(time);
        this.lastHudAt = time;
      }
    }

    private ensureEntityGroundShadow(entity: ArcadeSprite, width: number) {
      let shadow = this.entityGroundShadows.get(entity);
      if (!shadow || !shadow.active) {
        shadow = this.add.image(entity.x, entity.y, "arpg-ground-shadow")
          .setOrigin(0.5)
          .setAlpha(0.48)
          .setVisible(false);
        this.entityGroundShadows.set(entity, shadow);
      }

      const snappedWidth = Math.max(24, Math.round(width / 2) * 2);
      const snappedHeight = Phaser.Math.Clamp(Math.round(snappedWidth * 0.38), 10, 20);
      shadow
        .setScale(snappedWidth / 32, snappedHeight / 12)
        .setDepth(Math.max(0, entity.depth - 0.02));
      return shadow;
    }

    private updateEntityGroundShadows() {
      for (const [entity, shadow] of this.entityGroundShadows) {
        if (!entity.scene || !shadow.active) {
          shadow.destroy();
          this.entityGroundShadows.delete(entity);
          continue;
        }

        const isPlayer = entity === this.player;
        const shouldShow = entity.active
          && entity.visible
          && (isPlayer || (entity.getData("spawnReady") && !entity.getData("defeatPending")));
        if (!shouldShow) {
          if (shadow.visible) shadow.setVisible(false);
          continue;
        }

        const feetY = entity.body?.bottom ?? entity.y + Math.max(8, entity.displayHeight * 0.22);
        shadow.setPosition(Math.round(entity.x), Math.round(feetY));
        if (!shadow.visible) shadow.setVisible(true);
      }
    }

    private clearEntityGroundShadows() {
      for (const shadow of this.entityGroundShadows.values()) shadow.destroy();
      this.entityGroundShadows.clear();
    }

    private drawRoomFrame() {
      const frame = this.add.graphics();
      frame.lineStyle(10, 0x221511, 0.9);
      frame.strokeRoundedRect(18, 18, WORLD_WIDTH - 36, WORLD_HEIGHT - 36, 28);
      frame.lineStyle(3, 0xb58a52, 0.6);
      frame.strokeRoundedRect(28, 28, WORLD_WIDTH - 56, WORLD_HEIGHT - 56, 24);
      frame.setDepth(3);
    }

    private handleMovement(time: number) {
      const touch = bridge.getInput();
      let moveX = touch.moveX + this.gamepad.moveX;
      let moveY = touch.moveY + this.gamepad.moveY;

      if (this.keys.left.isDown) moveX -= 1;
      if (this.keys.right.isDown) moveX += 1;
      if (this.keys.up.isDown) moveY -= 1;
      if (this.keys.down.isDown) moveY += 1;

      const move = this.moveVector.set(moveX, moveY);
      if (move.lengthSq() > 0.01) {
        this.clearClickPath();
      } else if (this.clickPathIndex < this.clickPath.length) {
        while (this.clickPathIndex < this.clickPath.length) {
          const target = this.clickPath[this.clickPathIndex];
          const dx = target.x - this.player.x;
          const dy = target.y - this.player.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 16) {
            move.set(dx / distance, dy / distance);
            break;
          }
          this.clickPathIndex += 1;
        }
        if (this.clickPathIndex >= this.clickPath.length) this.clearClickPath();
      }
      if (move.lengthSq() > 1) move.normalize();

      const dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.dash)
        || bridge.consumeDash()
        || this.gamepad.dashPressed;
      if (dashPressed && time >= this.nextDashAt) {
        const source = move.lengthSq() > 0 ? move : this.resolveAimVector();
        const dashArmor = ARPG_ARMOR_BY_ID.get(this.currentArmorId) ?? ARPG_ARMORS[0];
        this.dashVector.copy(source).normalize();
        this.facePlayer(this.dashVector);
        if (bridge.isServerAuthoritativeCombat() && this.proceduralController && this.proceduralRoomId) {
          if (!this.serverActionPending) {
            this.submitServerCombatCommand(this.proceduralRoomId, "dash", time, undefined, {
              x: this.dashVector.x,
              y: this.dashVector.y,
            });
          }
        } else {
          this.dashingUntil = time + DASH_MS;
          this.nextDashAt = time + getArmorDashCooldownMs(dashArmor, DASH_COOLDOWN_MS);
          this.playPlayerAction("walk", time, DASH_MS);
          this.flashPlayer(0xcaf4d2, 150);
        }
      }

      if (time < this.dashingUntil) {
        this.player.setVelocity(this.dashVector.x * DASH_SPEED, this.dashVector.y * DASH_SPEED);
        return;
      }

      const armor = ARPG_ARMOR_BY_ID.get(this.currentArmorId) ?? ARPG_ARMORS[0];
      const speed = PLAYER_BASE_SPEED + armor.moveSpeedBonus + this.runMoveSpeedBonus;
      this.facePlayer(move);
      this.player.setVelocity(move.x * speed, move.y * speed);
      if (time < this.playerActionUntil) return;
      if (move.lengthSq() < 0.001) {
        setNativePlayerRestPose(this.player, this.prefersReducedMotion);
      } else {
        playNativePlayerAnimation(this.player, "walk");
      }
    }

    private resolveAimVector() {
      // Keep dash and ability targeting consistent with regular attacks.
      // A touch-attack button with no analog input must never create a zero
      // direction, otherwise a requested dash appears unresponsive.
      return this.resolveCombatAim();
    }

    private facePlayer(direction: { x: number }) {
      if (Math.abs(direction.x) > 0.01) this.player.setFlipX(direction.x < 0);
    }

    private setClickDestination(pointer: ClickPointer) {
      if (!this.navigation || !dungeonManager || !this.dungeonWorld) return false;
      if (pointer.button !== 0 && !pointer.wasTouch) return false;
      if (this.pendingLoot || this.pendingRoomChoice || this.chestOpening || this.runEnded) return false;

      const destination = { x: pointer.worldX, y: pointer.worldY };
      const currentRoom = dungeonManager.getCurrentRoom();
      const targetRoom = this.dungeonWorld.findRoomAt(destination.x, destination.y, 28);
      const lockedRoom = currentRoom.state === "combat";
      if (lockedRoom && targetRoom?.id !== currentRoom.id) return false;

      const path = findGridPath(this.navigation, this.player, destination, {
        allowedRoomId: lockedRoom ? currentRoom.id : undefined,
      });
      this.clickPath = path?.slice(1) ?? [];
      this.clickPathIndex = 0;
      this.suppressDesktopAttackUntil = this.time.now + 180;
      return Boolean(path?.length);
    }

    private clearClickPath() {
      this.clickPath = [];
      this.clickPathIndex = 0;
    }

    private get currentWeaponId() {
      return this.weaponSlots[this.weaponSlots.active] ?? this.weaponSlots.A;
    }

    private switchActiveWeapon(time: number) {
      if (this.weaponSlots.B === null) {
        bridge.emitMessage("Encontre outra arma na dungeon para preencher o slot B.");
        return;
      }
      const previousSlot = this.weaponSlots.active;
      const next = switchWeaponSlot(this.weaponSlots);
      if (next.active === previousSlot) return;
      this.weaponSlots = next;
      this.basicAttackCounter = 0;
      const weapon = ARPG_WEAPON_BY_ID.get(this.currentWeaponId);
      bridge.emitMessage(`Arma ${this.weaponSlots.active}: ${weapon?.name ?? this.currentWeaponId}.`);
      this.emitRunCheckpoint();
      this.emitHud(time);
    }

    private handleCombatInput(time: number) {
      const input = bridge.getInput();
      const pointer = this.input.activePointer;
      const desktopAttack = !pointer.wasTouch
        && pointer.isDown
        && pointer.leftButtonDown()
        && time >= this.suppressDesktopAttackUntil;
      if ((desktopAttack || input.attack || this.gamepad.attack) && time >= this.nextAttackAt) {
        this.performBasicAttack(time);
      }

      if (
        Phaser.Input.Keyboard.JustDown(this.keys.interact)
        || bridge.consumeInteract()
        || this.gamepad.interactPressed
      ) {
        if (this.chestAvailable) this.tryOpenChest(time);
        else if (this.exitPortalAvailable) this.tryUseExitPortal(time);
        else this.tryInteractSpecialRoom(time);
      }

      const abilityKeys = [this.keys.one, this.keys.two] as const;
      if (pointer.rightButtonDown()) this.castAbility(1, time);
      abilityKeys.forEach((key, index) => {
        const slot = index as 0 | 1;
        if (
          Phaser.Input.Keyboard.JustDown(key)
          || bridge.consumeAbility(slot)
          || this.gamepad.abilityPressed[slot]
        ) {
          this.castAbility(slot, time);
        }
      });
    }

    private performBasicAttack(time: number) {
      const weapon = ARPG_WEAPON_BY_ID.get(this.currentWeaponId) ?? ARPG_WEAPONS[0];
      const aim = this.resolveCombatAim();
      this.facePlayer(aim);
      if (bridge.isServerAuthoritativeCombat() && this.proceduralController && this.proceduralRoomId) {
        if (!this.serverActionPending) {
          this.playPlayerAction("attack", time, 360);
          this.submitServerCombatCommand(this.proceduralRoomId, "basic_attack", time);
        }
        return;
      }
      this.playSound("attack");
      const body = this.player.body as import("phaser").Physics.Arcade.Body | null;
      const moving = (body?.velocity.lengthSq() ?? 0) > 64;
      this.basicAttackCounter += 1;
      const proc = getWeaponAttackProc(weapon, this.basicAttackCounter);
      const basicDamage = Math.max(1, Math.round(weapon.damage * this.runBasicDamageMultiplier));
      this.nextAttackAt = time + getWeaponAttackIntervalMs(weapon, moving);
      this.playPlayerAction("attack", time, 360);
      if (weapon.kind === "sword") {
        const x = this.player.x + aim.x * 42;
        const y = this.player.y + aim.y * 42;
        this.damageEnemiesInRadius(x, y, weapon.range, basicDamage, false);
        if (proc.cleaveMultiplier > 0) {
          this.damageEnemiesInRadius(
            x,
            y,
            Math.round(weapon.range * 1.25),
            Math.max(1, Math.round(basicDamage * proc.cleaveMultiplier)),
            false,
          );
          this.spawnPulse(x, y, Math.round(weapon.range * 1.18), ABILITY_COLORS.water);
        } else {
          this.spawnPulse(x, y, weapon.range, 0xd9e7b5);
        }
        return;
      }

      const tint = weapon.element === "spirit" ? 0xc9a9ff : weapon.element === "water" ? 0x73d8ff : 0xe7d48b;
      this.fireProjectile(aim, basicDamage, weapon.projectileSpeed ?? 560, tint, 900, proc.piercing);

      if (proc.echoMultiplier > 0) {
        this.fireProjectile(
          aim.clone().rotate(0.12),
          Math.max(1, Math.round(basicDamage * proc.echoMultiplier)),
          weapon.projectileSpeed ?? 560,
          0xdfc7ff,
          900,
          false,
        );
        bridge.emitMessage(`${weapon.name}: Eco Espiritual.`);
      }
      if (proc.restoreHp > 0) {
        this.hp = Math.min(this.maxHp, this.hp + proc.restoreHp);
        this.flashPlayer(ABILITY_COLORS.water, 150);
        bridge.emitMessage(`${weapon.name}: Eco Restaurador recupera vida.`);
      }
    }
    private resolveCombatAim() {
      const touch = bridge.getInput();
      const pointer = this.input.activePointer;
      const autoAimActive = touch.attack || this.gamepad.attack;
      this.autoAimTarget = autoAimActive ? this.findNearestEnemy(460, this.autoAimTarget) : null;
      const direction = resolveCombatDirection({
        gamepad: { x: this.gamepad.aimX, y: this.gamepad.aimY },
        touch: { x: touch.aimX, y: touch.aimY },
        autoAim: autoAimActive,
        player: { x: this.player.x, y: this.player.y },
        target: this.autoAimTarget,
        pointer: pointer.wasTouch ? null : { x: pointer.worldX, y: pointer.worldY },
        previous: this.aimVector,
      });
      return this.aimVector.set(direction.x, direction.y);
    }

    private findNearestEnemy(maxDistance = Number.POSITIVE_INFINITY, preferred: ArcadeSprite | null = null): ArcadeSprite | null {
      const playerCell = this.navigation ? worldToGridCell(this.player, this.navigation) : null;
      const playerCellKey = playerCell ? gridCellKey(playerCell.x, playerCell.y) : null;
      const playerRoomId = playerCellKey
        ? this.navigation?.roomIdByCell?.get(playerCellKey) ?? dungeonManager?.getCurrentRoom().id
        : undefined;
      const targets = this.enemies.getChildren() as ArcadeSprite[];
      const options = {
        maxDistance,
        available: (enemy: ArcadeSprite) => enemy.active && Boolean(enemy.getData("spawnReady")),
        visible: (enemy: ArcadeSprite) => {
          if (!this.navigation) return true;
          const enemyCell = worldToGridCell(enemy, this.navigation);
          const enemyRoomId = this.navigation.roomIdByCell?.get(gridCellKey(enemyCell.x, enemyCell.y));
          if (playerRoomId && enemyRoomId && enemyRoomId !== playerRoomId) return false;
          return hasGridLineOfSight(this.navigation, this.player, enemy);
        },
      };
      return preferred
        ? selectStableTarget(this.player, targets, preferred, options)
        : selectNearestTarget(this.player, targets, options);
    }

    private updateFloatingWeapon() {
      if (!this.floatingWeapon || !this.player?.active) return;
      const weapon = ARPG_WEAPON_BY_ID.get(this.currentWeaponId) ?? ARPG_WEAPONS[0];
      const enemy = this.autoAimTarget?.active ? this.autoAimTarget : this.findNearestEnemy(560);
      this.drawTargetMarker(enemy);
      const pose = getFloatingWeaponPose({
        player: this.player,
        target: enemy,
        fallbackDirection: this.aimVector,
        distance: getFloatingWeaponReach(weapon.kind),
      });
      this.drawFloatingWeapon(pose, weapon.kind, weapon.element);
    }

    private drawTargetMarker(target: ArcadeSprite | null) {
      const marker = this.targetMarker;
      if (!marker) return;
      marker.clear();
      if (!target) return;

      const definitionId = String(target.getData("definitionId") ?? "");
      const combatRole = String(target.getData("combatRole") ?? "melee");
      const locked = target === this.autoAimTarget;
      const accent = definitionId === "boss"
        ? 0xffcb72
        : definitionId === "miniBoss" || combatRole === "elite"
          ? 0xff9278
          : locked
            ? 0x8fe4c2
            : 0xf4dc8e;
      const bodyRadius = Math.max(14, Math.min(24, Number(target.getData("radius")) || 14));
      const pulse = locked ? (Math.sin(this.time.now / 95) + 1) * 1.25 : 0;
      const radius = bodyRadius + pulse;
      const arm = locked ? 7 : 5;
      const left = target.x - radius;
      const right = target.x + radius;
      const top = target.y - radius;
      const bottom = target.y + radius;

      if (locked) {
        marker.lineStyle(1, accent, 0.28);
        marker.strokeCircle(target.x, target.y, radius + 7);
      }
      marker.lineStyle(locked ? 3 : 2, accent, locked ? 1 : 0.9);
      marker.lineBetween(left, top + arm, left, top);
      marker.lineBetween(left, top, left + arm, top);
      marker.lineBetween(right - arm, top, right, top);
      marker.lineBetween(right, top, right, top + arm);
      marker.lineBetween(left, bottom - arm, left, bottom);
      marker.lineBetween(left, bottom, left + arm, bottom);
      marker.lineBetween(right - arm, bottom, right, bottom);
      marker.lineBetween(right, bottom - arm, right, bottom);
      marker.fillStyle(accent, locked ? 1 : 0.82).fillCircle(target.x, target.y, locked ? 2 : 1.5);
    }

    private drawFloatingWeapon(
      pose: ReturnType<typeof getFloatingWeaponPose>,
      kind: typeof ARPG_WEAPONS[number]["kind"],
      element: typeof ARPG_WEAPONS[number]["element"],
    ) {
      const graphic = this.floatingWeapon;
      if (!graphic) return;
      const direction = pose.direction;
      const perpendicular = { x: -direction.y, y: direction.x };
      const ink = 0x17151c;
      const color = element === "fire" ? 0xff7545
        : element === "water" ? 0x72d8ff
          : element === "nature" ? 0x97ca62
            : element === "storm" ? 0xe1d56f
              : 0xd8adff;
      const block = (x: number, y: number, size: number, fill: number) => {
        graphic.fillStyle(fill, 1).fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      };
      const along = (distance: number, sideways = 0) => ({
        x: pose.x + direction.x * distance + perpendicular.x * sideways,
        y: pose.y + direction.y * distance + perpendicular.y * sideways,
      });

      graphic.clear();
      if (kind === "bow") {
        for (const sideways of [-8, -4, 0, 4, 8]) {
          const curve = 7 - Math.abs(sideways) * 0.7;
          const point = along(0, sideways);
          block(point.x - direction.x * curve, point.y - direction.y * curve, 5, ink);
          block(point.x - direction.x * (curve - 2), point.y - direction.y * (curve - 2), 3, color);
        }
        const stringStart = along(-5, -9);
        const stringEnd = along(-5, 9);
        graphic.lineStyle(2, 0xf8efd0, 0.95).lineBetween(stringStart.x, stringStart.y, stringEnd.x, stringEnd.y);
        const arrowTail = along(-11);
        const arrowTip = along(14);
        graphic.lineStyle(3, ink, 1).lineBetween(arrowTail.x, arrowTail.y, arrowTip.x, arrowTip.y);
        block(arrowTip.x, arrowTip.y, 6, color);
        return;
      }

      const handleEnd = along(kind === "staff" ? -14 : -10);
      const tip = along(kind === "staff" ? 15 : 18);
      graphic.lineStyle(kind === "staff" ? 7 : 6, ink, 1).lineBetween(handleEnd.x, handleEnd.y, tip.x, tip.y);
      graphic.lineStyle(kind === "staff" ? 3 : 3, kind === "staff" ? 0x8a603d : color, 1)
        .lineBetween(handleEnd.x, handleEnd.y, tip.x, tip.y);
      if (kind === "staff") {
        block(tip.x, tip.y, 10, ink);
        block(tip.x, tip.y, 6, color);
      } else {
        const guardLeft = along(-5, -8);
        const guardRight = along(-5, 8);
        graphic.lineStyle(4, ink, 1).lineBetween(guardLeft.x, guardLeft.y, guardRight.x, guardRight.y);
        graphic.lineStyle(2, 0xe9c569, 1).lineBetween(guardLeft.x, guardLeft.y, guardRight.x, guardRight.y);
        block(tip.x, tip.y, 7, 0xf5e7bb);
      }
    }

    private clearFloatingWeapon() {
      this.floatingWeapon?.destroy();
      this.floatingWeapon = null;
      this.targetMarker?.destroy();
      this.targetMarker = null;
    }

    private castAbility(slot: 0 | 1, time: number) {
      const card = selectedCards[slot];
      if (!card) return;
      if (time < this.abilityReadyAt[card.id]) return;
      const aim = this.resolveCombatAim();
      this.facePlayer(aim);
      const abilityAnimation = card.behavior === "projectile" || card.behavior === "piercing-projectile"
        ? "shoot"
        : "attack";
      if (bridge.isServerAuthoritativeCombat() && this.proceduralController && this.proceduralRoomId) {
        if (!this.serverActionPending) {
          this.playPlayerAction(abilityAnimation, time, 400);
          this.submitServerCombatCommand(this.proceduralRoomId, "ability", time, slot);
        }
        return;
      }
      this.playSound("ability");
      const armor = ARPG_ARMOR_BY_ID.get(this.currentArmorId) ?? ARPG_ARMORS[0];
      this.abilityReadyAt[card.id] = time + getRelicAbilityCooldownMs(
        selectedRelic,
        getArmorAbilityCooldownMs(armor, card.cooldownMs),
      );
      this.playPlayerAction(abilityAnimation, time, 400);
      const color = ABILITY_COLORS[card.element];

      if (card.behavior === "projectile" || card.behavior === "piercing-projectile") {
        const projectileSpeed = card.projectileSpeed ?? 700;
        this.fireProjectile(
          aim,
          card.damage,
          projectileSpeed,
          color,
          1050,
          card.behavior === "piercing-projectile",
        );
      } else if (card.behavior === "self-area") {
        const radius = card.radius ?? 140;
        const roots = card.kind === "control";
        this.damageEnemiesInRadius(
          this.player.x,
          this.player.y,
          radius,
          card.damage,
          roots,
          roots ? time + (card.durationMs ?? 1400) : 0,
        );
      } else if (card.behavior === "targeted-control") {
        const radius = card.radius ?? 150;
        const x = this.player.x + aim.x * 150;
        const y = this.player.y + aim.y * 150;
        this.damageEnemiesInRadius(x, y, radius, card.damage, true, time + (card.durationMs ?? 1600));
      } else if (card.behavior === "renewal") {
        this.hp = Math.min(this.maxHp, this.hp + (card.restoreHp ?? 40));
        this.flashPlayer(color, 220);
      }

      this.spawnAbilitySignature(card, aim, this.player.x, this.player.y);

      bridge.emitMessage(`${card.name} ativada.`);
      this.emitHud(time);
    }

    private spawnAbilitySignature(
      card: typeof selectedCards[number],
      direction: import("phaser").Math.Vector2,
      originX: number,
      originY: number,
    ) {
      if (card.behavior === "projectile" || card.behavior === "piercing-projectile") {
        this.spawnAbilityProjectileSignature(card, direction, originX, originY, card.projectileSpeed ?? 700, 1050);
      } else if (card.behavior === "targeted-control") {
        const x = originX + direction.x * 150;
        const y = originY + direction.y * 150;
        this.spawnPulse(x, y, card.radius ?? 150, ABILITY_COLORS[card.element]);
        this.spawnAbilityImpactSignature(card, x, y, card.radius ?? 150);
      } else if (card.behavior === "self-area") {
        const radius = card.radius ?? 140;
        this.spawnPulse(originX, originY, radius, ABILITY_COLORS[card.element]);
        this.spawnAbilityAreaSignature(card, originX, originY, radius);
      } else if (card.behavior === "renewal") {
        const radius = card.radius ?? 105;
        this.spawnPulse(originX, originY, radius, ABILITY_COLORS[card.element]);
        this.spawnAbilityAreaSignature(card, originX, originY, radius);
      }
    }

    private spawnAbilityProjectileSignature(
      card: (typeof selectedCards)[number],
      direction: import("phaser").Math.Vector2,
      originX: number,
      originY: number,
      speed: number,
      lifeMs: number,
    ) {
      const ribbon = this.add.graphics();
      const color = ABILITY_COLORS[card.element];
      const container = this.add.container(originX, originY, [ribbon])
        .setDepth(13)
        .setRotation(Math.atan2(direction.y, direction.x));

      const effectId = card.visualEffectId ?? card.id;
      if (effectId === "boitata-flame") {
        // A narrow, banded body, forked tail, and diamond head make this read as a
        // small fire-serpent instead of another round projectile.
        ribbon.lineStyle(9, 0x8d3023, 0.95).beginPath()
          .moveTo(-34, 5).lineTo(-27, -2).lineTo(-20, 4).lineTo(-13, -4)
          .lineTo(-6, 1).lineTo(1, -5).lineTo(8, 0).strokePath();
        ribbon.lineStyle(5, 0xff7135, 1).beginPath()
          .moveTo(-34, 5).lineTo(-27, -2).lineTo(-20, 4).lineTo(-13, -4)
          .lineTo(-6, 1).lineTo(1, -5).lineTo(8, 0).strokePath();
        ribbon.lineStyle(2, 0xffe48a, 0.98).beginPath()
          .moveTo(-27, -2).lineTo(-20, 4).lineTo(-13, -4).lineTo(-6, 1).lineTo(1, -5).strokePath();
        ribbon.fillStyle(0xffa23f, 1).fillPoints([
          { x: 4, y: -7 }, { x: 15, y: 0 }, { x: 4, y: 7 }, { x: -1, y: 0 },
        ], true);
        ribbon.fillStyle(0xffef9c, 1).fillTriangle(4, -3, 13, 0, 4, 3);
        ribbon.fillStyle(0x37251d, 1).fillRect(6, -3, 2, 2);
        ribbon.lineStyle(2, 0xffb34f, 1).beginPath()
          .moveTo(11, -3).lineTo(18, -7).moveTo(11, 3).lineTo(18, 7).strokePath();
        ribbon.fillStyle(0xffd36c, 0.95).fillTriangle(-35, 4, -42, 0, -34, 0);
      } else {
        // Purchased shots keep their element, but use different silhouettes too.
        if (card.element === "nature") {
          ribbon.fillStyle(color, 0.96).fillPoints([
            { x: 14, y: 0 }, { x: 3, y: -7 }, { x: -12, y: 0 }, { x: 3, y: 7 },
          ], true);
          ribbon.lineStyle(2, 0xe2f0a1, 0.95).beginPath().moveTo(-9, 0).lineTo(10, 0).strokePath();
          ribbon.lineStyle(2, 0x477249, 0.95).beginPath().moveTo(-4, 0).lineTo(-9, -5).moveTo(1, 0).lineTo(-2, 5).strokePath();
        } else if (card.element === "water") {
          ribbon.lineStyle(7, 0x277d9a, 0.9).beginPath().moveTo(-15, 5).lineTo(-8, -4).lineTo(-1, 4).lineTo(6, -4).lineTo(14, 2).strokePath();
          ribbon.lineStyle(3, 0xb7efff, 1).beginPath().moveTo(-15, 2).lineTo(-8, -7).lineTo(-1, 1).lineTo(6, -7).lineTo(14, -1).strokePath();
        } else if (card.element === "storm") {
          ribbon.fillStyle(color, 0.96).fillPoints([
            { x: 15, y: 0 }, { x: 1, y: -4 }, { x: 5, y: -10 }, { x: -13, y: 1 },
            { x: -1, y: 3 }, { x: -5, y: 9 },
          ], true);
          ribbon.lineStyle(2, 0xf1fbff, 0.95).beginPath().moveTo(-7, 1).lineTo(3, -1).lineTo(-1, 5).strokePath();
        } else {
          ribbon.fillStyle(color, 0.92).fillPoints([
            { x: 13, y: 0 }, { x: 0, y: -9 }, { x: -13, y: 0 }, { x: 0, y: 9 },
          ], true);
          ribbon.fillStyle(0xf0e3ff, 0.9).fillPoints([
            { x: 5, y: 0 }, { x: 0, y: -4 }, { x: -5, y: 0 }, { x: 0, y: 4 },
          ], true);
        }
      }

      this.tweens.add({
        targets: container,
        x: originX + direction.x * speed * lifeMs / 1000,
        y: originY + direction.y * speed * lifeMs / 1000,
        alpha: { from: 0.35, to: 1 },
        duration: lifeMs,
        ease: "Linear",
        onComplete: () => container.destroy(),
      });
    }

    private spawnAbilityImpactSignature(card: (typeof selectedCards)[number], x: number, y: number, radius: number) {
      const art = this.add.graphics().setPosition(x, y).setDepth(12);
      const color = ABILITY_COLORS[card.element];
      const effectId = card.visualEffectId ?? card.id;

      if (effectId === "ancestral-roots") {
        // Eight crooked roots burst from the chosen point, with bark shadow,
        // warm wood, and pale living cambium to preserve the pixel-cluster read.
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI / 4 + Math.PI / 8;
          const length = Math.min(96, radius * 0.62) * (index % 2 === 0 ? 1 : 0.76);
          const side = index % 2 === 0 ? 1 : -1;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const px = -uy * side;
          const py = ux * side;
          const points = [
            { x: 0, y: 0 },
            { x: ux * length * 0.34 + px * 7, y: uy * length * 0.34 + py * 7 },
            { x: ux * length * 0.7 - px * 6, y: uy * length * 0.7 - py * 6 },
            { x: ux * length + px * 3, y: uy * length + py * 3 },
          ];
          art.lineStyle(13, 0x3b3025, 0.98).beginPath().moveTo(points[0].x, points[0].y)
            .lineTo(points[1].x, points[1].y).lineTo(points[2].x, points[2].y).lineTo(points[3].x, points[3].y).strokePath();
          art.lineStyle(8, 0x77543a, 1).beginPath().moveTo(points[0].x, points[0].y)
            .lineTo(points[1].x, points[1].y).lineTo(points[2].x, points[2].y).lineTo(points[3].x, points[3].y).strokePath();
          art.lineStyle(2, 0xb0c66b, 0.95).beginPath().moveTo(points[1].x, points[1].y)
            .lineTo(points[2].x, points[2].y).strokePath();
          const forkX = points[1].x + px * 13;
          const forkY = points[1].y + py * 13;
          art.lineStyle(5, 0x684b35, 0.96).beginPath().moveTo(points[1].x, points[1].y)
            .lineTo(forkX, forkY).lineTo(forkX + ux * 9, forkY + uy * 9).strokePath();
        }
        art.fillStyle(0x49372a, 0.92).fillPoints([
          { x: 0, y: -15 }, { x: 15, y: 0 }, { x: 0, y: 15 }, { x: -15, y: 0 },
        ], true);
        art.fillStyle(0xb6c96a, 0.96).fillPoints([
          { x: 0, y: -8 }, { x: 8, y: 0 }, { x: 0, y: 8 }, { x: -8, y: 0 },
        ], true);
      } else if (effectId === "kraken-grasp") {
        for (let arm = 0; arm < 6; arm += 1) {
          const angle = arm * Math.PI / 3;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const px = -uy;
          const py = ux;
          const length = Math.min(76, radius * 0.55);
          art.lineStyle(10, 0x174b56, 0.94).beginPath()
            .moveTo(0, 0).lineTo(ux * 18 + px * 8, uy * 18 + py * 8)
            .lineTo(ux * 39 - px * 9, uy * 39 - py * 9)
            .lineTo(ux * length + px * 12, uy * length + py * 12).strokePath();
          art.lineStyle(4, 0x65c2b6, 0.96).beginPath()
            .moveTo(0, 0).lineTo(ux * 18 + px * 8, uy * 18 + py * 8)
            .lineTo(ux * 39 - px * 9, uy * 39 - py * 9)
            .lineTo(ux * length + px * 12, uy * length + py * 12).strokePath();
          art.fillStyle(0xd7e7a2, 0.9).fillCircle(ux * 28 + px * 4, uy * 28 + py * 4, 2);
        }
      } else if (effectId === "medusa-gaze") {
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI / 4;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const px = -uy;
          const py = ux;
          const cx = ux * 42;
          const cy = uy * 42;
          art.fillStyle(0x59666a, 0.9).fillPoints([
            { x: cx - ux * 8 + px * 8, y: cy - uy * 8 + py * 8 },
            { x: cx + ux * 15, y: cy + uy * 15 },
            { x: cx - ux * 8 - px * 8, y: cy - uy * 8 - py * 8 },
          ], true);
          art.lineStyle(2, 0xd3cfaa, 0.86).beginPath()
            .moveTo(cx - ux * 7, cy - uy * 7).lineTo(cx + ux * 11, cy + uy * 11).strokePath();
        }
      } else if (card.element === "water") {
        for (let ring = 0; ring < 3; ring += 1) {
          const r = 22 + ring * 17;
          art.lineStyle(3 - ring * 0.4, ring === 0 ? 0xc1f2ed : color, 0.9 - ring * 0.12)
            .strokeCircle(0, 0, r);
          art.fillStyle(0xc9f8e8, 0.88).fillPoints([
            { x: r, y: -4 }, { x: r + 7, y: 0 }, { x: r, y: 4 }, { x: r - 3, y: 0 },
          ], true);
        }
      } else if (card.element === "storm") {
        for (let ray = 0; ray < 4; ray += 1) {
          const angle = ray * Math.PI / 2 + Math.PI / 4;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const px = -uy;
          const py = ux;
          const tipX = ux * 64;
          const tipY = uy * 64;
          art.lineStyle(7, 0x526e8a, 0.9).beginPath()
            .moveTo(-ux * 12, -uy * 12).lineTo(ux * 17 + px * 8, uy * 17 + py * 8)
            .lineTo(tipX, tipY).strokePath();
          art.lineStyle(3, 0xd7f5ff, 0.98).beginPath()
            .moveTo(-ux * 12, -uy * 12).lineTo(ux * 17 + px * 8, uy * 17 + py * 8)
            .lineTo(tipX, tipY).strokePath();
        }
      } else if (card.element === "spirit") {
        for (let rune = 0; rune < 6; rune += 1) {
          const angle = rune * Math.PI / 3;
          const cx = Math.cos(angle) * 45;
          const cy = Math.sin(angle) * 45;
          art.lineStyle(2, 0xe8daff, 0.96).strokePoints([
            { x: cx, y: cy - 7 }, { x: cx + 6, y: cy }, { x: cx, y: cy + 7 }, { x: cx - 6, y: cy }, { x: cx, y: cy - 7 },
          ]);
          art.fillStyle(color, 0.9).fillRect(cx - 2, cy - 2, 4, 4);
        }
      } else {
        for (let ray = 0; ray < 8; ray += 1) {
          const angle = ray * Math.PI / 4;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          art.fillTriangle(ux * 18, uy * 18, ux * 56 - uy * 7, uy * 56 + ux * 7, ux * 56 + uy * 7, uy * 56 - ux * 7);
        }
      }

      art.setScale(0.42).setAlpha(0);
      this.tweens.add({
        targets: art,
        scale: { from: 0.42, to: 1 },
        alpha: { from: 0, to: 0.94 },
        duration: 145,
        ease: "Back.easeOut",
        onComplete: () => this.tweens.add({
          targets: art,
          alpha: 0,
          scale: 1.1,
          duration: 350,
          delay: 100,
          ease: "Quad.easeIn",
          onComplete: () => art.destroy(),
        }),
      });
    }

    private spawnAbilityAreaSignature(card: (typeof selectedCards)[number], x: number, y: number, radius: number) {
      const art = this.add.graphics().setPosition(x, y).setDepth(12);
      const color = ABILITY_COLORS[card.element];
      const span = Math.min(82, radius * 0.55);
      const effectId = card.visualEffectId ?? card.id;

      if (effectId === "saci-whirlwind") {
        for (let turn = 0; turn < 3; turn += 1) {
          const offset = turn * 9;
          art.lineStyle(4 - turn * 0.6, turn === 1 ? 0xe2d5a2 : color, 0.9);
          art.beginPath().moveTo(-span * 0.62 + offset, -span * 0.2)
            .lineTo(-span * 0.3, -span * 0.52 + offset)
            .lineTo(span * 0.15, -span * 0.44)
            .lineTo(span * 0.5, -span * 0.08 + offset)
            .lineTo(span * 0.22, span * 0.28)
            .lineTo(-span * 0.28 + offset, span * 0.33)
            .lineTo(-span * 0.08, -span * 0.02).strokePath();
        }
      } else if (effectId === "kappa-splash") {
        for (let drop = 0; drop < 10; drop += 1) {
          const angle = drop * Math.PI / 5;
          const distance = span * (0.45 + (drop % 2) * 0.22);
          const dx = Math.cos(angle) * distance;
          const dy = Math.sin(angle) * distance;
          art.fillStyle(drop % 2 ? 0x9de6e9 : 0xe0f8cc, 0.95)
            .fillTriangle(dx, dy - 8, dx + 5, dy + 4, dx - 5, dy + 4);
        }
        art.lineStyle(3, color, 0.92).strokeCircle(0, 0, span * 0.3);
      } else if (effectId === "iara-song" || card.element === "water") {
        for (let wave = 0; wave < 4; wave += 1) {
          const yy = (wave - 1.5) * 14;
          art.lineStyle(wave === 0 ? 4 : 2, wave % 2 === 0 ? 0xc8f5ef : color, 0.92 - wave * 0.08)
            .beginPath().moveTo(-span, yy)
            .lineTo(-span * 0.62, yy - 7).lineTo(-span * 0.24, yy + 5)
            .lineTo(span * 0.15, yy - 6).lineTo(span * 0.58, yy + 6).lineTo(span, yy)
            .strokePath();
        }
        for (let drop = 0; drop < 6; drop += 1) {
          const angle = drop * Math.PI / 3;
          const dx = Math.cos(angle) * span * 0.75;
          const dy = Math.sin(angle) * span * 0.62;
          art.fillTriangle(dx, dy - 5, dx + 4, dy + 2, dx - 4, dy + 2);
        }
      } else if (effectId === "tengu-gust" || card.element === "storm") {
        for (let ray = 0; ray < 5; ray += 1) {
          const yy = (ray - 2) * 11;
          art.lineStyle(ray === 2 ? 5 : 3, ray % 2 ? 0xe0f7ff : color, 0.94);
          art.beginPath().moveTo(-span * 0.78, yy + 12).lineTo(-span * 0.32, yy + 5)
            .lineTo(span * 0.1, yy - 4).lineTo(span * 0.72, yy - 14).strokePath();
        }
      } else if (effectId === "banshee-wail") {
        for (let ring = 0; ring < 3; ring += 1) {
          art.lineStyle(3 - ring * 0.6, ring === 1 ? 0xf5eaff : color, 0.88)
            .strokeCircle(0, 0, 22 + ring * 18);
        }
        for (let rune = 0; rune < 4; rune += 1) {
          const angle = rune * Math.PI / 2 + Math.PI / 4;
          const cx = Math.cos(angle) * 53;
          const cy = Math.sin(angle) * 53;
          art.fillStyle(0xf5eaff, 0.94).fillPoints([
            { x: cx, y: cy - 6 }, { x: cx + 5, y: cy }, { x: cx, y: cy + 6 }, { x: cx - 5, y: cy },
          ], true);
        }
      } else if (card.behavior === "renewal") {
        art.lineStyle(3, 0xf3ddaa, 0.96).strokeCircle(0, 0, 34);
        for (let wing = 0; wing < 6; wing += 1) {
          const angle = wing * Math.PI / 3;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          art.fillPoints([
            { x: ux * 29, y: uy * 29 },
            { x: ux * 61 - uy * 8, y: uy * 61 + ux * 8 },
            { x: ux * 43, y: uy * 43 },
            { x: ux * 61 + uy * 8, y: uy * 61 - ux * 8 },
          ], true);
        }
      } else if (card.element === "nature") {
        for (let leaf = 0; leaf < 6; leaf += 1) {
          const angle = leaf * Math.PI / 3;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const cx = ux * span * 0.62;
          const cy = uy * span * 0.62;
          art.fillStyle(color, 0.94).fillPoints([
            { x: cx - uy * 8, y: cy + ux * 8 },
            { x: cx + ux * 11, y: cy + uy * 11 },
            { x: cx + uy * 8, y: cy - ux * 8 },
            { x: cx - ux * 11, y: cy - uy * 11 },
          ], true);
          art.lineStyle(2, 0xd8e69d, 0.92).beginPath().moveTo(0, 0).lineTo(cx, cy).strokePath();
        }
      } else if (card.element === "spirit") {
        for (let rune = 0; rune < 6; rune += 1) {
          const angle = rune * Math.PI / 3;
          const cx = Math.cos(angle) * span * 0.64;
          const cy = Math.sin(angle) * span * 0.64;
          art.lineStyle(2, 0xf4e8ff, 0.95).strokePoints([
            { x: cx, y: cy - 7 }, { x: cx + 6, y: cy }, { x: cx, y: cy + 7 }, { x: cx - 6, y: cy }, { x: cx, y: cy - 7 },
          ]);
        }
      } else {
        for (let flame = 0; flame < 8; flame += 1) {
          const angle = flame * Math.PI / 4;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const cx = ux * span * 0.58;
          const cy = uy * span * 0.58;
          art.fillStyle(flame % 2 ? 0xff8a3b : 0xffd16b, 0.95).fillTriangle(
            cx - uy * 5 - ux * 8, cy + ux * 5 - uy * 8,
            cx + ux * 11, cy + uy * 11,
            cx + uy * 5 - ux * 8, cy - ux * 5 - uy * 8,
          );
        }
      }

      art.setScale(0.68).setAlpha(0);
      this.tweens.add({
        targets: art,
        scale: { from: 0.68, to: 1.08 },
        alpha: { from: 0, to: 0.9 },
        rotation: effectId === "saci-whirlwind" ? Math.PI * 2 : Math.PI / 24,
        duration: 440,
        ease: "Quad.easeOut",
        onComplete: () => this.tweens.add({
          targets: art,
          alpha: 0,
          duration: 250,
          ease: "Quad.easeIn",
          onComplete: () => art.destroy(),
        }),
      });
    }

    private fireProjectile(
      direction: import("phaser").Math.Vector2,
      damage: number,
      speed: number,
      tint: number,
      lifeMs: number,
      piercing: boolean,
    ) {
      const projectile = this.projectiles.get(this.player.x, this.player.y, "arpg-projectile") as ArcadeSprite | null;
      if (!projectile) return;
      projectile.setActive(true).setVisible(true).setTint(tint).setDepth(11);
      projectile.body!.enable = true;
      projectile.setCircle(5, 1, 1);
      projectile.setVelocity(direction.x * speed, direction.y * speed);
      projectile.setData("damage", damage);
      projectile.setData("expiresAt", this.time.now + lifeMs);
      projectile.setData("piercing", piercing);
      projectile.setData("hitIds", new Set<string>());
    }

    private fireEnemyProjectile(
      enemy: ArcadeSprite,
      direction: import("phaser").Math.Vector2,
      damage: number,
      speed: number,
      tint: number,
      lifeMs = 1800,
    ) {
      if (bridge.isServerAuthoritativeCombat()) return;
      const projectile = this.enemyProjectiles.get(enemy.x, enemy.y, "arpg-projectile") as ArcadeSprite | null;
      if (!projectile) return;
      projectile.setActive(true).setVisible(true).setTint(tint).setDepth(11);
      projectile.body!.enable = true;
      projectile.setCircle(5, 1, 1);
      projectile.setVelocity(direction.x * speed, direction.y * speed);
      projectile.setData("damage", damage);
      projectile.setData("expiresAt", this.time.now + lifeMs);
    }

    private cleanupExpiredProjectiles(time: number) {
      [this.projectiles, this.enemyProjectiles].forEach((group) => {
        group.getChildren().forEach((child) => {
          const projectile = child as ArcadeSprite;
          if (!projectile.active) return;
          if (time >= Number(projectile.getData("expiresAt"))) {
            this.recycleProjectile(projectile);
          }
        });
      });
    }

    private recycleProjectile(projectile: ArcadeSprite) {
      projectile.setActive(false).setVisible(false).setVelocity(0, 0);
      if (projectile.body) projectile.body.enable = false;
    }

    private clearEnemyProjectiles() {
      this.enemyProjectiles.getChildren().forEach((child) => {
        this.recycleProjectile(child as ArcadeSprite);
      });
    }

    private handleProjectileHit(projectile: ArcadeSprite, enemy: ArcadeSprite) {
      if (!projectile.active || !enemy.active || !enemy.getData("spawnReady")) return;
      const hitIds = projectile.getData("hitIds") as Set<string>;
      const enemyId = String(enemy.getData("runtimeId"));
      if (hitIds.has(enemyId)) return;
      hitIds.add(enemyId);
      this.damageEnemy(enemy, Number(projectile.getData("damage")) || 0);
      if (!projectile.getData("piercing")) this.recycleProjectile(projectile);
    }
    private handleEnemyProjectileHit(projectile: ArcadeSprite) {
      if (!this.enemyProjectiles.contains(projectile) || !projectile.active || this.runEnded) return;
      const time = this.time.now;
      if (time < this.dashingUntil) {
        this.recycleProjectile(projectile);
        return;
      }
      if (time >= this.nextPlayerDamageAt) {
        this.applyPlayerDamage(Number(projectile.getData("damage")) || 8, time);
      }
      this.recycleProjectile(projectile);
    }

    private damageEnemiesInRadius(
      x: number,
      y: number,
      radius: number,
      damage: number,
      root: boolean,
      rootedUntil = 0,
    ) {
      this.damageBreakablesInRadius(x, y, radius, damage);
      this.enemies.getChildren().forEach((child) => {
        const enemy = child as ArcadeSprite;
        if (!enemy.active || !enemy.getData("spawnReady")) return;
        if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) return;
        this.damageEnemy(enemy, damage);
        if (root && enemy.active) enemy.setData("rootedUntil", rootedUntil);
      });
    }

    private damageEnemy(enemy: ArcadeSprite, damage: number) {
      if (bridge.isServerAuthoritativeCombat() && this.proceduralController) return;
      this.playSound("enemy-hit");
      const nextHp = Math.max(0, Number(enemy.getData("hp")) - damage);
      enemy.setData("hp", nextHp);
      enemy.setAlpha(0.45);
      this.time.delayedCall(80, () => enemy.active && enemy.setAlpha(1));

      if (nextHp > 0) {
        if (this.playEnemyProfileAction(enemy, "damage", this.time.now, 360)) return;
        const actorId = enemy.getData("nativeFallbackActorId") as NativePixelActorId | null;
        if (actorId) {
          enemy.setData("actionAnimationUntil", this.time.now + 400);
          this.playNativeFallbackAnimation(enemy, actorId, "damage", true);
        }
        return;
      }
      const baseXp = Number(enemy.getData("rewardXp")) || 0;
      this.xpEarned += Math.round(baseXp * getRelicXpMultiplier(selectedRelic));
      this.runShards += getRunShardReward(baseXp);
      this.spawnPulse(enemy.x, enemy.y, 34, Number(enemy.getData("tint")) || 0xffffff);
      const animationProfile = enemy.getData("animationProfile");
      if (isArpgEnemyAnimationProfile(animationProfile)) {
        if (enemy.getData("defeatPending")) return;
        enemy.setData("defeatPending", true);
        enemy.setData("spawnReady", false);
        enemy.setVelocity(0, 0);
        if (enemy.body) enemy.body.enable = false;
        this.playTrackedEnemyAnimation(enemy, animationProfile, "defeat", true);
        this.time.delayedCall(700, () => {
          if (!enemy.scene) return;
          enemy.disableBody(true, true);
          if (dungeonManager && this.proceduralController) {
            this.proceduralController.enemyDefeated();
          }
        });
        return;
      }
      const nativeFallbackActorId = enemy.getData("nativeFallbackActorId") as NativePixelActorId | null;
      if (nativeFallbackActorId) {
        if (enemy.getData("defeatPending")) return;
        enemy.setData("defeatPending", true);
        enemy.setData("spawnReady", false);
        enemy.setVelocity(0, 0);
        if (enemy.body) enemy.body.enable = false;
        this.playNativeFallbackAnimation(enemy, nativeFallbackActorId, "defeat", true);
        this.time.delayedCall(700, () => {
          if (!enemy.scene) return;
          enemy.disableBody(true, true);
          if (dungeonManager && this.proceduralController) {
            this.proceduralController.enemyDefeated();
          }
        });
        return;
      }
      enemy.disableBody(true, true);
      if (dungeonManager && this.proceduralController) {
        this.proceduralController.enemyDefeated();
      }
    }

    private spawnPulse(x: number, y: number, radius: number, color: number) {
      const ring = this.add.image(Math.round(x), Math.round(y), "arpg-pixel-pulse")
        .setDisplaySize(Math.max(24, radius * 0.3), Math.max(24, radius * 0.3))
        .setTint(color).setAlpha(0.9).setDepth(12);
      this.tweens.add({
        targets: ring,
        scaleX: radius * 2 / 64,
        scaleY: radius * 2 / 64,
        alpha: 0,
        duration: 360,
        ease: "Quad.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
    private updateProceduralRoom(time: number) {
      if (!dungeonManager || !this.dungeonWorld) return;
      const roomAtPlayer = this.dungeonWorld.findRoomAt(this.player.x, this.player.y, 28);
      if (!roomAtPlayer) return;

      if (roomAtPlayer.id !== this.proceduralRoomId) {
        try {
          const entered = dungeonManager.enterRoom(roomAtPlayer.id);
          this.clearClickPath();
          this.proceduralRoomId = entered.id;
          this.proceduralController = null;
          this.proceduralWaveTransitionScheduled = false;
          this.dungeonWorld.focusCamera(entered.id);
          this.emitRunCheckpoint();
          this.activateProceduralRoom(entered, time);
        } catch {
          return;
        }
      }

      const room = dungeonManager.getCurrentRoom();
      if (room.id !== roomAtPlayer.id) return;
      if (!this.proceduralController && room.state === "active") {
        this.activateProceduralRoom(room, time);
      }

      const controller = this.proceduralController;
      if (!controller) return;
      const snapshot = controller.snapshot();
      if (snapshot.state !== "wave_complete" || this.proceduralWaveTransitionScheduled) return;

      this.proceduralWaveTransitionScheduled = true;
      this.clearEnemyProjectiles();
      this.time.delayedCall(520, () => {
        if (!this.proceduralController || !dungeonManager || !this.dungeonWorld || this.runEnded) return;
        const next = this.proceduralController.completeWave();
        this.proceduralWaveTransitionScheduled = false;
        if (next.state === "cleared") {
          const cleared = dungeonManager.clearRoom(room.id);
          this.proceduralController = null;
          this.spawnProceduralReward(cleared, this.time.now);
          return;
        }
        this.spawnProceduralWave(room, next.waveIndex + 1, this.time.now);
      });
    }

    private activateProceduralRoom(room: DungeonRoom, time: number) {
      if (!dungeonManager || !this.dungeonWorld) return;
      this.ensureBreakableObjects(room);
      if (room.state === "cleared") {
        this.dungeonWorld.setDoorsLocked(room.id, false);
        bridge.emitMessage(`${this.proceduralRoomLabel(room)} já foi concluída.`);
        return;
      }

      this.audio?.setMusicMode(room.type === "boss" ? "boss" : "exploration");

      if (room.waves.length > 0) {
        dungeonManager.startCombat(room.id);
        const controller = new CombatRoomController(room.waves.length, false);
        controller.enter();
        this.proceduralController = controller;
        this.dungeonWorld.setDoorsLocked(room.id, true);
        this.spawnProceduralWave(room, 0, time);
        if (bridge.isServerAuthoritativeCombat()) {
          if (this.serverCombatState?.roomId === room.id && ["victory", "defeat"].includes(this.serverCombatState.status)) {
            this.applyServerCombatState(this.serverCombatState, "sync", time);
          } else {
            this.submitServerCombatCommand(room.id, "sync", time);
          }
        }
        return;
      }

      if (room.type === "treasure") {
        this.spawnProceduralReward(room, time);
        return;
      }

      const encounter = getSpecialRoomEncounter(dungeon.id, room.type);
      if (encounter) {
        this.playSound("special-room");
        this.ensureSpecialRoomAnchor(room, encounter);
        this.dungeonWorld.setDoorsLocked(room.id, false);
        bridge.emitMessage(`${encounter.title}: aproxime-se do ponto marcado e pressione E para interagir.`);
        this.emitHud(time);
        return;
      }

      if (room.type !== "start") dungeonManager.clearRoom(room.id);
      this.dungeonWorld.setDoorsLocked(room.id, false);
    }

    private ensureBreakableObjects(room: DungeonRoom) {
      if (!this.dungeonWorld || this.breakableRooms.has(room.id)) return;
      this.breakableRooms.add(room.id);
      const graph = dungeonManager?.getGraph();
      const layout = this.dungeonWorld.layout.rooms[room.id];
      if (!graph || !layout) return;

      const placements = getUnbrokenBreakablePlacements(
        createBreakableObjectPlacements(graph.seed, room, graph.regionId),
        this.brokenBreakableIds,
      );
      for (const placement of placements) {
        const object = this.breakableObjects.create(
          layout.left + placement.x,
          layout.top + placement.y,
          `arpg-breakable-${placement.kind}`,
        ) as ArcadeSprite | null;
        if (!object) continue;
        object.setDepth(8).setScale(0.92).setCircle(15, 5, 5);
        const body = object.body as import("phaser").Physics.Arcade.Body | null;
        if (body) body.immovable = true;
        object.setData("breakableId", placement.id);
        object.setData("roomId", room.id);
        object.setData("kind", placement.kind);
        object.setData("hitPoints", placement.hitPoints);
      }
    }

    private handleProjectileBreakableHit(projectile: ArcadeSprite, object: ArcadeSprite) {
      if (!projectile.active || !object.active) return;
      const hitIds = (projectile.getData("hitIds") as Set<string> | undefined) ?? new Set<string>();
      const breakableId = `breakable:${String(object.getData("breakableId"))}`;
      if (hitIds.has(breakableId)) return;
      hitIds.add(breakableId);
      projectile.setData("hitIds", hitIds);
      this.damageBreakableObject(object, Number(projectile.getData("damage")) || 1);
      if (!projectile.getData("piercing")) this.recycleProjectile(projectile);
    }

    private damageBreakablesInRadius(x: number, y: number, radius: number, damage: number) {
      this.breakableObjects.getChildren().forEach((child) => {
        const object = child as ArcadeSprite;
        if (!object.active || object.getData("roomId") !== this.proceduralRoomId) return;
        if (Phaser.Math.Distance.Between(x, y, object.x, object.y) > radius + 18) return;
        this.damageBreakableObject(object, damage);
      });
    }

    private damageBreakableObject(object: ArcadeSprite, damage: number) {
      const breakableId = String(object.getData("breakableId"));
      if (!object.active || this.brokenBreakableIds.has(breakableId)) return;
      const hitPoints = applyBreakableObjectDamage(Number(object.getData("hitPoints")), damage);
      object.setData("hitPoints", hitPoints);
      if (hitPoints > 0) {
        this.playSound("breakable-hit");
        object.setTintFill(0xffdda0);
        this.time.delayedCall(95, () => {
          if (object.active) object.clearTint();
        });
        return;
      }

      const kind = String(object.getData("kind"));
      const debrisColor = kind === "shrub" ? 0x7dac56
        : kind === "relic" ? 0x83c5c4
          : kind === "vase" ? 0xd18a62
            : 0xd3a365;
      this.playSound("breakable-break");
      this.spawnPulse(object.x, object.y, 30, debrisColor);
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        const debris = this.add.rectangle(object.x, object.y, 5, 5, debrisColor).setDepth(12);
        this.tweens.add({
          targets: debris,
          x: object.x + Math.cos(angle) * 24,
          y: object.y + Math.sin(angle) * 24,
          alpha: 0,
          scale: 0.35,
          duration: 240,
          onComplete: () => debris.destroy(),
        });
      }
      this.brokenBreakableIds.add(breakableId);
      this.runShards += 1;
      const fragment = this.add.image(object.x, object.y - 8, "arpg-run-fragment")
        .setDepth(13)
        .setScale(0.7);
      this.tweens.add({
        targets: fragment,
        y: fragment.y - 28,
        alpha: 0,
        scale: 0.2,
        duration: 520,
        ease: "Quad.easeOut",
        onComplete: () => fragment.destroy(),
      });
      object.disableBody(true, true);
      this.playSound("loot");
      bridge.emitMessage("Fragmento da run recolhido: +1.");
      this.emitRunCheckpoint();
      this.emitHud(this.time.now);
    }

    private resolvePendingRoomChoice(choiceIdRaw: string, time: number) {
      if (!this.pendingRoomChoice || !dungeonManager || !this.dungeonWorld) return;
      const option = this.pendingRoomChoice.options.find((item) => item.id === choiceIdRaw);
      if (!option) return;
      if (option.costShards > this.runShards) {
        bridge.emitMessage(`Fragmentos insuficientes: ${option.costShards} necessários.`);
        return;
      }

      const result = resolveSpecialRoomChoice(dungeon.id, choiceIdRaw as SpecialRoomChoiceId);
      this.runShards = Math.max(0, this.runShards + result.shardsDelta);
      this.hp = Math.max(1, Math.min(this.maxHp, this.hp + result.hpDelta));
      this.runMoveSpeedBonus = Math.max(this.runMoveSpeedBonus, result.moveSpeedBonus);
      this.runBasicDamageMultiplier = Math.max(this.runBasicDamageMultiplier, result.basicDamageMultiplier);

      const room = dungeonManager.getCurrentRoom();
      dungeonManager.clearRoom(room.id);
      const completedAnchor = this.specialRoomAnchors.get(room.id);
      completedAnchor?.display.setAlpha(0.42);
      completedAnchor?.prompt.setText("RESOLVIDO");
      this.dungeonWorld.setDoorsLocked(room.id, false);
      this.pendingRoomChoice = null;
      bridge.emitMessage(result.message);
      this.emitRunCheckpoint();
      this.emitHud(time);
    }

    private ensureSpecialRoomAnchor(room: DungeonRoom, encounter: SpecialRoomEncounter) {
      if (!this.dungeonWorld || this.specialRoomAnchors.has(room.id)) return;
      const layout = this.dungeonWorld.layout.rooms[room.id];
      if (!layout) return;

      const marker = this.add.container(layout.centerX, layout.centerY).setDepth(8);
      const art = this.add.graphics();
      const sea = dungeon.id === "arquipelago-das-mares";
      const mountain = dungeon.id === "montanhas-runicas";
      const stone = sea ? 0x426b76 : mountain ? 0x64798b : 0x68624e;
      const shade = sea ? 0x1b3b47 : mountain ? 0x334452 : 0x35392f;
      const accent = sea ? 0x76d4d1 : mountain ? 0x9edcff : 0xb7d77a;
      const warm = sea ? 0xf0bf73 : mountain ? 0xe5f2ff : 0xf2bd62;

      art.fillStyle(0x101a1d, 0.34);
      art.fillEllipse(0, 42, 208, 62);
      art.fillStyle(shade, 1);
      art.fillEllipse(0, 34, 168, 46);
      art.fillStyle(stone, 1);
      art.fillEllipse(0, 30, 132, 34);

      if (encounter.type === "rest") {
        art.fillStyle(0x6a4530, 1);
        art.fillRect(-48, 11, 96, 12);
        art.fillRect(-40, 1, 80, 10);
        art.fillStyle(warm, 1);
        art.fillTriangle(0, -37, -17, 4, 17, 4);
        art.fillStyle(0xff7b43, 1);
        art.fillTriangle(0, -22, -10, 5, 10, 5);
        art.fillStyle(0xffe59a, 1);
        art.fillTriangle(0, -13, -4, 2, 4, 2);
        art.fillStyle(accent, 0.9);
        art.fillRect(-68, 23, 15, 6);
        art.fillRect(53, 23, 15, 6);
      } else if (encounter.type === "shop") {
        art.fillStyle(shade, 1);
        art.fillRect(-58, -48, 116, 12);
        art.fillStyle(accent, 1);
        art.fillTriangle(-70, -47, 0, -94, 70, -47);
        art.fillStyle(warm, 1);
        art.fillRect(-56, -46, 112, 7);
        art.fillStyle(0x714831, 1);
        art.fillRect(-67, -2, 134, 15);
        art.fillStyle(stone, 1);
        art.fillRect(-56, 12, 112, 13);
        art.fillStyle(0x8c5f44, 1);
        art.fillRect(-49, 25, 9, 24);
        art.fillRect(40, 25, 9, 24);
        art.fillStyle(warm, 1);
        art.fillCircle(0, -23, 13);
        art.fillStyle(shade, 1);
        art.fillTriangle(-20, -30, 0, -56, 20, -30);
        art.fillRect(-13, -22, 26, 22);
        art.fillStyle(sea ? 0x8de2c4 : mountain ? 0xbde6ff : 0xc1cf83, 1);
        art.fillRect(-36, 0, 12, 18);
        art.fillRect(24, 0, 12, 18);
      } else {
        art.fillStyle(shade, 1);
        art.fillRect(-36, -42, 72, 84);
        art.fillStyle(stone, 1);
        art.fillRect(-29, -51, 58, 14);
        art.fillRect(-29, 28, 58, 17);
        art.fillStyle(accent, 1);
        art.fillTriangle(0, -83, -19, -46, 19, -46);
        art.fillStyle(warm, 0.95);
        art.fillCircle(0, -59, 8);
        art.fillStyle(sea ? 0x4fbab9 : mountain ? 0x8bc9f2 : 0x91bb5e, 0.72);
        art.fillEllipse(0, 5, 22, 31);
      }

      marker.add(art);
      const prompt = this.add.text(0, -116, "INTERAGIR", {
        color: "#fff0bf",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "#241d18",
        padding: { x: 7, y: 4 },
      }).setOrigin(0.5);
      marker.add(prompt);
      this.specialRoomAnchors.set(room.id, {
        encounter,
        x: layout.centerX,
        y: layout.centerY,
        display: marker,
        prompt,
      });
    }

    private tryInteractSpecialRoom(time: number) {
      if (!dungeonManager || !this.dungeonWorld) return;
      const room = dungeonManager.getCurrentRoom();
      const anchor = this.specialRoomAnchors.get(room.id);
      if (!anchor || room.state !== "active") return;
      if (!isWithinSpecialRoomInteractionRange(this.player.x, this.player.y, anchor.x, anchor.y)) {
        bridge.emitMessage("Aproxime-se do ponto marcado para interagir com a sala especial.");
        return;
      }

      this.playPlayerAction("idle", time, 520);
      this.pendingRoomChoice = anchor.encounter;
      this.dungeonWorld.setDoorsLocked(room.id, true);
      bridge.emitMessage(`Você se aproxima de ${anchor.encounter.title.toLocaleLowerCase("pt-BR")} e avalia suas opções.`);
      this.emitHud(time);
    }

    private spawnProceduralWave(room: DungeonRoom, waveIndex: number, time: number) {
      if (!this.proceduralController || !this.dungeonWorld) return;
      const wave = room.waves[waveIndex];
      if (!wave?.length) return;
      const snapshot = this.proceduralController.startNextWave(wave.length);
      const points = this.dungeonWorld.getEnemySpawnPoints(room.id, wave.length);
      wave.forEach((enemyId, index) => {
        const point = points[index] ?? this.dungeonWorld!.getRoomCenter(room.id);
        this.spawnEnemyWithTelegraph(enemyId, `${room.id}:${snapshot.waveIndex}:${index}`, point.x, point.y, index * 80);
      });
      bridge.emitMessage(
        room.type === "boss"
          ? dungeon.messages.bossIntro
          : `${this.proceduralRoomLabel(room)} · onda ${snapshot.waveIndex + 1}/${snapshot.waveCount}.`,
      );
      this.emitHud(time);
    }

    private syncServerCombatHeartbeat(time: number) {
      if (
        !bridge.isServerAuthoritativeCombat()
        || !this.proceduralController
        || !this.proceduralRoomId
        || this.serverCombatState?.roomId === this.proceduralRoomId
          && ["victory", "defeat"].includes(this.serverCombatState.status)
        || this.serverCombatRequestsInFlight > 0
        || time - this.serverCombatLastRequestAt < 420
      ) return;
      this.submitServerCombatCommand(this.proceduralRoomId, "sync", time);
    }

    private submitServerCombatCommand(
      roomId: string,
      kind: ArpgDungeonCombatCommand["kind"],
      time: number,
      abilitySlot?: 0 | 1,
      dashDirection?: { x: number; y: number },
    ) {
      if (!bridge.isServerAuthoritativeCombat() || !this.dungeonWorld) return;
      if (
        this.serverCombatState?.roomId === roomId
        && ["victory", "defeat"].includes(this.serverCombatState.status)
      ) return;
      const layout = this.dungeonWorld.layout.rooms[roomId];
      if (!layout) return;
      const aim = kind === "dash" && dashDirection ? dashDirection : this.resolveCombatAim();
      const command: ArpgDungeonCombatCommand = {
        actionId: `${roomId}:${Date.now().toString(36)}:${++this.serverCombatActionSequence}`,
        kind,
        playerX: Phaser.Math.Clamp(this.player.x - layout.left, 0, layout.width - 1),
        playerY: Phaser.Math.Clamp(this.player.y - layout.top, 0, layout.height - 1),
        aimX: aim.x,
        aimY: aim.y,
        ...(abilitySlot === undefined ? {} : { abilitySlot }),
      };
      if (kind !== "sync") this.serverActionPending = true;
      this.serverCombatLastRequestAt = time;
      this.serverCombatRequestsInFlight += 1;
      void acceptServerConfirmedCombatResponse({
        request: () => bridge.submitEncounterCommand(roomId, command),
        isSceneActive: () => this.scene.isActive(),
        getPreviousState: () => this.serverCombatState,
        command,
        abilityId: command.abilitySlot === undefined ? undefined : selectedCards[command.abilitySlot].id,
        worldOrigin: { x: layout.left, y: layout.top },
        applyState: (result) => {
          const previous = this.serverCombatState;
          const confirmedAt = this.time.now;
          this.applyServerCombatState(result.state, kind, time);
          if (kind === "basic_attack" && result.state.attackCount > (previous?.attackCount ?? 0)) {
            this.playSound("attack");
            this.playPlayerAction("attack", confirmedAt, 360);
          }
          if (kind === "ability" && command.abilitySlot !== undefined) {
            const powerId = selectedCards[command.abilitySlot].id;
            if ((result.state.nextAbilityAtMs[powerId] ?? 0) > (previous?.nextAbilityAtMs[powerId] ?? 0)) {
              this.playSound("ability");
              const ability = selectedCards[command.abilitySlot];
              const abilityAnimation = ability.behavior === "projectile" || ability.behavior === "piercing-projectile"
                ? "shoot"
                : "attack";
              this.playPlayerAction(abilityAnimation, confirmedAt, 400);
              this.spawnAbilitySignature(
                selectedCards[command.abilitySlot],
                new Phaser.Math.Vector2(command.aimX, command.aimY).normalize(),
                layout.left + command.playerX,
                layout.top + command.playerY,
              );
            }
          }
          if (kind === "dash" && result.state.nextDashAtMs > (previous?.nextDashAtMs ?? 0)) {
            this.playPlayerAction("walk", confirmedAt, DASH_MS);
            this.flashPlayer(0xcaf4d2, 150);
          }
        },
        emit: (event) => bridge.emitVisualEvent(event),
      })
        .catch((error: unknown) => {
          if (!this.scene.isActive()) return;
          bridge.emitMessage(error instanceof Error ? error.message : "O servidor não confirmou a ação de combate.");
        })
        .finally(() => {
          this.serverCombatRequestsInFlight = Math.max(0, this.serverCombatRequestsInFlight - 1);
          if (kind !== "sync") this.serverActionPending = false;
        });
    }

    private applyServerCombatState(state: ArpgDungeonCombatState, commandKind: ArpgDungeonCombatCommand["kind"], time: number) {
      const previousHp = this.hp;
      const previousServerState = this.serverCombatState;
      const previousServerTotal = previousServerState
        ? previousServerState.baseRunShards + previousServerState.runShards
        : state.baseRunShards;
      const serverBaseIncrease = previousServerState
        ? Math.max(0, state.baseRunShards - previousServerState.baseRunShards)
        : 0;
      const pendingBreakableShards = Math.max(0, this.runShards - previousServerTotal - serverBaseIncrease);
      this.serverCombatState = state;
      this.hp = state.playerHp;
      this.basicAttackCounter = state.attackCount;
      this.nextAttackAt = time + Math.max(0, state.nextAttackAtMs - state.serverTimeMs);
      this.nextDashAt = time + Math.max(0, state.nextDashAtMs - state.serverTimeMs);
      this.dashingUntil = time + Math.max(0, state.dashUntilMs - state.serverTimeMs);
      for (const card of selectedCards) {
        const remainingMs = Math.max(0, (state.nextAbilityAtMs[card.id] ?? state.serverTimeMs) - state.serverTimeMs);
        this.abilityReadyAt[card.id] = time + remainingMs;
      }
      this.xpEarned = state.baseXpEarned + state.xpEarned;
      this.runShards = state.baseRunShards + state.runShards + pendingBreakableShards;
      const layout = this.dungeonWorld?.layout.rooms[state.roomId];
      if (layout) {
        this.syncServerProjectileVisuals(state, layout);
        this.syncServerHazardVisuals(state, layout);
      }
      if (layout && (commandKind === "sync" || commandKind === "dash") && this.proceduralRoomId === state.roomId) {
        this.player.setPosition(layout.left + state.playerX, layout.top + state.playerY);
      }
      if (previousHp > state.playerHp) {
        this.playSound("player-hit");
        this.playPlayerAction("damage", this.time.now, 420);
        this.flashPlayer(0xff7a72, 160);
        this.shakeCameraForDamage();
      }

      const localEnemiesById = indexRuntimeEntities(this.enemies.getChildren() as ArcadeSprite[]);
      for (const serverEnemy of state.enemies) {
        const enemy = localEnemiesById.get(serverEnemy.id);
        if (!enemy) continue;
        enemy.setData("hp", serverEnemy.hp);
        enemy.setData("maxHp", serverEnemy.maxHp);
        const previousPhase = Number(enemy.getData("serverBossPhase")) || 1;
        const previousPatternIndex = Number(enemy.getData("serverBossPatternIndex")) || 0;
        enemy.setData("phase", serverEnemy.bossPhase);
        enemy.setData("serverBossPhase", serverEnemy.bossPhase);
        enemy.setData("bossPatternIndex", serverEnemy.bossPatternIndex);
        enemy.setData("serverBossPatternIndex", serverEnemy.bossPatternIndex);
        enemy.setData("lastBossPattern", serverEnemy.bossPattern);
        if (serverEnemy.bossPhase !== previousPhase && serverEnemy.definitionId === "boss") {
          bridge.emitMessage(serverEnemy.bossPhase === 2 ? dungeon.messages.phaseTwo : dungeon.messages.phaseThree);
          this.spawnPulse(enemy.x, enemy.y, 110, dungeon.colors.phase);
        }
        if (
          serverEnemy.definitionId === "boss"
          && serverEnemy.bossPatternIndex > previousPatternIndex
          && enemy.active
        ) {
          this.playSound("boss");
          this.playEnemyAction(enemy, "attack", this.time.now, 760);
          if (serverEnemy.bossPattern?.startsWith("decoy")) this.summonCurupiraDecoys(enemy);
        }
        if (!serverEnemy.alive) {
          this.defeatEnemyFromServer(enemy, serverEnemy.id);
        } else if (enemy.active && enemy.getData("spawnReady") && layout && serverEnemy.waveIndex === state.waveIndex) {
          enemy.setPosition(layout.left + serverEnemy.x, layout.top + serverEnemy.y);
        }
      }
      this.emitHud(time);
      if (state.status === "defeat") this.finishRun(false, this.time.now);
    }

    private syncServerProjectileVisuals(
      state: ArpgDungeonCombatState,
      layout: NonNullable<DungeonWorldRuntime["layout"]["rooms"][string]>,
    ) {
      if (this.serverProjectileRoomId !== state.roomId) {
        this.clearServerProjectileVisuals();
        this.serverProjectileRoomId = state.roomId;
      }
      const currentIds = new Set(state.projectiles.map((projectile) => projectile.id));
      for (const [id, visual] of this.serverProjectileVisuals) {
        if (currentIds.has(id)) continue;
        this.tweens.killTweensOf(visual);
        this.tweens.add({ targets: visual, alpha: 0, scale: 0.25, duration: 90, onComplete: () => visual.destroy() });
        this.serverProjectileVisuals.delete(id);
      }
      for (const projectile of state.projectiles) {
        const x = layout.left + projectile.x;
        const y = layout.top + projectile.y;
        const visual = this.serverProjectileVisuals.get(projectile.id);
        if (!visual) {
          const created = this.add.circle(x, y, projectile.radius, dungeon.colors.projectile, 0.9)
            .setStrokeStyle(2, 0xf4e7c8, 0.8)
            .setDepth(11);
          this.serverProjectileVisuals.set(projectile.id, created);
          continue;
        }
        this.tweens.killTweensOf(visual);
        this.tweens.add({ targets: visual, x, y, duration: 360, ease: "Linear" });
      }
    }

    private clearServerProjectileVisuals() {
      for (const visual of this.serverProjectileVisuals.values()) {
        this.tweens.killTweensOf(visual);
        visual.destroy();
      }
      this.serverProjectileVisuals.clear();
      this.serverProjectileRoomId = null;
    }

    private syncServerHazardVisuals(
      state: ArpgDungeonCombatState,
      layout: NonNullable<DungeonWorldRuntime["layout"]["rooms"][string]>,
    ) {
      if (this.serverHazardRoomId !== state.roomId) {
        this.clearServerHazardVisuals();
        this.serverHazardRoomId = state.roomId;
      }
      const currentIds = new Set(state.hazards.map((hazard) => hazard.id));
      for (const [id, visual] of this.serverHazardVisuals) {
        if (currentIds.has(id)) continue;
        this.tweens.killTweensOf(visual);
        this.tweens.add({ targets: visual, alpha: 0, duration: 90, onComplete: () => visual.destroy() });
        this.serverHazardVisuals.delete(id);
      }

      for (const hazard of state.hazards) {
        let visual = this.serverHazardVisuals.get(hazard.id);
        const color = hazard.pattern.includes("ice") || hazard.pattern.includes("frost") || hazard.pattern.includes("whiteout")
          ? dungeon.colors.phaseThree
          : hazard.pattern.includes("tide") || hazard.pattern.includes("undertow") || hazard.pattern.includes("current")
            ? dungeon.colors.phaseTwo
            : hazard.pattern.includes("phase") || hazard.pattern.includes("teleport")
              ? dungeon.colors.phaseThree
              : dungeon.colors.phaseTwo;
        const x = layout.left + hazard.x;
        const y = layout.top + hazard.y;
        if (!visual) {
          visual = hazard.shape === "circle"
            ? this.add.circle(x, y, hazard.radius, color, 0.11)
            : this.add.rectangle(x, y, hazard.width, hazard.height, color, 0.14).setRotation(hazard.angle);
          visual.setStrokeStyle(3, color, 0.92).setDepth(6);
          this.serverHazardVisuals.set(hazard.id, visual);
        } else {
          visual.setPosition(x, y);
        }
        const activeRootBarrier = hazard.pattern === "root-arena"
          && state.serverTimeMs >= hazard.detonateAtMs
          && state.serverTimeMs < hazard.activeUntilMs;
        visual.setFillStyle(activeRootBarrier ? 0x694731 : color, activeRootBarrier ? 0.96 : 0.12);
        visual.setStrokeStyle(3, activeRootBarrier ? 0x91ab5a : color, activeRootBarrier ? 1 : 0.92);
        if (activeRootBarrier) {
          visual.setAlpha(1);
          this.tweens.killTweensOf(visual);
          continue;
        }
        const remainingMs = Math.max(80, hazard.detonateAtMs - state.serverTimeMs);
        this.tweens.killTweensOf(visual);
        this.tweens.add({ targets: visual, alpha: 0.56, duration: remainingMs, ease: "Sine.easeIn" });
      }
    }

    private clearServerHazardVisuals() {
      for (const visual of this.serverHazardVisuals.values()) {
        this.tweens.killTweensOf(visual);
        visual.destroy();
      }
      this.serverHazardVisuals.clear();
      this.serverHazardRoomId = null;
    }

    private defeatEnemyFromServer(enemy: ArcadeSprite, runtimeId: string) {
      if (!enemy.active || this.serverDefeatedEnemyIds.has(runtimeId)) return;
      this.serverDefeatedEnemyIds.add(runtimeId);
      this.pendingEnemySpawns.delete(enemy);
      enemy.setData("hp", 0);
      enemy.setData("defeatPending", true);
      enemy.setData("spawnReady", false);
      enemy.setVelocity(0, 0);
      if (enemy.body) enemy.body.enable = false;
      const profile = enemy.getData("animationProfile");
      if (isArpgEnemyAnimationProfile(profile)) {
        this.playTrackedEnemyAnimation(enemy, profile, "defeat", true);
        this.time.delayedCall(700, () => {
          if (!enemy.scene) return;
          enemy.disableBody(true, true);
          this.proceduralController?.enemyDefeated();
        });
        return;
      }
      const nativeFallbackActorId = enemy.getData("nativeFallbackActorId") as NativePixelActorId | null;
      if (nativeFallbackActorId) {
        this.playNativeFallbackAnimation(enemy, nativeFallbackActorId, "defeat", true);
        this.time.delayedCall(700, () => {
          if (!enemy.scene) return;
          enemy.disableBody(true, true);
          this.proceduralController?.enemyDefeated();
        });
        return;
      }
      enemy.disableBody(true, true);
      this.proceduralController?.enemyDefeated();
    }

    private spawnProceduralReward(room: DungeonRoom, time: number) {
      if (!this.dungeonWorld || this.chestAvailable || this.pendingLoot) return;
      this.playSound("chest");
      const lootIndex = this.runLootAssignments[room.id];
      const loot = typeof lootIndex === "number" ? lootPlan[lootIndex] ?? null : null;
      const cache = loot ? null : rollCombatRoomCache(dungeonManager?.getGraph().seed ?? "local", room.id);
      if (!loot && room.type !== "combat" && room.type !== "start") {
        throw new Error(`A sala ${room.id} não possui a recompensa assinada esperada.`);
      }
      if (!loot && cache?.kind !== "cache") {
        dungeonManager?.clearRoom(room.id);
        this.dungeonWorld.setDoorsLocked(room.id, false);
        bridge.emitMessage(`${this.proceduralRoomLabel(room)} concluída. Nenhum baú surgiu desta vez.`);
        this.emitRunCheckpoint();
        this.emitHud(time);
        return;
      }
      dungeonManager?.clearRoom(room.id);
      this.dungeonWorld.setDoorsLocked(room.id, true);
      const center = this.dungeonWorld.getRoomCenter(room.id);
      this.clearEnemyProjectiles();
      this.chestAvailable = true;
      this.chestLoot = loot;
      this.chestRoomId = room.id;
      this.chestLootIndex = typeof lootIndex === "number" ? lootIndex : null;
      this.chestCacheReward = cache?.kind === "cache" ? cache : null;
      this.destroyTreasureChestPrompt();
      this.chest?.destroy();
      this.chestOpening = false;
      this.chest = this.createTreasureChest(center.x, center.y + 80, 0.75).setAlpha(0);
      this.tweens.add({ targets: this.chest, scale: TREASURE_CHEST_DISPLAY_SCALE, alpha: 1, y: center.y + 78, duration: 260, ease: "Back.easeOut" });
      const ring = this.add.circle(center.x, center.y + 80, 20, loot ? 0xf0c961 : 0x8fc56b, 0.2).setDepth(7);
      this.tweens.add({ targets: ring, scale: 2.3, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
      bridge.emitMessage(loot
        ? "Recompensa da sala. Aproxime-se do baú e pressione E para abrir."
        : "Um pequeno cache de viagem apareceu. Aproxime-se e pressione E para recolher.");
      this.emitRunCheckpoint();
      this.emitHud(time);
    }

    private proceduralRoomLabel(room: DungeonRoom) {
      if (room.type === "boss") return "Sala do boss";
      if (room.type === "elite") return "Sala de elite";
      if (room.type === "treasure") return "Sala do tesouro";
      return `Sala ${room.distanceFromStart + 1}`;
    }

    private spawnEnemyInstance(enemyId: string, runtimeId: string, x: number, y: number) {
      const definition = dungeon.enemies[enemyId];
      if (!definition) return null;
      const enemy = this.enemies.get(x, y, "arpg-enemy") as ArcadeSprite | null;
      if (!enemy) return null;
      const folkloreFrame = dungeon.enemyFrames[enemyId];
      const folkloreAtlas = dungeon.enemyAtlas?.[enemyId] ?? "folklore-atlas";
      const animation = dungeon.enemyAnimations?.[enemyId];
      const nativeFallbackActorId = NATIVE_FALLBACK_ACTORS[dungeon.id]?.[enemyId];
      enemy.setActive(true).setVisible(true).setDepth(9).setAlpha(1);
      enemy.anims.stop();
      enemy.body!.enable = true;
      if (isArpgEnemyAnimationProfile(animation)) {
        const { scale } = getArpgEnemyAnimationProfile(animation);
        const sourceRadius = definition.radius / scale;
        const { textureKey, frameWidth } = getArpgEnemyAnimationProfile(animation);
        enemy.setTexture(getPixelArtTextureKey(textureKey), 0).setScale(scale).clearTint();
        enemy.setCircle(
          sourceRadius,
          frameWidth / 2 - sourceRadius,
          frameWidth / 2 - sourceRadius,
        );
      } else if (typeof folkloreFrame === "number") {
        const scale = enemyId === "boss" ? 0.48 : enemyId === "miniBoss" ? 0.42 : 0.34;
        const sourceRadius = definition.radius / scale;
        const textureKey = nativeFallbackActorId
          ? getPixelArtTextureKey(`folklard-native-${nativeFallbackActorId}`)
          : folkloreAtlas;
        enemy.setTexture(textureKey, nativeFallbackActorId ? 0 : folkloreFrame).setScale(scale).clearTint();
        const frameSize = this.textures.get(textureKey).getSourceImage().width / 4;
        enemy.setCircle(sourceRadius, frameSize / 2 - sourceRadius, frameSize / 2 - sourceRadius);
      } else {
        const displaySize = Math.max(34, definition.radius * 2.1);
        enemy.setTexture("arpg-enemy").setScale(1).setDisplaySize(displaySize, displaySize).setTint(definition.tint);
        enemy.setCircle(14, 4, 4);
      }
      enemy.setData("runtimeId", runtimeId);
      enemy.setData("animationHistory", []);
      enemy.setData("definitionId", enemyId);
      enemy.setData("hp", definition.maxHp);
      enemy.setData("maxHp", definition.maxHp);
      enemy.setData("speed", definition.moveSpeed);
      enemy.setData("contactDamage", definition.contactDamage);
      enemy.setData("rewardXp", definition.rewardXp);
      enemy.setData("combatRole", definition.combatRole ?? "melee");
      enemy.setData("tint", definition.tint);
      enemy.setData("radius", definition.radius);
      enemy.setData("nextContactAt", 0);
      enemy.setData("nextSpecialAt", this.time.now + 1500);
      enemy.setData("phase", 1);
      enemy.setData("bossPatternIndex", 0);
      enemy.setData("nextRootBarrierAt", 0);
      enemy.setData("rootedUntil", 0);
      enemy.setData("spawnReady", true);
      enemy.setData("animationProfile", animation ?? null);
      enemy.setData("nativeFallbackActorId", nativeFallbackActorId ?? null);
      enemy.setData("actionAnimationUntil", 0);
      enemy.setData("movementReadyAt", this.time.now + 420);
      enemy.setData("defeatPending", false);
      if (isArpgEnemyAnimationProfile(animation)) {
        this.playTrackedEnemyAnimation(enemy, animation, "idle", true);
      } else if (nativeFallbackActorId) {
        this.playNativeFallbackAnimation(enemy, nativeFallbackActorId, "idle", true);
      }
      this.ensureEntityGroundShadow(enemy, Phaser.Math.Clamp(definition.radius * 1.55, 24, 58));
      return enemy;
    }

    private spawnEnemyWithTelegraph(enemyId: string, runtimeId: string, x: number, y: number, staggerMs: number) {
      const definition = dungeon.enemies[enemyId];
      const enemy = this.spawnEnemyInstance(enemyId, runtimeId, x, y);
      if (!definition || !enemy) return;

      const tint = definition.tint;
      const ring = this.add.circle(x, y, 13, tint, 0.12).setStrokeStyle(3, tint, 0.92).setDepth(8);
      const root = this.add.rectangle(x, y, 8, 26, tint, 0.86).setAngle(-32).setDepth(8);
      const leaf = this.add.rectangle(x + 8, y - 4, 7, 16, 0xa6c76a, 0.82).setAngle(28).setDepth(8);
      this.tweens.add({
        targets: [ring, root, leaf],
        scale: { from: 0.5, to: 2.2 },
        alpha: { from: 0.92, to: 0 },
        duration: 420,
        delay: staggerMs,
        ease: "Quad.easeOut",
        onComplete: () => {
          ring.destroy();
          root.destroy();
          leaf.destroy();
        },
      });

      const scaleX = enemy.scaleX;
      const scaleY = enemy.scaleY;
      enemy.setVisible(false).setAlpha(0).setScale(scaleX * 0.58, scaleY * 0.58);
      enemy.setData("spawnReady", false);
      if (enemy.body) enemy.body.enable = false;
      this.pendingEnemySpawns.set(enemy, {
        activateAt: this.time.now + staggerMs + 310,
        scaleX,
        scaleY,
      });
    }

    private activatePendingEnemySpawns(time: number) {
      for (const [enemy, spawn] of this.pendingEnemySpawns) {
        if (time < spawn.activateAt) continue;
        this.pendingEnemySpawns.delete(enemy);
        if (this.runEnded || !enemy.scene) continue;
        enemy.setActive(true).setVisible(true).setAlpha(0.1).setScale(spawn.scaleX * 0.58, spawn.scaleY * 0.58);
        enemy.setData("spawnReady", true);
        enemy.setData("movementReadyAt", time + 420);
        if (enemy.body) enemy.body.enable = true;
        this.tweens.add({
          targets: enemy,
          alpha: 1,
          scaleX: spawn.scaleX,
          scaleY: spawn.scaleY,
          duration: 220,
          ease: "Back.easeOut",
        });
      }
    }

    private spawnCurrentRoom() {
      this.roomTransitionScheduled = false;
      const wave = this.roomWaves[this.roomIndex] ?? this.roomWaves[0];
      const points = [
        [180, 160], [1100, 150], [210, 560], [1060, 555],
        [640, 120], [640, 610], [350, 350], [930, 350],
      ];

      wave.forEach((enemyId, index) => {
        const definition = dungeon.enemies[enemyId];
        if (!definition) return;
        const point = points[index % points.length];
        const enemy = this.enemies.get(point[0], point[1], "arpg-enemy") as ArcadeSprite | null;
        if (!enemy) return;
        const folkloreFrame = dungeon.enemyFrames[enemyId];
        const folkloreAtlas = dungeon.enemyAtlas?.[enemyId] ?? "folklore-atlas";
        const animation = dungeon.enemyAnimations?.[enemyId];
        const nativeFallbackActorId = NATIVE_FALLBACK_ACTORS[dungeon.id]?.[enemyId];
        enemy.setActive(true).setVisible(true).setDepth(9).setAlpha(1);
        enemy.anims.stop();
        enemy.body!.enable = true;
        if (isArpgEnemyAnimationProfile(animation)) {
          const { scale } = getArpgEnemyAnimationProfile(animation);
          const sourceRadius = definition.radius / scale;
          const { textureKey, frameWidth } = getArpgEnemyAnimationProfile(animation);
          enemy.setTexture(getPixelArtTextureKey(textureKey), 0).setScale(scale).clearTint();
          enemy.setCircle(sourceRadius, frameWidth / 2 - sourceRadius, frameWidth / 2 - sourceRadius);
        } else if (typeof folkloreFrame === "number") {
          const scale = enemyId === "boss" ? 0.48 : enemyId === "miniBoss" ? 0.42 : 0.34;
          const sourceRadius = definition.radius / scale;
          const textureKey = nativeFallbackActorId
            ? getPixelArtTextureKey(`folklard-native-${nativeFallbackActorId}`)
            : folkloreAtlas;
          enemy.setTexture(textureKey, nativeFallbackActorId ? 0 : folkloreFrame).setScale(scale).clearTint();
          const frameSize = this.textures.get(textureKey).getSourceImage().width / 4;
          enemy.setCircle(sourceRadius, frameSize / 2 - sourceRadius, frameSize / 2 - sourceRadius);
        } else {
          const displaySize = Math.max(34, definition.radius * 2.1);
          enemy.setTexture("arpg-enemy").setScale(1).setDisplaySize(displaySize, displaySize).setTint(definition.tint);
          enemy.setCircle(14, 4, 4);
        }
        enemy.setData("runtimeId", `${this.roomIndex}:${index}:${enemyId}`);
        enemy.setData("animationHistory", []);
        enemy.setData("definitionId", enemyId);
        enemy.setData("hp", definition.maxHp);
        enemy.setData("maxHp", definition.maxHp);
        enemy.setData("speed", definition.moveSpeed);
        enemy.setData("contactDamage", definition.contactDamage);
        enemy.setData("combatRole", definition.combatRole ?? "melee");
        enemy.setData("rewardXp", definition.rewardXp);
        enemy.setData("tint", definition.tint);
        enemy.setData("radius", definition.radius);
        enemy.setData("nextContactAt", 0);
        enemy.setData("nextSpecialAt", this.time.now + 1500);
        enemy.setData("phase", 1);
        enemy.setData("rootedUntil", 0);
        enemy.setData("animationProfile", animation ?? null);
        enemy.setData("nativeFallbackActorId", nativeFallbackActorId ?? null);
        enemy.setData("actionAnimationUntil", 0);
        enemy.setData("movementReadyAt", this.time.now + 420);
        enemy.setData("defeatPending", false);
        if (isArpgEnemyAnimationProfile(animation)) {
          this.playTrackedEnemyAnimation(enemy, animation, "idle", true);
        } else if (nativeFallbackActorId) {
          this.playNativeFallbackAnimation(enemy, nativeFallbackActorId, "idle", true);
        }
      });

      this.player.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      bridge.emitMessage(
        this.roomIndex === this.roomWaves.length - 1
          ? dungeon.messages.bossIntro
          : `Sala ${this.roomIndex + 1}: elimine a onda para avançar.`,
      );
    }
    private updateEnemies(time: number) {
      this.enemies.getChildren().forEach((child) => {
        const enemy = child as ArcadeSprite;
        if (!enemy.active || !enemy.getData("spawnReady")) return;

        const definitionId = String(enemy.getData("definitionId"));
        this.updateEnemyMovement(enemy, definitionId, time);
        this.updateEnemySpecial(enemy, definitionId, time);
        this.updateEnemyAnimation(enemy, time);
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const contactRange = Math.max(36, (Number(enemy.getData("radius")) || 18) + 18);
        const nextContactAt = Number(enemy.getData("nextContactAt")) || 0;
        if (distance <= contactRange && time >= nextContactAt && time >= this.dashingUntil && time >= this.nextPlayerDamageAt) {
          enemy.setData("nextContactAt", time + (definitionId === "boss" ? 980 : 650));
          if (definitionId !== "boss") this.playEnemyAction(enemy, "attack", time, 320);
          this.applyPlayerDamage(Number(enemy.getData("contactDamage")) || 8, time);
        }
      });
    }

    private updateEnemyMovement(enemy: ArcadeSprite, definitionId: string, time: number) {
      if (time < (Number(enemy.getData("movementReadyAt")) || 0)) {
        enemy.setVelocity(0, 0);
        return;
      }
      const rootedUntil = Number(enemy.getData("rootedUntil")) || 0;
      if (time < rootedUntil) {
        enemy.setVelocity(0, 0);
        return;
      }

      let speed = Number(enemy.getData("speed")) || 80;
      if (definitionId === "boss") {
        const hp = Number(enemy.getData("hp"));
        const maxHp = Math.max(1, Number(enemy.getData("maxHp")));
        const ratio = hp / maxHp;
        if (ratio < 0.66) speed += 24;
        if (ratio < 0.33) speed += 32;
      }

      const role = String(enemy.getData("combatRole") ?? "melee") as EnemyCombatRole;
      if (definitionId === "boss" || (definitionId === "miniBoss" && role !== "caster")) {
        this.physics.moveToObject(enemy, this.player, speed);
        return;
      }

      if (role === "charger") {
        const chargeStartsAt = Number(enemy.getData("chargeStartsAt")) || 0;
        const chargeEndsAt = Number(enemy.getData("chargeEndsAt")) || 0;
        if (time < chargeEndsAt) {
          if (time < chargeStartsAt) {
            enemy.setVelocity(0, 0);
          } else {
            const directionX = Number(enemy.getData("chargeDirectionX")) || 0;
            const directionY = Number(enemy.getData("chargeDirectionY")) || 0;
            enemy.setVelocity(directionX * speed * 3.8, directionY * speed * 3.8);
          }
          return;
        }
        if (chargeEndsAt > 0) {
          enemy.setData("chargeStartsAt", 0);
          enemy.setData("chargeEndsAt", 0);
        }
      }

      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const previousIntent = enemy.getData("movementIntent");
      const intent = getEnemyMovementIntent(
        role,
        distance,
        previousIntent === "approach" || previousIntent === "retreat" ? previousIntent : "hold",
      );
      enemy.setData("movementIntent", intent);
      if (intent === "approach") {
        this.physics.moveToObject(enemy, this.player, speed);
      } else if (intent === "retreat") {
        const direction = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
        enemy.setVelocity(direction.x * speed, direction.y * speed);
      } else {
        enemy.setVelocity(0, 0);
      }
    }

    private updateEnemyAnimation(enemy: ArcadeSprite, time: number) {
      const profile = enemy.getData("animationProfile");
      enemy.setFlipX(this.player.x < enemy.x);
      if (time < (Number(enemy.getData("actionAnimationUntil")) || 0)) return;
      const velocity = enemy.body?.velocity;
      const animation = velocity && velocity.lengthSq() > 64 ? "walk" : "idle";
      if (!isArpgEnemyAnimationProfile(profile)) {
        const nativeFallbackActorId = enemy.getData("nativeFallbackActorId") as NativePixelActorId | null;
        if (nativeFallbackActorId) this.playNativeFallbackAnimation(enemy, nativeFallbackActorId, animation);
        return;
      }
      this.playTrackedEnemyAnimation(enemy, profile, animation);
    }

    private playNativeFallbackAnimation(
      enemy: ArcadeSprite,
      actorId: NativePixelActorId,
      animation: keyof typeof NATIVE_FALLBACK_ANIMATIONS,
      restart = false,
    ) {
      const key = `folklard-fallback-${actorId}-${animation}`;
      if (restart || enemy.anims.currentAnim?.key !== key) enemy.play(key);
    }

    private playTrackedEnemyAnimation(
      enemy: import("phaser").GameObjects.Sprite,
      profile: ArpgEnemyAnimationProfile,
      animation: ArpgEnemyAnimation,
      restart = false,
    ) {
      const animationKey = `${profile}-${animation}`;
      const animationChanged = restart || enemy.anims.currentAnim?.key !== animationKey;
      playArpgEnemyAnimation(enemy, profile, animation, restart);
      if (!animationChanged || enemy.anims.currentAnim?.key !== animationKey) return;
      const existingHistory = enemy.getData("animationHistory");
      const history = Array.isArray(existingHistory) ? existingHistory as string[] : [];
      if (!history.includes(animationKey)) {
        enemy.setData("animationHistory", [...history, animationKey].slice(-8));
      }
    }

    private playEnemyAction(enemy: ArcadeSprite, animation: ArpgEnemyAnimation, time: number, durationMs: number) {
      const profile = enemy.getData("animationProfile");
      enemy.setData("actionAnimationUntil", time + durationMs);
      if (!isArpgEnemyAnimationProfile(profile)) {
        const nativeFallbackActorId = enemy.getData("nativeFallbackActorId") as NativePixelActorId | null;
        if (nativeFallbackActorId) this.playNativeFallbackAnimation(enemy, nativeFallbackActorId, animation, true);
        return;
      }
      this.playTrackedEnemyAnimation(enemy, profile, animation, true);
    }

    private playEnemyProfileAction(
      enemy: ArcadeSprite,
      animation: ArpgEnemyAnimation,
      time: number,
      durationMs: number,
    ) {
      const profile = enemy.getData("animationProfile");
      if (!isArpgEnemyAnimationProfile(profile)) return false;
      const definition = getArpgEnemyAnimationProfile(profile);
      if (!Object.hasOwn(definition.animations, animation)) return false;
      this.playEnemyAction(enemy, animation, time, durationMs);
      return true;
    }

    private updateEnemySpecial(enemy: ArcadeSprite, definitionId: string, time: number) {
      if (bridge.isServerAuthoritativeCombat()) return;
      const nextSpecialAt = Number(enemy.getData("nextSpecialAt")) || 0;
      const role = String(enemy.getData("combatRole") ?? "melee") as EnemyCombatRole;
      if (definitionId === "miniBoss" && role === "caster") {
        if (time < nextSpecialAt) return;
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        if (distance <= 500) {
          const damage = Number(enemy.getData("contactDamage")) || 18;
          this.telegraphAreaStrike(this.player.x, this.player.y, 104, damage, dungeon.colors.miniBoss, 620);
          bridge.emitMessage(dungeon.messages.miniBossWarning);
        }
        enemy.setData("nextSpecialAt", time + (distance > 500 ? 420 : 2650));
        return;
      }
      if (definitionId !== "miniBoss" && definitionId !== "boss") {
        if (role === "melee" || time < nextSpecialAt) return;
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const tint = Number(enemy.getData("tint")) || dungeon.colors.projectile;
        const aim = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize();

        if (role === "charger") {
          const chargeStartsAt = time + 360;
          const chargeEndsAt = chargeStartsAt + 420;
          enemy.setData("chargeDirectionX", aim.x);
          enemy.setData("chargeDirectionY", aim.y);
          enemy.setData("chargeStartsAt", chargeStartsAt);
          enemy.setData("chargeEndsAt", chargeEndsAt);
          enemy.setData("nextSpecialAt", chargeEndsAt + 1850);
          this.telegraphCharge(enemy, aim, tint);
        } else if (role === "ranged") {
          if (distance <= 580 && distance >= 100) {
            this.spawnPulse(enemy.x, enemy.y, 24, tint);
            this.fireEnemyProjectile(enemy, aim, 7, 285, tint, 2100);
            this.playEnemyProfileAction(enemy, "shoot", time, 360);
          }
          enemy.setData("nextSpecialAt", time + (distance > 580 ? 380 : 1750));
        } else if (role === "caster") {
          if (distance <= 470) {
            this.telegraphAreaStrike(this.player.x, this.player.y, 78, 9, tint, 650);
          }
          enemy.setData("nextSpecialAt", time + (distance > 470 ? 400 : 2750));
        } else if (role === "elite") {
          if (distance <= 590 && distance >= 120) {
            this.spawnPulse(enemy.x, enemy.y, 34, tint);
            for (const spread of [-0.2, 0, 0.2]) {
              this.fireEnemyProjectile(enemy, aim.clone().rotate(spread), 6, 315, tint, 1900);
            }
            this.playEnemyProfileAction(enemy, "shoot", time, 420);
          }
          enemy.setData("nextSpecialAt", time + (distance > 590 ? 380 : 2350));
        }
        return;
      }

      if (time < nextSpecialAt) return;
      if (definitionId === "boss") {
        this.playSound("boss");
        this.playEnemyAction(enemy, "attack", time, 760);
      }

      if (definitionId === "miniBoss") {
        enemy.setData("nextSpecialAt", time + 2600);
        this.telegraphAreaStrike(enemy.x, enemy.y, 165, 18, dungeon.colors.miniBoss, 520);
        bridge.emitMessage(dungeon.messages.miniBossWarning);
        return;
      }

      const hp = Number(enemy.getData("hp"));
      const maxHp = Math.max(1, Number(enemy.getData("maxHp")));
      const ratio = hp / maxHp;
      const previousPhase = Math.max(1, Math.min(3, Number(enemy.getData("phase")) || 1)) as 1 | 2 | 3;
      let patternIndex = Number(enemy.getData("bossPatternIndex")) || 0;
      const phase = dungeon.id === "mata-encantada"
        ? getCurupiraBossPhase(previousPhase, patternIndex, ratio)
        : ratio < 0.33 ? 3 : ratio < 0.66 ? 2 : 1;
      if (phase !== previousPhase) {
        enemy.setData("phase", phase);
        patternIndex = 0;
        enemy.setData("bossPatternIndex", 0);
        bridge.emitMessage(phase === 2 ? dungeon.messages.phaseTwo : dungeon.messages.phaseThree);
        this.spawnPulse(enemy.x, enemy.y, 110, dungeon.colors.phase);
      }

      if (dungeon.id === "mata-encantada") {
        enemy.setData("bossPatternIndex", patternIndex + 1);
        const pattern = getCurupiraBossPattern(phase, patternIndex);
        enemy.setData("lastBossPattern", pattern);
        if (pattern === "bow-volley") {
          this.fireBossVolley(enemy, 3, 0.14);
          enemy.setData("nextSpecialAt", time + 2050);
        } else if (pattern === "roots-burst") {
          bridge.emitMessage("Raízes rompem sob seus pés — mova-se antes do impacto!");
          this.fireBossVolley(enemy, 3, 0.14);
          this.telegraphCurupiraRootBurst(this.player.x, this.player.y, 13, 760);
          enemy.setData("nextSpecialAt", time + 2150);
        } else if (pattern === "decoy-ambush") {
          this.summonCurupiraDecoys(enemy);
          this.teleportBoss(enemy);
          bridge.emitMessage("Rastros falsos cruzam a arena. O Curupira prepara uma emboscada!");
          this.telegraphCurupiraRootBurst(this.player.x, this.player.y, 16, 680);
          enemy.setData("nextSpecialAt", time + 1900);
        } else if (pattern === "decoy-volley") {
          this.summonCurupiraDecoys(enemy);
          this.fireBossVolley(enemy, 4, 0.18);
          enemy.setData("nextSpecialAt", time + 1950);
        } else if (pattern === "root-arena") {
          this.createCurupiraRootBarriers(enemy, time);
          this.fireBossVolley(enemy, 4, 0.2);
          enemy.setData("nextSpecialAt", time + 2050);
        } else {
          this.teleportBoss(enemy);
          this.fireBossVolley(enemy, 5, 0.2);
          this.telegraphAreaStrike(this.player.x, this.player.y, 88, 18, dungeon.colors.phaseThree, 680);
          enemy.setData("nextSpecialAt", time + 1750);
        }
        return;
      }

      const regionalPattern = getRegionalBossPattern(dungeon.id, phase, patternIndex);
      enemy.setData("bossPatternIndex", patternIndex + 1);
      enemy.setData("lastBossPattern", regionalPattern);
      if (regionalPattern === "tide-volley" || regionalPattern === "frost-shards") {
        this.fireBossVolley(enemy, 3, 0.14);
        enemy.setData("nextSpecialAt", time + 2200);
      } else if (regionalPattern === "undertow-sweep") {
        this.telegraphAreaStrike(this.player.x, this.player.y, 110, 18, dungeon.colors.phaseTwo, 720);
        enemy.setData("nextSpecialAt", time + 2000);
      } else if (regionalPattern === "ice-lanes") {
        for (const offset of [-100, 0, 100]) {
          this.telegraphAreaStrike(this.player.x + offset, this.player.y, 65, 15, dungeon.colors.phaseTwo, 650);
        }
        enemy.setData("nextSpecialAt", time + 2000);
      } else {
        this.teleportBoss(enemy);
        this.fireBossVolley(enemy, 5, 0.18);
        this.telegraphAreaStrike(this.player.x, this.player.y, 88, 18, dungeon.colors.phaseThree, 700);
        enemy.setData("nextSpecialAt", time + 1650);
      }
    }

    private fireBossVolley(enemy: ArcadeSprite, count: number, spread: number) {
      const base = new Phaser.Math.Vector2(
        this.player.x - enemy.x,
        this.player.y - enemy.y,
      ).normalize();
      const center = (count - 1) / 2;
      for (let index = 0; index < count; index += 1) {
        const direction = base.clone().rotate((index - center) * spread);
        this.fireEnemyProjectile(enemy, direction, 13, 330, dungeon.colors.projectile, 2200);
      }
      bridge.emitMessage(dungeon.messages.bossVolley);
    }

    private summonCurupiraDecoys(enemy: ArcadeSprite) {
      const profile = dungeon.enemyAnimations?.boss;
      if (!isArpgEnemyAnimationProfile(profile)) return;
      const definition = getArpgEnemyAnimationProfile(profile);
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;
      const roomLayout = dungeonManager && this.dungeonWorld
        ? this.dungeonWorld.layout.rooms[dungeonManager.getCurrentRoom().id]
        : null;
      const left = (roomLayout?.left ?? 0) + 80;
      const top = (roomLayout?.top ?? 0) + 80;
      const right = (roomLayout ? roomLayout.left + roomLayout.width : WORLD_WIDTH) - 80;
      const bottom = (roomLayout ? roomLayout.top + roomLayout.height : WORLD_HEIGHT) - 80;

      for (const side of [-1, 1]) {
        const x = Phaser.Math.Clamp(enemy.x + perpendicularX * 136 * side, left, right);
        const y = Phaser.Math.Clamp(enemy.y + perpendicularY * 136 * side, top, bottom);
        const decoy = this.add.sprite(x, y, definition.textureKey, 0)
          .setOrigin(enemy.originX, enemy.originY)
          .setDisplaySize(enemy.displayWidth, enemy.displayHeight)
          .setFlipX(enemy.flipX)
          .setTint(dungeon.colors.phaseTwo)
          .setAlpha(0.62)
          .setDepth(enemy.depth + 0.1);
        const trail = this.add.ellipse(x, y + 26, 76, 22, dungeon.colors.phaseTwo, 0.34)
          .setStrokeStyle(2, 0xe8d59b, 0.74)
          .setDepth(enemy.depth - 0.1);
        this.playTrackedEnemyAnimation(decoy, profile, "walk", true);
        this.spawnPulse(x, y, 64, dungeon.colors.phaseTwo);
        this.tweens.add({
          targets: decoy,
          x: Phaser.Math.Clamp(x + perpendicularX * 74 * side + dx / length * 36, left, right),
          y: Phaser.Math.Clamp(y + perpendicularY * 74 * side + dy / length * 36, top, bottom),
          alpha: 0,
          duration: 920,
          ease: "Sine.easeIn",
          onComplete: () => decoy.destroy(),
        });
        this.tweens.add({ targets: trail, alpha: 0, scaleX: 1.7, duration: 920, onComplete: () => trail.destroy() });
      }
      this.playSound("boss");
    }

    private telegraphCurupiraRootBurst(x: number, y: number, damage: number, delayMs: number) {
      const radius = 86;
      const marker = this.add.circle(x, y, radius, dungeon.colors.phaseTwo, 0.08)
        .setStrokeStyle(4, dungeon.colors.phaseTwo, 0.86)
        .setDepth(6);
      const roots = Array.from({ length: 6 }, (_, index) => {
        const angle = index * Math.PI / 3;
        return this.add.rectangle(
          x + Math.cos(angle) * 42,
          y + Math.sin(angle) * 42,
          8,
          42,
          0x8d6544,
          0.34,
        ).setRotation(angle).setDepth(7);
      });
      this.tweens.add({ targets: marker, alpha: 0.35, duration: delayMs, ease: "Sine.easeIn" });
      this.tweens.add({ targets: roots, alpha: 0.96, scaleY: 1.12, duration: delayMs, ease: "Back.easeOut" });
      this.time.delayedCall(delayMs, () => {
        marker.destroy();
        roots.forEach((root) => root.destroy());
        if (this.runEnded) return;
        this.spawnPulse(x, y, radius, dungeon.colors.phaseTwo);
        if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= radius && this.time.now >= this.dashingUntil) {
          this.applyPlayerDamage(damage, this.time.now);
        }
      });
    }

    private createCurupiraRootBarriers(enemy: ArcadeSprite, time: number) {
      const readyAt = Number(enemy.getData("nextRootBarrierAt")) || 0;
      if (time < readyAt || !dungeonManager || !this.dungeonWorld) return;
      enemy.setData("nextRootBarrierAt", time + 5200);
      const roomLayout = this.dungeonWorld.layout.rooms[dungeonManager.getCurrentRoom().id];
      const candidates = [
        { x: roomLayout.centerX - 140, y: roomLayout.centerY + 62, width: 150, height: 18 },
        { x: roomLayout.centerX + 142, y: roomLayout.centerY - 62, width: 18, height: 146 },
      ];

      candidates.forEach((candidate) => {
        if (
          Phaser.Math.Distance.Between(candidate.x, candidate.y, this.player.x, this.player.y) < 104
          || Phaser.Math.Distance.Between(candidate.x, candidate.y, enemy.x, enemy.y) < 104
        ) return;
        const warning = this.add.rectangle(candidate.x, candidate.y, candidate.width, candidate.height, dungeon.colors.phaseTwo, 0.12)
          .setStrokeStyle(3, dungeon.colors.phaseTwo, 0.9)
          .setDepth(7);
        this.tweens.add({ targets: warning, alpha: 0.74, duration: 360, yoyo: true, repeat: 0 });
        this.time.delayedCall(380, () => {
          warning.destroy();
          if (this.runEnded || !enemy.active || Number(enemy.getData("hp")) <= 0) return;
          const root = this.add.rectangle(candidate.x, candidate.y, candidate.width, candidate.height, 0x694731, 1)
            .setStrokeStyle(3, 0x91ab5a, 1)
            .setDepth(8);
          this.physics.add.existing(root, true);
          const playerCollider = this.physics.add.collider(this.player, root);
          const enemyCollider = this.physics.add.collider(this.enemies, root);
          this.activeCurupiraRootBarriers += 1;
          const leafA = this.add.rectangle(candidate.x - candidate.width / 3, candidate.y - 8, 22, 8, 0x8eb658, 0.95)
            .setAngle(-24).setDepth(9);
          const leafB = this.add.rectangle(candidate.x + candidate.width / 3, candidate.y + 8, 18, 7, 0xacc76b, 0.9)
            .setAngle(24).setDepth(9);
          this.time.delayedCall(1720, () => {
            playerCollider.destroy();
            enemyCollider.destroy();
            this.activeCurupiraRootBarriers = Math.max(0, this.activeCurupiraRootBarriers - 1);
            root.destroy();
            leafA.destroy();
            leafB.destroy();
          });
        });
      });
      bridge.emitMessage("Raízes antigas atravessam a arena e bloqueiam algumas rotas por instantes!");
      this.playSound("boss");
    }

    private teleportBoss(enemy: ArcadeSprite) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(210, 310);
      const roomLayout = dungeonManager && this.dungeonWorld
        ? this.dungeonWorld.layout.rooms[dungeonManager.getCurrentRoom().id]
        : null;
      const left = roomLayout?.left ?? 0;
      const top = roomLayout?.top ?? 0;
      const right = roomLayout ? roomLayout.left + roomLayout.width : WORLD_WIDTH;
      const bottom = roomLayout ? roomLayout.top + roomLayout.height : WORLD_HEIGHT;
      const margin = 84;
      const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, left + margin, right - margin);
      const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, top + margin, bottom - margin);
      this.spawnPulse(enemy.x, enemy.y, 55, dungeon.colors.phase);
      enemy.setPosition(x, y);
      this.spawnPulse(x, y, 72, dungeon.colors.phase);
    }

    private telegraphCharge(enemy: ArcadeSprite, direction: import("phaser").Math.Vector2, color: number) {
      const length = 300;
      const warning = this.add.rectangle(
        enemy.x + direction.x * length / 2,
        enemy.y + direction.y * length / 2,
        length,
        12,
        color,
        0.34,
      ).setRotation(direction.angle()).setDepth(8);
      this.tweens.add({
        targets: warning,
        alpha: 0,
        duration: 360,
        ease: "Quad.easeOut",
        onComplete: () => warning.destroy(),
      });
    }

    private telegraphAreaStrike(
      x: number,
      y: number,
      radius: number,
      damage: number,
      color: number,
      delayMs: number,
    ) {
      const marker = this.add.circle(x, y, radius, color, 0.08)
        .setStrokeStyle(4, color, 0.8)
        .setDepth(6);
      this.tweens.add({ targets: marker, alpha: 0.32, duration: delayMs, ease: "Sine.easeIn" });
      this.time.delayedCall(delayMs, () => {
        marker.destroy();
        if (this.runEnded) return;
        this.spawnPulse(x, y, radius, color);
        const distance = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
        if (distance <= radius && this.time.now >= this.dashingUntil) {
          this.applyPlayerDamage(damage, this.time.now);
        }
      });
    }

    private applyPlayerDamage(rawDamage: number, time: number) {
      if (bridge.isServerAuthoritativeCombat() && this.proceduralController) return;
      this.playSound("player-hit");
      const armor = ARPG_ARMOR_BY_ID.get(this.currentArmorId) ?? ARPG_ARMORS[0];
      const body = this.player.body as import("phaser").Physics.Arcade.Body | null;
      const moving = (body?.velocity.lengthSq() ?? 0) > 64;
      const armorReduction = getArmorMovingDefenseBonus(armor, moving);
      const damage = Math.max(1, rawDamage - armor.defenseBonus - armorReduction);
      this.hp = Math.max(0, this.hp - damage);
      this.nextPlayerDamageAt = time + 260;
      this.playPlayerAction("damage", time, 420);
      this.flashPlayer(0xff7a72, 160);
      this.shakeCameraForDamage();
      const retaliationDamage = getArmorRetaliationDamage(armor);
      if (retaliationDamage > 0) {
        this.damageEnemiesInRadius(this.player.x, this.player.y, 96, retaliationDamage, false);
        this.spawnPulse(this.player.x, this.player.y, 96, 0x61a7c7);
      }
      if (this.hp <= 0) this.finishRun(false, time);
    }
    private checkRoomProgress(time: number) {
      if (dungeonManager && this.dungeonWorld) return;
      if (this.roomTransitionScheduled || this.runEnded) return;
      if (this.enemies.countActive(true) > 0) return;

      if (this.roomIndex >= this.roomWaves.length - 1) {
        this.finishRun(true, time);
        return;
      }

      if (!this.chestAvailable) {
        this.spawnRewardChest(time);
      }
    }

    private spawnRewardChest(time: number) {
      this.clearEnemyProjectiles();
      this.chestAvailable = true;
      this.chestOpening = false;
      this.playSound("chest");
      this.chestLoot = lootPlan[this.roomIndex] ?? null;
      this.chestRoomId = null;
      this.chestCacheReward = null;
      this.destroyTreasureChestPrompt();
      this.chest?.destroy();
      this.chest = this.createTreasureChest(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 110);
      bridge.emitMessage("Sala limpa. Aproxime-se do baú e pressione E para abrir.");
      this.emitHud(time);
    }

    private createTreasureChest(x: number, y: number, initialScale = 1) {
      const chest = this.add.sprite(x, y, TREASURE_CHEST_TEXTURE, 0)
        .setScale(TREASURE_CHEST_DISPLAY_SCALE * initialScale)
        .setDepth(8);
      alignTreasureChestToGround(chest);
      chest.on("animationupdate", () => alignTreasureChestToGround(chest));
      this.chestPrompt = this.add.text(x, y, "[E] Abrir", {
        color: "#fff0bf",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "#241d18",
        padding: { x: 7, y: 4 },
      }).setOrigin(0.5).setDepth(14).setVisible(false);
      return chest;
    }

    private updateTreasureChestPrompt() {
      if (!this.chestAvailable || !this.chest || !this.chestPrompt || this.pendingLoot) {
        this.chestPrompt?.setVisible(false);
        return;
      }

      const inRange = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chest.x, this.chest.y) <= 136;
      const { top, baseline } = getTreasureChestFrameBounds(Number(this.chest.frame.name));
      this.chestPrompt.setText(this.chestOpening ? "Abrindo…" : "[E] Abrir");
      this.chestPrompt.setPosition(
        this.chest.x,
        this.chest.y
          - (baseline - top) * this.chest.scaleY
          - this.chestPrompt.height / 2
          - 10,
      );
      this.chestPrompt.setVisible(inRange || this.chestOpening);
    }

    private destroyTreasureChestPrompt() {
      this.chestPrompt?.destroy();
      this.chestPrompt = null;
    }

    private tryOpenChest(time: number) {
      if (!this.chestAvailable || !this.chest || this.chestOpening) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chest.x, this.chest.y);
      if (distance > 136) {
        bridge.emitMessage("Chegue mais perto do baú para interagir.");
        return;
      }
      this.playPlayerAction("idle", time, 520);
      this.playSound("chest");
      this.clearClickPath();
      bridge.clearGameplayInput();
      this.player.setVelocity(0, 0);
      this.chestPhysicsPausedByPresentation = !this.physics.world.isPaused;
      if (this.chestPhysicsPausedByPresentation) this.physics.world.pause();
      const openingChest = this.chest;
      this.chestOpening = true;
      openingChest.once("animationcomplete", () => {
        if (this.chest !== openingChest || !this.chestAvailable || !this.chestOpening) return;
        this.beginChestLootPresentation(this.time.now);
      });
      openingChest.play(TREASURE_CHEST_OPEN_ANIMATION_KEY);
    }

    private beginChestLootPresentation(time: number) {
      const chest = this.chest;
      if (!this.chestAvailable || !this.chestOpening || !chest || this.chestPresentation) return;

      const loot = this.chestLoot ?? (!dungeonManager ? lootPlan[this.roomIndex] ?? null : null);
      const cacheReward = this.chestCacheReward;
      if (!loot && !cacheReward) {
        this.chestOpening = false;
        chest.anims.stop();
        chest.setFrame(0);
        alignTreasureChestToGround(chest);
        this.resumeChestPresentationPhysics();
        bridge.emitMessage("Este baú não possui uma recompensa atribuída.");
        this.emitHud(time);
        return;
      }
      if (loot) this.chestLoot = loot;

      if (loot?.kind === "armor") {
        // Old signed runs may still assign a retired armor reward. Skip its
        // drop presentation and drain the legacy choice without equipping it.
        this.pendingLoot = loot;
        this.resolvePendingLoot("keep", time);
        return;
      }

      const roomId = this.chestRoomId;
      const landingPoint = this.navigation && roomId
        ? findChestLootLandingPoint(this.navigation, roomId, chest)
        : { x: chest.x, y: chest.y + 24 };
      if (!landingPoint) {
        this.chestOpening = false;
        chest.anims.stop();
        chest.setFrame(0);
        alignTreasureChestToGround(chest);
        this.resumeChestPresentationPhysics();
        bridge.emitMessage("Não há um espaço seguro ao lado do baú para a recompensa.");
        this.emitHud(time);
        return;
      }

      const details = loot ? getChestLootVisualDetails(loot) : null;
      const presentation: ChestLootPresentation = {
        id: this.nextChestPresentationId++,
        kind: loot ? "loot" : "cache",
        roomId,
        itemId: details?.id ?? "arpg-run-fragment",
        rarity: details?.rarity ?? null,
        phase: "rise",
        chest,
        item: null,
        shadow: this.add.ellipse(landingPoint.x, landingPoint.y, 24, 8, 0x10150f, 0.55)
          .setDepth(7).setAlpha(0.2),
        effects: [],
        tweens: [],
        timers: [],
        visualSlot: { claimed: false },
        itemSpawnCount: 0,
        landingPoint,
        loot,
        resolved: false,
      };
      this.chestPresentation = presentation;
      if (!claimChestLootVisualSlot(presentation.visualSlot)) return;
      presentation.itemSpawnCount += 1;
      const texture = details ? `arpg-loot-${details.silhouette}` : "arpg-run-fragment";
      presentation.item = this.add.image(chest.x, chest.y - 28, texture)
        .setDisplaySize(loot ? 32 : 24, loot ? 32 : 24)
        .setAlpha(0)
        .setDepth(12);
      if (details) this.audio?.playLootReveal(details.rarity);

      const item = presentation.item;
      const rise = this.tweens.add({
        targets: item,
        y: chest.y - 84,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => {
          if (!this.isCurrentChestPresentation(presentation)) return;
          presentation.phase = "pause";
          this.scheduleChestPresentationTimer(presentation, 80, () => this.beginChestLootFall(presentation));
        },
      });
      presentation.tweens.push(rise);
      this.updateTreasureChestPrompt();
      this.emitHud(time);
    }

    private isCurrentChestPresentation(presentation: ChestLootPresentation) {
      return this.chestPresentation === presentation
        && this.chest === presentation.chest
        && presentation.item?.active === true
        && !presentation.resolved;
    }

    private scheduleChestPresentationTimer(
      presentation: ChestLootPresentation,
      delay: number,
      callback: () => void,
    ) {
      const timer = this.time.delayedCall(delay, () => {
        if (!this.isCurrentChestPresentation(presentation)) return;
        callback();
      });
      presentation.timers.push(timer);
    }

    private beginChestLootFall(presentation: ChestLootPresentation) {
      const item = presentation.item;
      if (!item || !this.isCurrentChestPresentation(presentation)) return;
      presentation.phase = "fall";
      const floor = presentation.landingPoint;
      const fall = this.tweens.add({
        targets: item,
        x: floor.x,
        y: floor.y - item.displayHeight / 2,
        duration: 260,
        ease: "Quad.easeIn",
        onComplete: () => {
          if (!this.isCurrentChestPresentation(presentation)) return;
          presentation.phase = "contact";
          this.createChestLandingEffects(presentation);
          const contact = this.tweens.add({
            targets: item,
            scaleX: 1.14,
            scaleY: 0.84,
            duration: 80,
            yoyo: true,
            ease: "Sine.easeOut",
            onUpdate: () => {
              if (this.isCurrentChestPresentation(presentation)) {
                item.y = presentation.landingPoint.y - item.displayHeight / 2;
              }
            },
            onComplete: () => {
              if (!this.isCurrentChestPresentation(presentation)) return;
              item.setScale(1);
              item.y = presentation.landingPoint.y - item.displayHeight / 2;
              this.completeChestLootPresentation(presentation);
            },
          });
          presentation.tweens.push(contact);
        },
      });
      presentation.tweens.push(fall);
    }

    private createChestLandingEffects(presentation: ChestLootPresentation) {
      const style = presentation.rarity
        ? CHEST_LOOT_RARITY_PRESENTATION[presentation.rarity]
        : CACHE_FRAGMENT_FEEDBACK;
      const item = presentation.item;
      if (!item) return;
      for (let index = 0; index < style.outlineCount; index += 1) {
        const centerX = Math.round(item.x);
        const centerY = Math.round(item.y);
        const width = 34 + index * 6;
        const height = 24 + index * 4;
        const left = centerX - width / 2;
        const right = centerX + width / 2;
        const top = centerY - height / 2;
        const bottom = centerY + height / 2;
        const cut = 5 + index;
        const outline = this.add.graphics().setDepth(13);
        outline.lineStyle(2, style.color, 0.82);
        outline.strokePoints([
          { x: left + cut, y: top }, { x: right - cut, y: top },
          { x: right, y: top + cut }, { x: right, y: bottom - cut },
          { x: right - cut, y: bottom }, { x: left + cut, y: bottom },
          { x: left, y: bottom - cut }, { x: left, y: top + cut },
        ], true);
        presentation.effects.push(outline);
        const tween = this.tweens.add({
          targets: outline,
          y: -4,
          alpha: { from: 0.8, to: 0 },
          duration: 440 + index * 90,
          repeat: 0,
          delay: index * 70,
          onComplete: () => outline.destroy(),
        });
        presentation.tweens.push(tween);
      }
      for (let index = 0; index < style.sparkleCount; index += 1) {
        const angle = (Math.PI * 2 * index) / style.sparkleCount;
        const radius = 17 + (index % 3) * 5;
        const x = Math.round(item.x + Math.cos(angle) * radius);
        const y = Math.round(item.y + Math.sin(angle) * radius * 0.72);
        const sparkle = this.add.rectangle(x, y, index % 3 === 0 ? 3 : 2, index % 3 === 0 ? 3 : 2, style.color)
          .setDepth(13);
        presentation.effects.push(sparkle);
        const tween = this.tweens.add({
          targets: sparkle,
          y: Math.round(y - 4 - (index % 3) * 2),
          alpha: { from: 0.9, to: 0 },
          duration: 320 + (index % 4) * 80,
          repeat: 0,
          delay: index * 27,
          onComplete: () => sparkle.destroy(),
        });
        presentation.tweens.push(tween);
      }
    }

    private completeChestLootPresentation(presentation: ChestLootPresentation) {
      if (!this.isCurrentChestPresentation(presentation)) return;
      presentation.phase = presentation.kind === "loot" ? "waiting-choice" : "cache";
      presentation.resolved = true;
      this.resolveOpenedChest(this.time.now, presentation);
    }

    private resolveOpenedChest(time: number, presentation: ChestLootPresentation) {
      if (!this.chestAvailable || this.chest !== presentation.chest || !presentation.resolved) return;
      this.chestOpening = false;

      if (presentation.kind === "cache") {
        const reward = this.chestCacheReward;
        if (!reward) return;
        const room = presentation.roomId ? dungeonManager?.getRoom(presentation.roomId) : null;
        this.chestAvailable = false;
        this.destroyTreasureChestPrompt();
        this.clearChestPresentation(true);
        this.chest?.destroy();
        this.chest = null;
        this.chestRoomId = null;
        this.chestCacheReward = null;
        this.playSound("loot");
        this.runShards += reward.shards;
        this.hp = Math.min(this.maxHp, this.hp + reward.healing);
        if (room) this.dungeonWorld?.setDoorsLocked(room.id, false);
        this.spawnPulse(this.player.x, this.player.y, 88, 0x9bcf69);
        if (room?.type === "boss") this.createExitPortal(room);
        bridge.emitMessage(`Cache recolhido: +${reward.shards} fragmentos${reward.healing ? ` e +${reward.healing} HP` : ""}.`);
        this.emitRunCheckpoint();
        this.emitHud(time);
        return;
      }

      const loot = presentation.loot;
      if (!loot) return;
      this.pendingLoot = loot;
      bridge.emitMessage(`${loot.label} encontrado. Compare com seu equipamento atual antes de avançar.`);
      this.updateTreasureChestPrompt();
      this.emitHud(time);
    }

    private resumeChestPresentationPhysics() {
      if (!this.chestPhysicsPausedByPresentation) return;
      this.chestPhysicsPausedByPresentation = false;
      if (this.physics.world.isPaused) this.physics.world.resume();
    }

    private clearChestPresentation(resumePhysics = true) {
      const presentation = this.chestPresentation;
      if (presentation) {
        presentation.timers.forEach((timer) => timer.remove(false));
        presentation.tweens.forEach((tween) => {
          tween.stop();
          this.tweens.remove(tween);
        });
        presentation.effects.forEach((effect) => effect.destroy());
        presentation.shadow?.destroy();
        presentation.item?.destroy();
        if (this.chestPresentation === presentation) this.chestPresentation = null;
      }
      if (resumePhysics) this.resumeChestPresentationPhysics();
      else this.chestPhysicsPausedByPresentation = false;
    }

    private resolvePendingLoot(decision: "equip" | "keep" | "replace-a" | "replace-b", time: number) {
      const loot = this.pendingLoot;
      if (!loot) return;
      this.pendingLoot = null;
      this.chestAvailable = false;
      this.chestOpening = false;
      this.destroyTreasureChestPrompt();
      this.clearChestPresentation(true);
      this.chest?.destroy();
      this.chest = null;
      this.playSound("loot");
      const legacyArmor = loot.kind === "armor";
      if (!legacyArmor) this.runLoot.push({ id: loot.id, kind: loot.kind, quantity: 1, label: loot.label });
      if (decision !== "keep" && !legacyArmor) {
        const replaceSlot = decision === "replace-a"
          ? "A"
          : decision === "replace-b" || this.weaponSlots.B !== null
            ? "B"
            : undefined;
        this.applyRoomLoot(loot, replaceSlot);
      }

      if (this.chestRoomId && dungeonManager && this.dungeonWorld) {
        const roomId = this.chestRoomId;
        const relicHeal = getRelicChestHeal(selectedRelic);
        this.hp = Math.min(this.maxHp, this.hp + 14 + relicHeal);
        const room = dungeonManager.getRoom(roomId);
        if (room && room.state !== "cleared") dungeonManager.clearRoom(room.id);
        if (room) this.dungeonWorld.setDoorsLocked(room.id, false);
        this.chestLoot = null;
        this.chestRoomId = null;
        this.chestLootIndex = null;
        this.chestCacheReward = null;
        const relicNote = relicHeal > 0 ? ` ${selectedRelic.name} recuperou +${relicHeal} HP.` : "";
        const choiceNote = legacyArmor
          ? "Conteúdo antigo descartado; sua Lenda segue sem equipamento defensivo."
          : decision === "keep"
            ? `${loot.label} guardado; suas armas foram mantidas.`
            : `${loot.label} equipado no slot ${decision === "replace-a" ? "A" : decision === "replace-b" ? "B" : this.weaponSlots.active}.`;
        if (room?.type === "boss") {
          this.createExitPortal(room);
          bridge.emitMessage(`${choiceNote} O Curupira deixou uma recompensa. Entre no portal e pressione E para voltar à Guilda.`);
          this.emitHud(time);
          return;
        }
        bridge.emitMessage(`${choiceNote}${relicNote} Continue pela dungeon.`);
        this.emitRunCheckpoint();
        this.emitHud(time);
        return;
      }

      this.roomTransitionScheduled = true;
      const relicHeal = getRelicChestHeal(selectedRelic);
      this.hp = Math.min(this.maxHp, this.hp + 14 + relicHeal);
      this.roomIndex += 1;
      const relicNote = relicHeal > 0 ? ` ${selectedRelic.name} recuperou +${relicHeal} HP.` : "";
      const choiceNote = decision === "equip" ? `${loot.label} equipado.` : `${loot.label} guardado; equipamento atual mantido.`;
      bridge.emitMessage(`${choiceNote}${relicNote} Avançando para a sala ${this.roomIndex + 1}.`);
      this.emitHud(time);
      this.time.delayedCall(900, () => this.spawnCurrentRoom());
    }

    private setupReducedMotionPreference() {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        this.prefersReducedMotion = false;
        this.reducedMotionQuery = null;
        return;
      }

      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotionQuery = query;
      this.prefersReducedMotion = query.matches;

      const onChange = () => {
        if (this.reducedMotionQuery !== query) return;
        this.prefersReducedMotion = query.matches;
        this.syncExitPortalMotion();
      };
      const supportsEventListeners = typeof query.addEventListener === "function";
      if (supportsEventListeners) query.addEventListener("change", onChange);
      else query.addListener(onChange);

      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        this.events.off("shutdown", dispose);
        this.events.off("destroy", dispose);
        if (supportsEventListeners) query.removeEventListener("change", onChange);
        else query.removeListener(onChange);
        if (this.reducedMotionQuery === query) {
          this.reducedMotionQuery = null;
          this.prefersReducedMotion = false;
          this.clearExitPortalMotion();
        }
      };
      this.events.once("shutdown", dispose);
      this.events.once("destroy", dispose);
    }

    private stopExitPortalMotionTweens() {
      this.exitPortalMotionTweens.forEach((tween) => {
        tween.stop();
        this.tweens.remove(tween);
      });
      this.exitPortalMotionTweens = [];
    }

    private clearExitPortalMotion() {
      this.stopExitPortalMotionTweens();
      this.exitPortalMotionVisuals = null;
    }

    private syncExitPortalMotion() {
      const visuals = this.exitPortalMotionVisuals;
      if (!visuals || !this.exitPortal) return;

      this.stopExitPortalMotionTweens();
      visuals.outer.setAngle(0);
      visuals.inner.setScale(1).setAlpha(0.44);
      visuals.core.setScale(1).setAlpha(0.72);
      if (this.prefersReducedMotion) return;

      this.exitPortalMotionTweens.push(
        this.tweens.add({ targets: visuals.outer, angle: 360, duration: 4200, repeat: -1 }),
        this.tweens.add({
          targets: visuals.inner,
          scaleX: { from: 0.92, to: 1.1 },
          alpha: { from: 0.45, to: 0.92 },
          duration: 740,
          yoyo: true,
          repeat: -1,
        }),
        this.tweens.add({
          targets: visuals.core,
          scaleX: { from: 0.74, to: 1.08 },
          alpha: { from: 0.52, to: 0.96 },
          duration: 560,
          yoyo: true,
          repeat: -1,
        }),
      );
    }

    private shakeCameraForDamage() {
      if (this.prefersReducedMotion) return;
      this.cameras.main.shake(90, 0.0025);
    }

    private createExitPortal(room: DungeonRoom) {
      if (!this.dungeonWorld) return;
      this.playSound("portal");
      this.clearExitPortalMotion();
      this.exitPortal?.destroy(true);
      const center = this.dungeonWorld.getRoomCenter(room.id);
      const x = center.x;
      const y = center.y;
      const outer = this.add.ellipse(0, 0, 88, 116, 0x30213c, 0.78).setStrokeStyle(6, dungeon.colors.phase, 0.95);
      const inner = this.add.ellipse(0, 0, 54, 82, dungeon.colors.phaseTwo, 0.44).setStrokeStyle(3, 0xf2db9d, 0.9);
      const core = this.add.ellipse(0, 0, 24, 58, dungeon.colors.phaseThree, 0.72);
      this.exitPortalMotionVisuals = { outer, inner, core };
      this.exitPortal = this.add.container(x, y, [outer, inner, core]).setDepth(8);
      this.syncExitPortalMotion();
      this.exitPortalAvailable = true;
      bridge.emitMessage("Loot recolhido. Aproxime-se do portal e pressione E para voltar à Guilda.");
      this.emitRunCheckpoint();
      this.emitHud(this.time.now);
    }

    private tryUseExitPortal(time: number) {
      if (!this.exitPortalAvailable || !this.exitPortal) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitPortal.x, this.exitPortal.y);
      if (distance > 160) {
        bridge.emitMessage("Aproxime-se do portal de saída.");
        return;
      }
      this.playPlayerAction("idle", time, 280);
      this.finishRun(true, time);
    }

    private applyRoomLoot(loot: DungeonLoot, replaceSlot?: WeaponSlot) {
      if (loot.kind === "weapon") {
        const result = pickUpWeapon(this.weaponSlots, loot.id, replaceSlot);
        if (result.status !== "equipped") return;
        this.weaponSlots = result.state;
        this.basicAttackCounter = 0;
        return;
      }

      // Retired armor rewards from old signed plans are never equipped.
    }

    private finishRun(victory: boolean, time: number) {
      if (this.runEnded) return;
      this.runEnded = true;
      this.victory = victory;
      this.clearChestPresentation(true);
      this.chestAvailable = false;
      this.chestOpening = false;
      this.destroyTreasureChestPrompt();
      this.chest?.destroy();
      this.chest = null;
      this.audio?.setMusicMode("exploration");
      this.playSound(victory ? "victory" : "defeat");
      this.playPlayerAction(victory ? "idle" : "defeat", time, 1200);
      this.pendingEnemySpawns.clear();
      this.exitPortalAvailable = false;
      this.clearExitPortalMotion();
      this.exitPortal?.destroy(true);
      this.exitPortal = null;
      this.clearEnemyProjectiles();
      this.clearServerProjectileVisuals();
      this.clearServerHazardVisuals();
      this.player.setVelocity(0, 0);
      this.enemies.getChildren().forEach((child) => (child as ArcadeSprite).setVelocity(0, 0));
      bridge.emitMessage(victory ? dungeon.messages.victory : dungeon.messages.defeat);
      const state = this.buildHudState(time);
      bridge.emitHud(state);
      this.emitRunCheckpoint();
      bridge.emitRunEnd(state);
    }

    private emitRunCheckpoint() {
      if (!dungeonManager) return;
      const room = dungeonManager.getCurrentRoom();
      bridge.emitRunCheckpoint(snapshotArpgRunCheckpoint({
        currentRoomId: room.id,
        visitedRoomIds: dungeonManager.getVisitedRoomIds(),
        clearedRoomIds: dungeonManager.getClearedRoomIds(),
        brokenBreakableIds: [...this.brokenBreakableIds].sort(),
        playerHp: Math.max(0, Math.round(this.hp)),
        maxHp: Math.max(1, Math.round(this.maxHp)),
        weaponId: this.currentWeaponId,
        weaponAId: this.weaponSlots.A,
        weaponBId: this.weaponSlots.B,
        activeWeaponSlot: this.weaponSlots.active,
        armorId: this.currentArmorId,
        xpEarned: Math.max(0, Math.round(this.xpEarned)),
        runShards: Math.max(0, Math.round(this.runShards)),
        runLoot: this.runLoot.map((item) => ({ ...item })),
        rewardRoomId: this.chestRoomId,
        exitPortalAvailable: this.exitPortalAvailable || (this.runEnded && this.victory),
        runMoveSpeedBonus: this.runMoveSpeedBonus,
        runBasicDamageMultiplier: this.runBasicDamageMultiplier,
      }));
    }

    private playSound(cue: ArpgSoundCue) {
      this.audio?.play(cue);
    }

    private playPlayerAction(animation: NativePixelActorAnimation, time: number, duration: number) {
      this.playerActionUntil = Math.max(this.playerActionUntil, time + duration);
      const animationKey = `${playerAnimationKeyPrefix}-${animation}`;
      const sameActionStillPlaying = animation !== "idle"
        && this.player.anims.isPlaying
        && this.player.anims.currentAnim?.key === animationKey;
      if (!sameActionStillPlaying) playNativePlayerAnimation(this.player, animation, true);
    }

    private flashPlayer(color: number, duration: number) {
      this.player.setTint(color);
      this.time.delayedCall(duration, () => this.player.active && this.player.clearTint());
    }

    private buildDungeonMap(): ArpgDungeonMapState | null {
      if (!dungeonManager) return null;
      const current = dungeonManager.getCurrentRoom();
      const visibleRooms = dungeonManager.getVisibleRooms();
      const visitedRoomIds = new Set(dungeonManager.getVisitedRoomIds());
      const visibleIds = new Set(visibleRooms.map((room) => room.id));
      return {
        currentRoomId: current.id,
        rooms: visibleRooms.map((room) => {
          const state: ArpgMiniMapRoomState = room.state === "unvisited" ? "discovered" : room.state;
          const revealType = visitedRoomIds.has(room.id) || room.state === "cleared" || room.type === "start";
          return {
            id: room.id,
            gridX: room.gridX,
            gridY: room.gridY,
            type: revealType ? room.type : "unknown",
            state,
            connections: Object.values(room.connections)
              .filter((id): id is string => typeof id === "string" && visibleIds.has(id)),
          };
        }),
      };
    }

    private buildHudState(time: number): ArpgHudState {
      const proceduralRoom = dungeonManager?.getCurrentRoom();
      const proceduralRoomCount = dungeonManager ? Object.keys(dungeonManager.getGraph().rooms).length : null;
      return {
        nowMs: time,
        hp: this.hp,
        maxHp: this.maxHp,
        room: proceduralRoom ? proceduralRoom.distanceFromStart + 1 : this.roomIndex + 1,
        roomCount: proceduralRoomCount ?? this.roomWaves.length,
        enemiesRemaining: this.enemies?.countActive(true) ?? 0,
        weaponId: this.currentWeaponId,
        weaponSlots: this.weaponSlots,
        armorId: this.currentArmorId,
        relicId: selectedRelic.id,
        dungeonMap: this.buildDungeonMap(),
        runShards: this.runShards,
        runMoveSpeedBonus: this.runMoveSpeedBonus,
        runBasicDamageMultiplier: this.runBasicDamageMultiplier,
        chestAvailable: this.chestAvailable && !this.chestOpening && !this.pendingLoot,
        exitPortalAvailable: this.exitPortalAvailable,
        pendingLoot: this.pendingLoot
          ? { id: this.pendingLoot.id, kind: this.pendingLoot.kind, quantity: 1, label: this.pendingLoot.label }
          : null,
        pendingRoomChoice: this.pendingRoomChoice,
        runLoot: this.runLoot.filter((item) => item.kind !== "armor"),
        abilityIds: loadout.abilityIds,
        dashReadyAt: Math.max(time, this.nextDashAt),
        abilityReadyAt: { ...this.abilityReadyAt },
        xpEarned: this.xpEarned,
        runEnded: this.runEnded,
        victory: this.victory,
      };
    }

    private emitHud(time: number) {
      this.updateDungeonDebugOverlay();
      bridge.emitHud(this.buildHudState(time));
    }

    private readDungeonDebugState() {
      const graph = dungeonManager?.getGraph() ?? null;
      const room = dungeonManager?.getCurrentRoom() ?? null;
      const bounds = room ? this.dungeonWorld?.layout.rooms[room.id] ?? null : null;
      return {
        seed: graph?.seed ?? null,
        runShards: this.runShards,
        startRoomId: graph?.startRoomId ?? null,
        bossRoomId: graph?.bossRoomId ?? null,
        rooms: graph
          ? Object.values(graph.rooms).map((item) => ({
            id: item.id,
            gridX: item.gridX,
            gridY: item.gridY,
            type: item.type,
            templateId: item.templateId,
            state: item.state,
            distanceFromStart: item.distanceFromStart,
            connections: { ...item.connections },
          }))
          : [],
        room: room ? {
          id: room.id,
          gridX: room.gridX,
          gridY: room.gridY,
          type: room.type,
          templateId: room.templateId,
          state: room.state,
        } : null,
        specialRoomAnchor: room && this.specialRoomAnchors.has(room.id)
          ? {
            x: Math.round(this.specialRoomAnchors.get(room.id)!.x),
            y: Math.round(this.specialRoomAnchors.get(room.id)!.y),
          }
          : null,
        doors: room
          ? Object.entries(room.connections)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([direction, targetRoomId]) => ({ direction, targetRoomId }))
          : [],
        doorStates: room ? this.dungeonWorld?.getDoorDebugStates(room.id) ?? [] : [],
        ambient: this.dungeonWorld?.getAmbientDebugState() ?? null,
        wave: this.proceduralController?.snapshot() ?? null,
        activeCurupiraRootBarriers: this.activeCurupiraRootBarriers,
        runtime: {
          sceneTime: this.time?.now ?? null,
          sceneActive: this.scene?.isActive(this.scene.key) ?? false,
          scenePaused: this.scene?.isPaused() ?? false,
          sceneStatus: this.sys?.settings.status ?? null,
          gameRunning: this.game?.isRunning ?? false,
          runEnded: this.runEnded,
          victory: this.victory,
          pendingLootKind: this.pendingLoot?.kind ?? null,
          pendingRoomChoice: this.pendingRoomChoice?.title ?? null,
          gamepad: { connected: this.gamepad.connected, moveX: this.gamepad.moveX, moveY: this.gamepad.moveY },
        },
        enemiesActive: this.enemies?.getChildren().filter((child) => {
          const enemy = child as ArcadeSprite;
          return enemy.active && enemy.getData("spawnReady");
        }).length ?? 0,
        enemyPositions: this.enemies?.getChildren().filter((child) => {
          const enemy = child as ArcadeSprite;
          return enemy.active && enemy.getData("spawnReady") && !enemy.getData("defeatPending");
        }).map((child) => {
          const enemy = child as ArcadeSprite;
          return {
            runtimeId: String(enemy.getData("runtimeId")),
            definitionId: String(enemy.getData("definitionId")),
            x: Math.round(enemy.x),
            y: Math.round(enemy.y),
            animation: enemy.anims.currentAnim?.key ?? null,
            defeatPending: Boolean(enemy.getData("defeatPending")),
          };
        }) ?? [],
        animatedEnemies: this.enemies?.getChildren().filter((child) => {
          const enemy = child as ArcadeSprite;
          return enemy.active && typeof enemy.getData("animationProfile") === "string";
        }).map((child) => {
          const enemy = child as ArcadeSprite;
          return {
            runtimeId: String(enemy.getData("runtimeId")),
            definitionId: String(enemy.getData("definitionId")),
            x: Math.round(enemy.x),
            y: Math.round(enemy.y),
            animation: enemy.anims.currentAnim?.key ?? null,
            animationHistory: Array.isArray(enemy.getData("animationHistory"))
              ? [...enemy.getData("animationHistory") as string[]]
              : [],
            frame: enemy.frame.name,
            defeatPending: Boolean(enemy.getData("defeatPending")),
            phase: enemy.getData("phase") ?? null,
            bossPattern: enemy.getData("lastBossPattern") ?? null,
          };
        }) ?? [],
        pendingSpawns: this.pendingEnemySpawns.size,
        breakables: this.breakableObjects?.getChildren().map((child) => {
          const object = child as ArcadeSprite;
          return {
            id: String(object.getData("breakableId")),
            roomId: String(object.getData("roomId")),
            kind: String(object.getData("kind")),
            hitPoints: Number(object.getData("hitPoints")),
            active: object.active,
            x: Math.round(object.x),
            y: Math.round(object.y),
          };
        }) ?? [],
        playerInEnemyGroup: this.enemies?.contains(this.player) ?? false,
        playerInProjectileGroups: Boolean(this.projectiles?.contains(this.player) || this.enemyProjectiles?.contains(this.player)),
        playerLifecycleEvents: [...this.playerLifecycleEvents],
        player: this.player ? {
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          active: this.player.active,
          bodyEnabled: this.player.body?.enable ?? false,
          velocityX: Math.round(this.player.body?.velocity.x ?? 0),
          velocityY: Math.round(this.player.body?.velocity.y ?? 0),
        } : null,
        chestPresentation: this.chestPresentation
          ? {
            id: this.chestPresentation.id,
            kind: this.chestPresentation.kind,
            roomId: this.chestPresentation.roomId,
            phase: this.chestPresentation.phase,
            itemId: this.chestPresentation.itemId,
            rarity: this.chestPresentation.rarity,
            x: Math.round(this.chestPresentation.item?.x ?? this.chestPresentation.landingPoint.x),
            y: Math.round(this.chestPresentation.item?.y ?? this.chestPresentation.landingPoint.y),
            itemCount: this.chestPresentation.item?.active && this.chestPresentation.item.visible ? 1 : 0,
            itemSpawnCount: this.chestPresentation.itemSpawnCount,
          }
          : null,
        chest: this.chestAvailable && this.chest
          ? {
            x: Math.round(this.chest.x),
            y: Math.round(this.chest.y),
            animation: this.chest.anims.currentAnim?.key ?? null,
            frame: Number(this.chest.frame.name),
            opening: this.chestOpening,
            frameWidth: this.chest.frame.width,
            frameHeight: this.chest.frame.height,
            displayWidth: this.chest.displayWidth,
            displayHeight: this.chest.displayHeight,
          }
          : null,
        exitPortal: this.exitPortalAvailable && this.exitPortal
          ? { x: Math.round(this.exitPortal.x), y: Math.round(this.exitPortal.y) }
          : null,
        bounds: bounds ? {
          x: bounds.left,
          y: bounds.top,
          width: bounds.width,
          height: bounds.height,
        } : null,
      };
    }

    /**
     * Development-only visual ruler for the reference-locked action view. It
     * deliberately contains measurements instead of any third-party image so
     * designers can compare captured Folklard frames beside the supplied
     * reference without shipping it in the game.
     */
    private createVisualReferenceOverlay() {
      if (!dungeonManager || typeof window === "undefined") return;
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("visualReference") !== "1") return;
      this.visualReferenceEnabled = true;
      this.visualReferenceText = this.add.text(12, 12, "", {
        color: "#fff0bd",
        backgroundColor: "#172019e8",
        fontFamily: "monospace",
        fontSize: "11px",
        padding: { x: 7, y: 5 },
      }).setScrollFactor(0).setDepth(1_100);
      this.updateVisualReferenceOverlay();

      const referenceWindow = window as Window & {
        __folklardVisualReferenceMode?: () => {
          roomId: string | null;
          roomPixels: { width: number; height: number } | null;
          cameraPixels: { width: number; height: number };
          playerPixels: { width: number; height: number };
          playerToRoomHeight: number | null;
          cameraToRoomWidth: number | null;
          corridorWidth: number;
        };
      };
      const readReference = () => this.readVisualReferenceMetrics();
      referenceWindow.__folklardVisualReferenceMode = readReference;
      this.events.once("destroy", () => {
        if (referenceWindow.__folklardVisualReferenceMode === readReference) {
          delete referenceWindow.__folklardVisualReferenceMode;
        }
      });
    }

    private readVisualReferenceMetrics() {
      const room = this.dungeonWorld && this.proceduralRoomId
        ? this.dungeonWorld.layout.rooms[this.proceduralRoomId] ?? null
        : null;
      const cameraWidth = Math.round(this.cameras.main.width);
      const cameraHeight = Math.round(this.cameras.main.height);
      const playerWidth = Math.round(this.player.displayWidth);
      const playerHeight = Math.round(this.player.displayHeight);
      return {
        roomId: room?.roomId ?? null,
        roomPixels: room ? { width: Math.round(room.width), height: Math.round(room.height) } : null,
        cameraPixels: { width: cameraWidth, height: cameraHeight },
        playerPixels: { width: playerWidth, height: playerHeight },
        playerToRoomHeight: room ? Number((playerHeight / room.height).toFixed(3)) : null,
        cameraToRoomWidth: room ? Number((cameraWidth / room.width).toFixed(3)) : null,
        corridorWidth: DUNGEON_CORRIDOR_WIDTH,
      };
    }

    private updateVisualReferenceOverlay() {
      if (!this.visualReferenceText) return;
      const metrics = this.readVisualReferenceMetrics();
      this.visualReferenceText.setText([
        "VISUAL REFERENCE MODE · Folklard",
        `sala ${metrics.roomId ?? "—"} · ${metrics.roomPixels ? `${metrics.roomPixels.width}×${metrics.roomPixels.height}` : "—"}`,
        `câmera ${metrics.cameraPixels.width}×${metrics.cameraPixels.height} · personagem ${metrics.playerPixels.width}×${metrics.playerPixels.height}`,
        `personagem/sala ${metrics.playerToRoomHeight ?? "—"} · câmera/sala ${metrics.cameraToRoomWidth ?? "—"}`,
        `corredor ${metrics.corridorWidth}px · referência: sala compacta, HUD mínima`,
      ]);
    }

    private createDungeonDebugOverlay() {
      if (!dungeonManager || typeof window === "undefined") return;
      const searchParams = new URLSearchParams(window.location.search);
      const debugEnabled = searchParams.get("debugDungeon") === "1";
      const performanceEnabled = searchParams.get("performanceBenchmark") === "1";
      if (!debugEnabled && !performanceEnabled) return;

      if (debugEnabled) {
        const recordPlayerLifecycleEvent = (event: string) => {
          this.playerLifecycleEvents.push({
            event,
            sceneTime: this.time?.now ?? 0,
            stack: new Error().stack?.split("\n").slice(2, 7).join("\n"),
          });
          if (this.playerLifecycleEvents.length > 12) this.playerLifecycleEvents.shift();
        };
        const setActive = this.player.setActive.bind(this.player);
        this.player.setActive = ((active: boolean) => {
          if (!active) recordPlayerLifecycleEvent("setActive(false)");
          return setActive(active);
        }) as typeof this.player.setActive;
        const disableBody = this.player.disableBody.bind(this.player);
        this.player.disableBody = ((disableGameObject?: boolean, hideGameObject?: boolean) => {
          recordPlayerLifecycleEvent(`disableBody(${Boolean(disableGameObject)},${Boolean(hideGameObject)})`);
          return disableBody(disableGameObject, hideGameObject);
        }) as typeof this.player.disableBody;
        const destroyPlayer = this.player.destroy.bind(this.player);
        this.player.destroy = ((fromScene?: boolean) => {
          recordPlayerLifecycleEvent(`destroy(${Boolean(fromScene)})`);
          return destroyPlayer(fromScene);
        }) as typeof this.player.destroy;
        this.events.once("shutdown", () => recordPlayerLifecycleEvent("scene shutdown"));
        this.events.once("destroy", () => recordPlayerLifecycleEvent("scene destroy"));
        this.dungeonDebugText = this.add.text(14, WORLD_HEIGHT - 126, "", {
          color: "#f4e6c1",
          backgroundColor: "#11180ddd",
          fontFamily: "monospace",
          fontSize: "13px",
          padding: { x: 7, y: 5 },
        }).setScrollFactor(0).setDepth(1000);
      }

      const debugWindow = window as Window & {
        __cardRealmsDungeonDebug?: () => object;
        __cardRealmsDungeonDebugOverlay?: (visible: boolean) => void;
        __cardRealmsDungeonMoveToWorld?: (x: number, y: number) => boolean;
        __cardRealmsDungeonSetPerformanceLoad?: (load: { enemies: number; projectiles: number; particles: number }) => object;
        __cardRealmsDungeonGetPerformanceState?: () => object;
      };
      const debugReader = () => this.readDungeonDebugState();
      const debugOverlay = (visible: boolean) => this.dungeonDebugText?.setVisible(visible);
      const debugMover = (x: number, y: number) => this.setClickDestination({
        button: 0,
        wasTouch: false,
        worldX: x,
        worldY: y,
      });
      const performanceLoad = (load: { enemies: number; projectiles: number; particles: number }) =>
        this.setPerformanceLoad(load);
      const performanceState = () => this.readPerformanceState();
      if (debugEnabled) {
        debugWindow.__cardRealmsDungeonDebug = debugReader;
        debugWindow.__cardRealmsDungeonDebugOverlay = debugOverlay;
        debugWindow.__cardRealmsDungeonMoveToWorld = debugMover;
      }
      if (performanceEnabled) {
        debugWindow.__cardRealmsDungeonSetPerformanceLoad = performanceLoad;
        debugWindow.__cardRealmsDungeonGetPerformanceState = performanceState;
      }
      this.events.once("destroy", () => {
        if (debugEnabled && debugWindow.__cardRealmsDungeonDebug === debugReader) delete debugWindow.__cardRealmsDungeonDebug;
        if (debugEnabled && debugWindow.__cardRealmsDungeonDebugOverlay === debugOverlay) delete debugWindow.__cardRealmsDungeonDebugOverlay;
        if (debugEnabled && debugWindow.__cardRealmsDungeonMoveToWorld === debugMover) delete debugWindow.__cardRealmsDungeonMoveToWorld;
        if (performanceEnabled && debugWindow.__cardRealmsDungeonSetPerformanceLoad === performanceLoad) {
          delete debugWindow.__cardRealmsDungeonSetPerformanceLoad;
        }
        if (performanceEnabled && debugWindow.__cardRealmsDungeonGetPerformanceState === performanceState) {
          delete debugWindow.__cardRealmsDungeonGetPerformanceState;
        }
      });
    }

    private setPerformanceLoad(load: { enemies: number; projectiles: number; particles: number }) {
      const requested = {
        enemies: Math.trunc(load.enemies),
        projectiles: Math.trunc(load.projectiles),
        particles: Math.trunc(load.particles),
      };
      if (
        !Object.values(requested).every(Number.isFinite)
        || requested.enemies < 0 || requested.enemies > 50
        || requested.projectiles < 0 || requested.projectiles > 300
        || requested.particles < 0 || requested.particles > 300
      ) throw new Error("Carga de benchmark fora dos limites permitidos.");

      this.benchmarkParticleEmitter?.destroy();
      this.benchmarkParticleEmitter = null;
      this.pendingEnemySpawns.clear();
      this.enemies.getChildren().forEach((child) => {
        const enemy = child as ArcadeSprite;
        enemy.setActive(false).setVisible(false).setVelocity(0, 0);
        if (enemy.body) enemy.body.enable = false;
      });
      [this.projectiles, this.enemyProjectiles].forEach((group) => {
        group.getChildren().forEach((child) => this.recycleProjectile(child as ArcadeSprite));
      });

      const room = dungeonManager?.getCurrentRoom();
      const bounds = room ? this.dungeonWorld?.layout.rooms[room.id] : null;
      if (!room || !bounds) throw new Error("A carga de benchmark requer uma sala ativa.");
      const enemyId = room.waves.flat().find((id) => Boolean(dungeon.enemies[id]))
        ?? Object.keys(dungeon.enemies).find((id) => dungeon.enemies[id]?.combatRole === "melee")
        ?? Object.keys(dungeon.enemies)[0];
      if (requested.enemies > 0 && !enemyId) throw new Error("A sala ativa não possui criatura para benchmark.");
      const columns = Math.ceil(Math.sqrt(Math.max(1, requested.enemies)));
      const rows = Math.ceil(requested.enemies / columns);
      const inset = 48;
      for (let index = 0; index < requested.enemies; index += 1) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = bounds.left + inset + ((column + 0.5) / columns) * (bounds.width - inset * 2);
        const y = bounds.top + inset + ((row + 0.5) / rows) * (bounds.height - inset * 2);
        const enemy = this.spawnEnemyInstance(enemyId!, `benchmark:${index}`, x, y);
        if (!enemy) throw new Error(`Não foi possível criar criatura de benchmark ${index + 1}.`);
        enemy.setData("performanceBenchmark", true);
        enemy.setData("hp", 1_000_000);
        enemy.setData("maxHp", 1_000_000);
        enemy.setData("contactDamage", 0);
        enemy.setData("nextSpecialAt", this.time.now + 60_000);
      }

      for (let index = 0; index < requested.projectiles; index += 1) {
        const column = index % 25;
        const row = Math.floor(index / 25);
        const x = bounds.left + inset + ((column + 0.5) / 25) * (bounds.width - inset * 2);
        const y = bounds.top + inset + ((row + 0.5) / Math.max(1, Math.ceil(requested.projectiles / 25))) * (bounds.height - inset * 2);
        const projectile = this.projectiles.get(x, y, "arpg-projectile") as ArcadeSprite | null;
        if (!projectile) throw new Error(`O pool de projéteis não comporta ${requested.projectiles} instâncias.`);
        const angle = index * 2.399963229728653;
        projectile.setActive(true).setVisible(true).setTint(0xd9eeff).setDepth(11);
        projectile.body!.enable = true;
        projectile.setCircle(5, 1, 1);
        projectile.setVelocity(Math.cos(angle) * 92, Math.sin(angle) * 92);
        projectile.setData("damage", 0);
        projectile.setData("expiresAt", this.time.now + 60_000);
        projectile.setData("piercing", true);
        projectile.setData("hitIds", new Set<string>());
      }

      if (requested.particles > 0) {
        this.benchmarkParticleEmitter = this.add.particles(0, 0, "arpg-projectile", {
          angle: { min: 0, max: 360 },
          speed: { min: 35, max: 110 },
          lifespan: { min: 5_000, max: 6_000 },
          scale: { start: 0.8, end: 0.1 },
          alpha: { start: 0.85, end: 0 },
          maxParticles: requested.particles,
          blendMode: "ADD",
          name: "performance-benchmark-particles",
        }).setDepth(12);
        this.benchmarkParticleEmitter.explode(requested.particles, this.player.x, this.player.y);
      }

      return {
        requested,
        ...this.readPerformanceState(),
      };
    }

    private readPerformanceState() {
      return {
        actual: {
          enemies: this.enemies.getChildren().filter((child) => {
            const enemy = child as ArcadeSprite;
            return enemy.active && enemy.getData("spawnReady");
          }).length,
          projectiles: this.projectiles.getChildren().filter((child) => (child as ArcadeSprite).active).length,
          particles: this.benchmarkParticleEmitter?.getAliveParticleCount() ?? 0,
        },
        rendererType: this.game.renderer.type,
        physicsFps: this.physics.world.fps,
      };
    }

    private updateDungeonDebugOverlay() {
      if (!this.dungeonDebugText) return;
      const state = this.readDungeonDebugState();
      const room = state.room;
      const wave = state.wave;
      this.dungeonDebugText.setText([
        `SEED ${state.seed ?? "—"}`,
        room ? `ROOM ${room.id} (${room.gridX},${room.gridY}) ${room.type} · ${room.state}` : "ROOM —",
        `DOORS ${state.doors.map((door) => `${door.direction}:${door.targetRoomId}`).join("  ") || "—"}`,
        `WAVE ${wave ? `${wave.waveIndex + 1}/${wave.waveCount} ${wave.state} · ${wave.enemiesAlive} vivos` : "—"}`,
        `ENEMIES ${state.enemiesActive} · SPAWNING ${state.pendingSpawns} · PLAYER ${state.player?.x ?? "—"},${state.player?.y ?? "—"}`,
        state.bounds ? `BOUNDS ${state.bounds.x},${state.bounds.y} ${state.bounds.width}×${state.bounds.height}` : "BOUNDS —",
      ]);
    }
  };
}
