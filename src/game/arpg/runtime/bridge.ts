import type {
  ArpgHudState,
  ArpgInputState,
  ArpgRunCheckpointState,
  ArpgRuntimeBridge,
} from "../domain/types";
import type { ArpgVisualEvent } from "../domain/visual-events";
import type { ArpgDungeonCombatCommand, ArpgDungeonCombatState } from "../dungeon/combat-authority";

type HudListener = (state: ArpgHudState) => void;
type MessageListener = (message: string) => void;
type CheckpointListener = (state: ArpgRunCheckpointState) => void;
type SoundEnabledListener = (enabled: boolean) => void;
type VisualEventListener = (event: ArpgVisualEvent) => void;
type EncounterActionHandler = (
  roomId: string,
  command: ArpgDungeonCombatCommand,
) => Promise<{ state: ArpgDungeonCombatState; revision: number } | null>;

export class ArpgBridge implements ArpgRuntimeBridge {
  private seenBossIntroIds: string[] = [];
  private restorationHandler: ((encounter: import("../bosses/boss-encounter-controller").BossEncounterSnapshot) => Promise<boolean>) | null = null;
  private introSeenHandler: ((bossId: string) => void) | null = null;
  getSeenBossIntroIds() { return this.seenBossIntroIds; }
  setSeenBossIntroIds(ids: readonly string[]) { this.seenBossIntroIds = [...ids]; }
  markBossIntroSeen(bossId: string) {
    if (!this.seenBossIntroIds.includes(bossId)) this.seenBossIntroIds.push(bossId);
    this.introSeenHandler?.(bossId);
  }
  setBossProgressHandlers(
    restore: (encounter: import("../bosses/boss-encounter-controller").BossEncounterSnapshot) => Promise<boolean>,
    seen: (bossId: string) => void,
  ) {
    this.restorationHandler = restore;
    this.introSeenHandler = seen;
    return () => { this.restorationHandler = null; this.introSeenHandler = null; };
  }
  persistBossRestoration(encounter: import("../bosses/boss-encounter-controller").BossEncounterSnapshot) {
    return this.restorationHandler?.(encounter) ?? Promise.resolve(false);
  }
  private soundEnabled = true;
  private serverAuthoritativeCombat = false;
  private encounterActionHandler: EncounterActionHandler | null = null;
  private input: ArpgInputState = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    attack: false,
  };

  private dashQueued = false;
  private interactQueued = false;
  private lootDecision: "equip" | "keep" | "replace-a" | "replace-b" | null = null;
  private weaponSwitchQueued = false;
  private roomChoice: string | null = null;
  private abilityQueued = [false, false];
  private hudListeners = new Set<HudListener>();
  private messageListeners = new Set<MessageListener>();
  private endListeners = new Set<HudListener>();
  private checkpointListeners = new Set<CheckpointListener>();
  private soundEnabledListeners = new Set<SoundEnabledListener>();
  private visualEventListeners = new Set<VisualEventListener>();

  getSoundEnabled() {
    return this.soundEnabled;
  }

  setSoundEnabled(enabled: boolean) {
    if (this.soundEnabled === enabled) return;
    this.soundEnabled = enabled;
    this.soundEnabledListeners.forEach((listener) => listener(enabled));
  }

  setServerAuthoritativeCombat(enabled: boolean) {
    this.serverAuthoritativeCombat = enabled;
  }

  isServerAuthoritativeCombat() {
    return this.serverAuthoritativeCombat;
  }

  setEncounterActionHandler(handler: EncounterActionHandler | null) {
    this.encounterActionHandler = handler;
    return () => {
      if (this.encounterActionHandler === handler) this.encounterActionHandler = null;
    };
  }

  submitEncounterCommand(roomId: string, command: ArpgDungeonCombatCommand) {
    return this.encounterActionHandler?.(roomId, command) ?? Promise.resolve(null);
  }

  onSoundEnabled(listener: SoundEnabledListener) {
    this.soundEnabledListeners.add(listener);
    return () => {
      this.soundEnabledListeners.delete(listener);
    };
  }

  getInput() {
    return this.input;
  }

  setMove(x: number, y: number) {
    this.input.moveX = Math.max(-1, Math.min(1, x));
    this.input.moveY = Math.max(-1, Math.min(1, y));
  }
  setAim(x: number, y: number) {
    const length = Math.hypot(x, y) || 1;
    this.input.aimX = x / length;
    this.input.aimY = y / length;
  }

  setAttack(active: boolean) {
    this.input.attack = active;
  }

  clearGameplayInput() {
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.input.aimX = 0;
    this.input.aimY = 0;
    this.input.attack = false;
    this.dashQueued = false;
    this.interactQueued = false;
    this.weaponSwitchQueued = false;
    this.abilityQueued.fill(false);
  }

  queueDash() {
    this.dashQueued = true;
  }

  queueInteract() {
    this.interactQueued = true;
  }

  queueLootDecision(decision: "equip" | "keep" | "replace-a" | "replace-b") {
    this.lootDecision = decision;
  }

  queueWeaponSwitch() {
    this.weaponSwitchQueued = true;
  }

  queueRoomChoice(choiceId: string) {
    this.roomChoice = choiceId;
  }

  queueAbility(slot: 0 | 1) {
    this.abilityQueued[slot] = true;
  }

  consumeDash() {
    const queued = this.dashQueued;
    this.dashQueued = false;
    return queued;
  }

  consumeInteract() {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  consumeLootDecision() {
    const decision = this.lootDecision;
    this.lootDecision = null;
    return decision;
  }

  consumeWeaponSwitch() {
    const queued = this.weaponSwitchQueued;
    this.weaponSwitchQueued = false;
    return queued;
  }

  consumeRoomChoice() {
    const choice = this.roomChoice;
    this.roomChoice = null;
    return choice;
  }

  consumeAbility(slot: 0 | 1) {
    const queued = this.abilityQueued[slot];
    this.abilityQueued[slot] = false;
    return queued;
  }

  emitHud(state: ArpgHudState) {
    this.hudListeners.forEach((listener) => listener(state));
  }

  emitMessage(message: string) {
    this.messageListeners.forEach((listener) => listener(message));
  }

  emitRunEnd(state: ArpgHudState) {
    this.endListeners.forEach((listener) => listener(state));
  }

  emitRunCheckpoint(state: ArpgRunCheckpointState) {
    this.checkpointListeners.forEach((listener) => listener(state));
  }

  emitVisualEvent(event: ArpgVisualEvent) {
    this.visualEventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        // Presentation subscribers must never interrupt the accepted gameplay state.
        console.error("ARPG visual event listener failed", error);
      }
    });
  }

  onVisualEvent(listener: VisualEventListener) {
    this.visualEventListeners.add(listener);
    return () => this.visualEventListeners.delete(listener);
  }

  onAttackHit(listener: (event: Extract<ArpgVisualEvent, { type: "attack.hit" }>) => void) {
    return this.onVisualEvent((event) => {
      if (event.type === "attack.hit") listener(event);
    });
  }

  onBattleVictory(listener: (event: Extract<ArpgVisualEvent, { type: "battle.finished" }>) => void) {
    return this.onVisualEvent((event) => {
      if (event.type === "battle.finished" && event.outcome === "victory") listener(event);
    });
  }

  onHud(listener: HudListener) {
    this.hudListeners.add(listener);
    return () => this.hudListeners.delete(listener);
  }

  onMessage(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onRunEnd(listener: HudListener) {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  onRunCheckpoint(listener: CheckpointListener) {
    this.checkpointListeners.add(listener);
    return () => this.checkpointListeners.delete(listener);
  }
}
