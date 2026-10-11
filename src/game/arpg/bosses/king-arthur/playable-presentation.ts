import type { Scene } from "phaser";
import { ARTHUR_WARD_RADIUS, type ArthurOaths } from "./playable-kit";
import {AuthoredEffectLayer} from '../../art/runtime-art';
import {FX_ART} from '../../art/manifest';
export class ArthurWardPresentation {
  private art:AuthoredEffectLayer;
  constructor(scene: Scene) {
    this.art=new AuthoredEffectLayer(scene,12);
    scene.events.once("shutdown", () => this.art.destroy());
  }
  update(memory: ArthurOaths, nowMs: number, player: { x: number; y: number }, offset = { x: 0, y: 0 }) {
    this.art.begin();
    if (memory.ward && nowMs < memory.ward.expiresAtMs) {
      const x = memory.ward.x + offset.x, y = memory.ward.y + offset.y;
      const remaining=memory.ward.expiresAtMs-nowMs;
      const frame=remaining>4550?FX_ART.wardAppear:remaining<450?FX_ART.wardDisappear:Math.floor(nowMs/300)%4===0?FX_ART.wardPulse:FX_ART.wardIdle;
      this.art.image('ward','fx',frame,x,y,ARTHUR_WARD_RADIUS*2,ARTHUR_WARD_RADIUS*2,0.5+Math.sin(nowMs/180)*0.08);
    }
    if (nowMs < memory.lastOathUntilMs)this.art.image('last-oath','fx',FX_ART.purificationRing,player.x,player.y,60,60,0.7);
    this.art.end();
  }
}
