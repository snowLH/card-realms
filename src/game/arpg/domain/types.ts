import type { Element, Rarity } from "@/game/types";
import type { ArpgDungeonCombatCommand, ArpgDungeonCombatState } from "../dungeon/combat-authority";
import type { ArpgVisualEvent } from "./visual-events";

export type ArpgVector = { x: number; y: number };
export type WeaponKind = "sword" | "bow" | "staff";
export type ArmorKind = "light" | "medium" | "ritual";
export type AbilityKind = "projectile" | "area" | "control" | "defense";
export type AbilityBehavior =
  | "projectile"
  | "piercing-projectile"
  | "self-area"
  | "targeted-control"
  | "renewal";
export type AbilityAcquisitionSource = "starter" | "lobby-shop";
export type WeaponEffectId =
  | "forest-rhythm"
  | "spirit-echo"
  | "tide-cleave"
  | "river-pierce"
  | "iara-renewal";
export type ArmorEffectId =
  | "curupira-ward"
  | "ritual-focus"
  | "kelpie-step"
  | "ahuizotl-retaliation";
export type RelicEffectId = "xp-insight" | "chest-renewal" | "attack-resonance";
export type RelicAcquisitionSource = "starter" | "dungeon-clear";

export type ArpgWeaponDefinition = {
  id: string;
  name: string;
  kind: WeaponKind;
  rarity: Rarity;
  element: Element;
  damage: number;
  attackRateMs: number;
  projectileSpeed?: number;
  range: number;
  effect?: {
    id: WeaponEffectId;
    label: string;
    description: string;
  };
  description: string;
};

export type ArpgArmorDefinition = {
  id: string;
  name: string;
  kind: ArmorKind;
  rarity: Rarity;
  maxHpBonus: number;
  defenseBonus: number;
  moveSpeedBonus: number;
  effect?: {
    id: ArmorEffectId;
    label: string;
    description: string;
  };
  description: string;
};

export type ArpgRelicDefinition = {
  id: string;
  name: string;
  rarity: Rarity;
  effect: RelicEffectId;
  effectLabel: string;
  description: string;
  acquisition: {
    source: RelicAcquisitionSource;
    label: string;
  };
};
export type ArpgAbilityCardDefinition = {
  id: string;
  name: string;
  creatureId: string;
  rarity: Rarity;
  element: Element;
  kind: AbilityKind;
  behavior: AbilityBehavior;
  cooldownMs: number;
  damage: number;
  radius?: number;
  projectileSpeed?: number;
  durationMs?: number;
  restoreHp?: number;
  purchasePrice: number | null;
  purchasable: boolean;
  acquisition: {
    source: AbilityAcquisitionSource;
    label: string;
  };
  description: string;
};

export type EnemyDefinition = {
  id: string;
  name: string;
  combatRole?: "melee" | "ranged" | "charger" | "caster" | "elite";
  maxHp: number;
  moveSpeed: number;
  contactDamage: number;
  rewardXp: number;
  tint: number;
  radius: number;
};
export type ArpgLootKind = "weapon" | "armor" | "material" | "card";

export type ArpgRunLootEntry = {
  id: string;
  kind: ArpgLootKind;
  quantity: number;
  label: string;
};

export type ArpgRunCheckpointState = {
  version: 1;
  currentRoomId: string;
  clearedRoomIds: string[];
  brokenBreakableIds: string[];
  playerHp: number;
  maxHp: number;
  weaponId: string;
  armorId: string;
  xpEarned: number;
  runShards: number;
  runLoot: ArpgRunLootEntry[];
  rewardRoomId: string | null;
  exitPortalAvailable: boolean;
  runMoveSpeedBonus: number;
  runBasicDamageMultiplier: number;
};

export type ArpgLoadout = {
  weaponId: string;
  armorId: string;
  relicId: string;
  abilityIds: [string, string];
};

export type ArpgMiniMapRoomType = "unknown" | "start" | "combat" | "treasure" | "event" | "elite" | "rest" | "shop" | "boss";
export type ArpgMiniMapRoomState = "discovered" | "active" | "combat" | "cleared";
export type ArpgMiniMapRoom = {
  id: string;
  gridX: number;
  gridY: number;
  type: ArpgMiniMapRoomType;
  state: ArpgMiniMapRoomState;
  connections: string[];
};
export type ArpgDungeonMapState = {
  currentRoomId: string;
  rooms: ArpgMiniMapRoom[];
};

export type ArpgRoomChoiceState = {
  type: "rest" | "event" | "shop";
  title: string;
  description: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
    costShards: number;
  }>;
};

export type ArpgHudState = {
  nowMs: number;
  hp: number;
  maxHp: number;
  room: number;
  roomCount: number;
  enemiesRemaining: number;
  weaponId: string;
  armorId: string;
  relicId: string;
  dungeonMap: ArpgDungeonMapState | null;
  runShards: number;
  chestAvailable: boolean;
  exitPortalAvailable?: boolean;
  pendingLoot: ArpgRunLootEntry | null;
  pendingRoomChoice: ArpgRoomChoiceState | null;
  runLoot: ArpgRunLootEntry[];
  abilityIds: [string, string];
  dashReadyAt: number;
  abilityReadyAt: Record<string, number>;
  xpEarned: number;
  runEnded: boolean;
  victory: boolean;
};

export type ArpgInputState = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  attack: boolean;
};

export type ArpgRuntimeBridge = {
  getSoundEnabled(): boolean;
  setSoundEnabled(enabled: boolean): void;
  onSoundEnabled(listener: (enabled: boolean) => void): () => void;
  getInput(): Readonly<ArpgInputState>;
  clearGameplayInput(): void;
  consumeDash(): boolean;
  consumeInteract(): boolean;
  consumeLootDecision(): "equip" | "keep" | null;
  consumeRoomChoice(): string | null;
  consumeAbility(slot: 0 | 1): boolean;
  emitHud(state: ArpgHudState): void;
  emitMessage(message: string): void;
  emitRunEnd(state: ArpgHudState): void;
  emitRunCheckpoint(state: ArpgRunCheckpointState): void;
  emitVisualEvent(event: ArpgVisualEvent): void;
  onVisualEvent(listener: (event: ArpgVisualEvent) => void): () => void;
  onAttackHit(listener: (event: Extract<ArpgVisualEvent, { type: "attack.hit" }>) => void): () => void;
  onBattleVictory(listener: (event: Extract<ArpgVisualEvent, { type: "battle.finished" }>) => void): () => void;
  isServerAuthoritativeCombat(): boolean;
  submitEncounterCommand(
    roomId: string,
    command: ArpgDungeonCombatCommand,
  ): Promise<{ state: ArpgDungeonCombatState; revision: number } | null>;
};
