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
import { AuthoredHealthBar } from '../art/health-bar';
import { AuthoredEffectLayer, authoredPanel } from '../art/runtime-art';
import { FX_ART, WORLD_ART } from '../art/manifest';
import { createInvisibleArcMask } from '../art/invisible-hazard-mask';

export class BossEncounterRuntime {
  readonly lock = new CinematicInputLock();
  private art: BossPresentation | null;
  private effects: AuthoredEffectLayer;
  private arcMasks=new Map<string,ReturnType<typeof createInvisibleArcMask>>();
  private title: GameObjects.Text;
  private titleFrame: GameObjects.NineSlice;
  private healthBar: AuthoredHealthBar;
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
    this.effects = new AuthoredEffectLayer(options.scene,13);
    this.titleFrame = authoredPanel(options.scene,options.scene.cameras.main.width/2,100,"dialogue-frame",Math.min(430,options.scene.cameras.main.width-40),54).setScrollFactor(0).setDepth(99);
    this.healthBar = new AuthoredHealthBar(options.scene,Math.min(330,options.scene.cameras.main.width-64),18,true,bossById(options.snapshot.bossId).phases.slice(1).map(phase=>phase.hpThreshold));
    this.title = options.scene.add.text(options.scene.cameras.main.width / 2, 72, "", {
      fontFamily: "monospace", fontSize: "12px", color: "#2b2117",
      align: "center", padding: { x: 8, y: 4 },
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
    this.titleFrame.setPosition(scene.cameras.main.width/2,intro?118:96).setVisible(snapshot.state!=="INACTIVE");
    this.healthBar.update(scene.cameras.main.width/2,132,snapshot.hp,snapshot.maxHp,snapshot.state==="COMBAT");
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
    const layer = this.effects, { arena, player, scene } = this.options;
    layer.begin();
    const activeMasks=new Set<string>();
    const theme=this.snapshot.bossId==='ancestral-curupira'?8:this.snapshot.bossId==='deep-iara'?16:0;
    for (const [index,h] of this.snapshot.hazards.entries()) {
      const impact = nowMs >= h.impactAtMs;
      const x = arena.left + h.x, y = arena.top + h.y;
      const id=`hazard-${index}-${h.impactAtMs}`;
      const alpha=impact?0.9:0.55+Math.sin(nowMs/140)*0.12;
      if (h.shape === "arc") {
        const sprite=layer.image(id,'fx',theme+(impact?1:0),x,y,h.radius*2,h.radius*2,alpha);
        let mask=this.arcMasks.get(id);
        if(!mask){mask=createInvisibleArcMask(scene);this.arcMasks.set(id,mask);}
        mask.apply(sprite,x,y,h.radius,h.angle,h.arc);
        activeMasks.add(id);
      } else if (h.shape === "circle") { layer.image(id,'fx',theme+(impact?1:0),x,y,h.radius*2,h.radius*2,alpha); }
      else {
        layer.image(id,'fx',theme+(impact?7:6),x,y,h.width,h.height,alpha,h.angle);
      }
    }
    for(const [id,mask] of this.arcMasks)if(!activeMasks.has(id)){mask.destroy();this.arcMasks.delete(id);}
    if (this.snapshot.state === "PURIFICATION") {
      const x=arena.left+this.snapshot.x,y=arena.top+this.snapshot.y;
      const dx=x-player.x,dy=y-player.y;
      layer.image('purification-link','world',WORLD_ART.magicBeam,(x+player.x)/2,(y+player.y)/2,Math.hypot(dx,dy),18,0.75,Math.atan2(dy,dx)).setTint(purificationColor(this.options.legendId));
      layer.image('purification-ring','fx',FX_ART.purificationRing,x,y,220,220,0.65+Math.sin(nowMs/200)*0.15);
    }
    layer.end();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.restoreAttempt++;
    this.art?.destroy(); this.art = null;
    this.effects.destroy(); for(const mask of this.arcMasks.values())mask.destroy();this.arcMasks.clear(); this.title.destroy(); this.titleFrame.destroy(); this.healthBar.destroy(); this.lock.release("boss");
    if (this.cameraDetached) {
      this.options.scene.cameras.main.startFollow(this.options.player, true, 0.16, 0.16);
      this.cameraDetached = false;
    }
  }
}
