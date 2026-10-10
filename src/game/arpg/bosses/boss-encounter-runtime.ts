import type { Scene, Physics, GameObjects } from "phaser";
import type { ArpgRuntimeBridge } from "../domain/types";
import { advanceBossEncounter, confirmBossRestoration, damageBossEncounter, voteBossIntroSkip, type BossEncounterSnapshot } from "./boss-encounter-controller";
import { bossById } from "./registry";
import { isBossInputLocked, CinematicInputLock } from "./cinematic-input-lock";
import { createBossPresentation, type BossPresentation } from "./boss-presentations";
import { hasBossCombatStrategy } from "./boss-combat-strategies";
import { insideBossHazard } from "./king-arthur/patterns";
import { purificationPosition, purificationColor, approachPurification } from "./boss-purification-controller";
import type { ArpgAudio } from "../runtime/arpg-audio";

export class BossEncounterRuntime {
  readonly lock = new CinematicInputLock();
  private art: BossPresentation | null;
  private effects: GameObjects.Graphics;
  private title: GameObjects.Text;
  private priorState = "";
  private restoring = false;
  private restoreDeadline = 0;
  private restoreAttempt = 0;
  private destroyed = false;
  private retryAt = 0;
  private cleared = false;
  private originPlayer: { x: number; y: number };
  private cameraDetached = false;
  private lastUpdateMs = 0;
  constructor(private readonly options: {
    scene: Scene; bridge: ArpgRuntimeBridge; actor: Physics.Arcade.Sprite;
    player: Physics.Arcade.Sprite; snapshot: BossEncounterSnapshot;
    arena: { left: number; top: number; width: number; height: number };
    reducedMotion: boolean; legendId: string; audio: ArpgAudio | null;
    damagePlayer: (damage: number, time: number) => void; onCleared: () => void;
    requestSkip?: () => void;
    onPurificationVisualFinished?: () => void;
  }) {
    this.originPlayer = { x: options.player.x, y: options.player.y };
    this.art = createBossPresentation(options.snapshot.bossId, options.scene, { x: options.arena.left, y: options.arena.top }, options.arena.width, options.arena.height);
    this.effects = options.scene.add.graphics().setDepth(13);
    this.title = options.scene.add.text(options.scene.cameras.main.width / 2, 72, "", {
      fontFamily: "monospace", fontSize: "12px", color: "#eadfbf",
      backgroundColor: "#252734", align: "center", padding: { x: 8, y: 4 },
      wordWrap: { width: Math.min(360, options.scene.cameras.main.width - 40) },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    options.scene.events.once("shutdown", () => this.destroy());
  }
  get snapshot() { return this.options.snapshot; }
  get purificationVisualFinished() { return ["RESTORED", "UNLOCK", "CLEARED"].includes(this.snapshot.state); }
  get restorationPersisted() { return this.snapshot.state === "UNLOCK" || this.snapshot.state === "CLEARED"; }
  set snapshot(value: BossEncounterSnapshot) { this.options.snapshot = structuredClone(value); }
  damage(damage: number, time: number) { return damageBossEncounter(this.snapshot, damage, time); }
  skip(time: number) {
    if (this.options.bridge.isServerAuthoritativeCombat()) this.options.requestSkip?.();
    if (!this.options.bridge.isServerAuthoritativeCombat()) voteBossIntroSkip(this.snapshot, "solo", time);
  }
  update(time: number, motionPreference = this.options.reducedMotion) {
    if (this.destroyed) return false;
    this.options.reducedMotion = motionPreference;
    const { scene, actor, player, bridge, arena, reducedMotion, audio } = this.options;
    const authoritative = bridge.isServerAuthoritativeCombat();
    if (!authoritative) advanceBossEncounter(this.snapshot, time, [{ id: "solo", x: player.x - arena.left, y: player.y - arena.top, alive: true }], arena);
    const snapshot = this.snapshot;
    const nowMs = authoritative ? snapshot.serverTimeMs : time;
    const definition = bossById(snapshot.bossId);
    const locked = isBossInputLocked(snapshot.state);
    if (locked) {
      this.lock.acquire("boss", () => { player.setVelocity(0, 0); bridge.clearGameplayInput(); });
      actor.setVelocity(0, 0);
    } else this.lock.release("boss");
    actor.setData("damageEnabled", snapshot.state === "COMBAT");
    actor.setData("hp", snapshot.hp).setData("maxHp", snapshot.maxHp);
    actor.setData("phase", snapshot.phase);
    if (hasBossCombatStrategy(snapshot.bossId) || snapshot.state !== "COMBAT") actor.setPosition(arena.left + snapshot.x, arena.top + snapshot.y);
    else if (!authoritative) { snapshot.x = actor.x - arena.left; snapshot.y = actor.y - arena.top; }
    if (this.art) actor.setVisible(false);
    if (snapshot.state !== this.priorState) {
      audio?.setMusicMode(snapshot.state === "COMBAT" ? "boss" : snapshot.state === "CLEARED" ? "exploration" : snapshot.state === "PURIFICATION" || snapshot.state === "RESTORED" ? "purification" : "intro");
      if (snapshot.state === "COMBAT") bridge.markBossIntroSeen?.(snapshot.bossId);
      if (snapshot.state === "DEFEATED") bridge.emitMessage("A lenda caiu. Sua história ainda pode ser recordada.");
      if (snapshot.state === "RESTORED") {
        this.options.onPurificationVisualFinished?.();
        bridge.emitMessage("Restauração concluída. Salvando progresso…");
      }
      if (snapshot.state === "CLEARED") bridge.emitMessage("LENDA RESTAURADA · " + definition.unlock.label);
      this.priorState = snapshot.state;
    }
    const intro = ["ROOM_ENTERED", "INTRO_LOCK", "AWAKENING"].includes(snapshot.state);
    this.title.setPosition(scene.cameras.main.width / 2, intro ? 92 : 72)
      .setFontSize(intro ? 16 : 12);
    if (intro) {
      if (!this.cameraDetached) { scene.cameras.main.stopFollow(); this.cameraDetached = true; }
      const elapsed = nowMs - snapshot.enteredAtMs;
      const normalized = elapsed / snapshot.introDurationMs * 7000;
      const pan = reducedMotion ? (normalized >= 1500 && normalized < 6800 ? 1 : 0) : Math.max(0, Math.min(1, (normalized - 1200) / 1500)) * Math.max(0, Math.min(1, (7000 - normalized) / 200));
      const targetX = arena.left + snapshot.x, targetY = arena.top + snapshot.y;
      scene.cameras.main.centerOn(this.originPlayer.x + (targetX - this.originPlayer.x) * pan, this.originPlayer.y + (targetY - this.originPlayer.y) * pan);
      this.title.setText(normalized >= 6300 ? definition.corruptedTitle : snapshot.seenByAll ? "Recordação breve • E / Interagir para pular" : "Quando o mundo esquece uma lenda, ela esquece quem era.");
    } else if (this.cameraDetached) {
      scene.cameras.main.startFollow(player, true, 0.16, 0.16); this.cameraDetached = false;
    }
    if (snapshot.state === "COMBAT") this.title.setText(definition.title.split(" — ")[0] + " · " + Math.ceil(snapshot.hp) + "/" + snapshot.maxHp + "\n" + definition.phases[snapshot.phase - 1].title);
    if (snapshot.state === "DEFEATED") this.title.setText("RECORDAÇÃO");
    if (snapshot.state === "PURIFICATION") {
      const elapsed = nowMs - snapshot.stateAtMs;
      const position = purificationPosition({ x: arena.left + snapshot.x, y: arena.top + snapshot.y }, 0, 1);
      if (!authoritative) {
        const next = approachPurification(player, position, Math.min(100, time - this.lastUpdateMs));
        player.setPosition(next.x, next.y);
      }
      this.title.setText(elapsed > 5000 ? definition.purification.dialogue[1] : elapsed > 3400 ? definition.purification.dialogue[0] : "Não viemos destruir as histórias esquecidas.\nViemos fazê-las lembrar.");
    }
    if (snapshot.state === "RESTORED") this.title.setText("LENDA RESTAURADA · " + definition.title);
    this.art?.update(snapshot, nowMs, reducedMotion, this.options.legendId);
    this.drawEffects(nowMs);
    if (!authoritative && snapshot.state === "COMBAT") {
      for (const hazard of snapshot.hazards) if (nowMs >= hazard.impactAtMs && nowMs <= hazard.endsAtMs && insideBossHazard({ x: player.x - arena.left, y: player.y - arena.top }, hazard)) this.options.damagePlayer(hazard.damage, time);
    }
    if (this.restoring && time >= this.restoreDeadline) {
      this.restoreAttempt++; this.restoring = false; this.retryAt = time + 2000;
      bridge.emitMessage("Não foi possível confirmar o desbloqueio. Tentaremos novamente.");
    }
    if (!authoritative && snapshot.state === "RESTORED" && !this.restoring && time >= this.retryAt) {
      this.restoring = true;
      this.restoreDeadline = time + 12000;
      const attempt = ++this.restoreAttempt;
      const current = () => !this.destroyed && attempt === this.restoreAttempt && scene.scene.isActive();
      void Promise.resolve(bridge.persistBossRestoration?.(structuredClone(snapshot))).then((confirmed) => {
        if (!current()) return;
        if (confirmed) confirmBossRestoration(snapshot, snapshot.bossId, true, this.lastUpdateMs);
        else bridge.emitMessage("Não foi possível confirmar o desbloqueio. Tentaremos novamente.");
      }).catch(() => { if (current()) bridge.emitMessage("Não foi possível confirmar o desbloqueio. Tentaremos novamente."); })
        .finally(() => { if (current()) { this.restoring = false; this.retryAt = this.lastUpdateMs + 2000; } });
    }
    if (snapshot.state === "CLEARED" && !this.cleared) { this.cleared = true; this.options.onCleared(); }
    this.lastUpdateMs = time;
    return locked;
  }
  private drawEffects(nowMs: number) {
    const g = this.effects, { arena, player } = this.options;
    g.clear();
    for (const h of this.snapshot.hazards) {
      const impact = nowMs >= h.impactAtMs;
      g.lineStyle(3, 0xe2d599, 0.95); g.fillStyle(impact ? 0xe5e0c6 : 0xaba3c2, impact ? 0.45 : 0.18);
      const x = arena.left + h.x, y = arena.top + h.y;
      if (h.shape === "arc") {
        g.slice(x, y, h.radius, h.angle - h.arc / 2, h.angle + h.arc / 2, false); g.fillPath(); g.strokePath();
      } else if (h.shape === "circle") { g.fillCircle(x, y, h.radius); g.strokeCircle(x, y, h.radius); }
      else {
        g.save(); g.translateCanvas(x, y); g.rotateCanvas(h.angle);
        g.fillRect(-h.width / 2, -h.height / 2, h.width, h.height); g.strokeRect(-h.width / 2, -h.height / 2, h.width, h.height); g.restore();
      }
    }
    if (this.snapshot.state === "PURIFICATION") {
      g.lineStyle(4, purificationColor(this.options.legendId), 0.85);
      g.lineBetween(player.x, player.y, arena.left + this.snapshot.x, arena.top + this.snapshot.y);
      g.strokeCircle(arena.left + this.snapshot.x, arena.top + this.snapshot.y, 110);
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.restoreAttempt++;
    this.art?.destroy(); this.art = null;
    this.effects.destroy(); this.title.destroy(); this.lock.release("boss");
    if (this.cameraDetached) {
      this.options.scene.cameras.main.startFollow(this.options.player, true, 0.16, 0.16);
      this.cameraDetached = false;
    }
  }
}
