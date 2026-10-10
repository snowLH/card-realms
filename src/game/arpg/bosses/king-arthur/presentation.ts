import type { Scene, GameObjects } from "phaser";
import { ARTHUR_CHARACTER_ART, arthurArtFrame } from "./art";
import type { BossEncounterSnapshot } from "../boss-encounter-controller";
import { purificationColor } from "../boss-purification-controller";

/** Scene-local presentation only. Simulation, clocks and rewards live elsewhere. */
export class ArthurPresentation {
  private actor: GameObjects.Sprite;
  private effects: GameObjects.Graphics;
  constructor(scene: Scene, private readonly origin: { x: number; y: number }, width: number) {
    this.actor = scene.add.sprite(origin.x + width / 2, origin.y + 144, ARTHUR_CHARACTER_ART.corrupted.key, 0).setOrigin(0.5, 0.6875).setScale(0.75).setDepth(9);
    this.effects = scene.add.graphics().setDepth(12);
  }
  update(snapshot: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string) {
    const restored = ["RESTORED", "UNLOCK", "CLEARED"].includes(snapshot.state);
    const art = arthurArtFrame(snapshot, nowMs);
    this.actor.setTexture(art.key, art.frame).setPosition(Math.round(this.origin.x + snapshot.x), Math.round(this.origin.y + snapshot.y));
    const fx = this.effects;
    fx.clear();
    if (snapshot.pattern === "last-oath" && snapshot.state === "COMBAT" && snapshot.hazards.length > 0) {
      fx.fillStyle(0x181d30, 0.25).fillRect(this.origin.x + 32, this.origin.y + 32, 1888, 928);
    }
    if (!restored) {
      const count = reducedMotion ? 4 : 12;
      for (let i = 0; i < count; i++) {
        const phase = reducedMotion ? i * 9 : (nowMs / 30 + i * 17) % 120;
        fx.fillStyle(snapshot.state === "PURIFICATION" ? purificationColor(legendId) : 0xa09bb5, 0.7);
        fx.fillRect(Math.round(this.origin.x + snapshot.x + Math.sin(i * 4) * (40 + phase / 3)), Math.round(this.origin.y + snapshot.y - phase), 4, 4);
      }
    }
    if (snapshot.phase >= 2 && snapshot.state === "COMBAT") {
      fx.fillStyle(0xc7cedb, 0.12);
      for (let i = 0; i < 6; i++) {
        const x = this.origin.x + 200 + i * 250;
        fx.fillRect(x, this.origin.y + 330 + (i % 2) * 260, 14, 28);
        fx.fillRect(x + 14, this.origin.y + 334 + (i % 2) * 260, 36, 4);
      }
    }
  }
  destroy() { this.actor.destroy(); this.effects.destroy(); }
}
