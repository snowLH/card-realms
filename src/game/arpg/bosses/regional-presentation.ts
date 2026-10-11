import { purificationParticleFrame } from "../art/combat-effects";
import type { GameObjects, Scene } from "phaser";
import { purificationColor } from "./boss-purification-controller";
import type { BossEncounterSnapshot } from "./boss-encounter-controller";
import { REGIONAL_BOSS_ART, regionalBossArtFrame, type RegionalForgottenLegendId } from "./regional-art";
import { AuthoredEffectLayer } from '../art/runtime-art';
import { PROP_ART, FX_ART } from '../art/manifest';

export class RegionalForgottenLegendPresentation {
  private readonly actor: GameObjects.Sprite;
  private readonly effects: AuthoredEffectLayer;

  constructor(
    scene: Scene,
    private readonly bossId: RegionalForgottenLegendId,
    private readonly origin: { x: number; y: number },
    width: number,
  ) {
    const art = REGIONAL_BOSS_ART[bossId];
    this.actor = scene.add.sprite(origin.x + width / 2, origin.y + 150, art.key, 0)
      .setOrigin(0.5, 0.66)
      .setScale(0.72)
      .setDepth(9)
      .setTint(art.corruptionTint);
    this.effects = new AuthoredEffectLayer(scene,12);
  }

  update(encounter: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string) {
    const frame = regionalBossArtFrame(encounter, nowMs);
    if (!frame) return;
    this.actor
      .setTexture(frame.key, frame.frame)
      .setPosition(Math.round(this.origin.x + encounter.x), Math.round(this.origin.y + encounter.y));
    if (frame.restored) this.actor.clearTint();
    else this.actor.setTint(frame.corruptionTint);

    const fx = this.effects;
    fx.begin();
    fx.image("shadow","props",PROP_ART.shadowBoss,this.origin.x+encounter.x,this.origin.y+encounter.y+10,100,28,0.6).setDepth(4);
    if (!frame.restored) {
      const count = reducedMotion ? 5 : 14;
      for (let index = 0; index < count; index += 1) {
        const drift = reducedMotion ? index * 11 : (nowMs / 38 + index * 19) % 130;
        const angle = index * 1.7;
        const color = encounter.state === "PURIFICATION" ? purificationColor(legendId) : frame.corruptionTint;
        fx.image(`fragment-${index}`,'fx',encounter.state==='PURIFICATION'?purificationParticleFrame(legendId):FX_ART.corruptionFragment,
          Math.round(this.origin.x + encounter.x + Math.cos(angle) * (38 + drift / 3)),
          Math.round(this.origin.y + encounter.y - 18 - drift),
          10,10,encounter.state==='PURIFICATION'?0.78:0.48).setTint(color);
      }
    }
    if (encounter.state === "PURIFICATION") {
      fx.image('purification-ring','fx',FX_ART.purificationRing,this.origin.x+encounter.x,this.origin.y+encounter.y,176,176,0.72).setTint(purificationColor(legendId));
    }
    fx.end();
  }

  destroy() {
    this.actor.destroy();
    this.effects.destroy();
  }
}
