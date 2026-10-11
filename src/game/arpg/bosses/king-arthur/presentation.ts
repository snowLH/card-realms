import { purificationParticleFrame } from "../../art/combat-effects";
import type { Scene, GameObjects } from "phaser";
import { ARTHUR_CHARACTER_ART, arthurArtFrame } from "./art";
import type { BossEncounterSnapshot } from "../boss-encounter-controller";
import { purificationColor } from "../boss-purification-controller";
import { AuthoredEffectLayer } from '../../art/runtime-art';
import { PROP_ART, FX_ART, WORLD_ART } from '../../art/manifest';

/** Scene-local presentation only. Simulation, clocks and rewards live elsewhere. */
export class ArthurPresentation {
  private actor: GameObjects.Sprite;
  private effects: AuthoredEffectLayer;
  constructor(scene: Scene, private readonly origin: { x: number; y: number }, width: number) {
    this.actor = scene.add.sprite(origin.x + width / 2, origin.y + 144, ARTHUR_CHARACTER_ART.corrupted.key, 0).setOrigin(0.5, 0.6875).setScale(0.75).setDepth(9);
    this.effects = new AuthoredEffectLayer(scene,12);
  }
  update(snapshot: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string) {
    const restored = ["RESTORED", "UNLOCK", "CLEARED"].includes(snapshot.state);
    const art = arthurArtFrame(snapshot, nowMs);
    this.actor.setTexture(art.key, art.frame).setPosition(Math.round(this.origin.x + snapshot.x), Math.round(this.origin.y + snapshot.y));
    const fx = this.effects;
    fx.begin();
    fx.image("shadow","props",PROP_ART.shadowBoss,this.origin.x+snapshot.x,this.origin.y+snapshot.y+10,100,28,0.6).setDepth(4);
    if (snapshot.pattern === "last-oath" && snapshot.state === "COMBAT" && snapshot.hazards.length > 0) {
      fx.image('last-oath-atmosphere','world',WORLD_ART.smokeOverlay,this.origin.x+976,this.origin.y+496,1888,928,0.25);
    }
    if (!restored) {
      const count = reducedMotion ? 4 : 12;
      for (let i = 0; i < count; i++) {
        const phase = reducedMotion ? i * 9 : (nowMs / 30 + i * 17) % 120;
        fx.image(`fragment-${i}`,'fx',snapshot.state==='PURIFICATION'?purificationParticleFrame(legendId):FX_ART.corruptionFragment,this.origin.x+snapshot.x+Math.sin(i*4)*(40+phase/3),this.origin.y+snapshot.y-phase,10,10,0.7).setTint(snapshot.state==='PURIFICATION'?purificationColor(legendId):0xa09bb5);
      }
    }
    if (snapshot.phase >= 2 && snapshot.state === "COMBAT") {
      for (let i = 0; i < 6; i++) {
        const x = this.origin.x + 200 + i * 250;
        fx.image(`memory-${i}`,'fx',FX_ART.memoryKnight,x,this.origin.y+330+(i%2)*260,70,88,0.18);
      }
    }
    fx.end();
  }
  destroy() { this.actor.destroy(); this.effects.destroy(); }
}
