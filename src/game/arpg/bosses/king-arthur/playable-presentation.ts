import type { Scene, GameObjects } from "phaser";
import { ARTHUR_WARD_RADIUS, type ArthurOaths } from "./playable-kit";
export class ArthurWardPresentation {
  private graphics: GameObjects.Graphics;
  constructor(scene: Scene) {
    this.graphics = scene.add.graphics().setDepth(12);
    scene.events.once("shutdown", () => this.graphics.destroy());
  }
  update(memory: ArthurOaths, nowMs: number, player: { x: number; y: number }, offset = { x: 0, y: 0 }) {
    const g = this.graphics; g.clear();
    if (memory.ward && nowMs < memory.ward.expiresAtMs) {
      const x = memory.ward.x + offset.x, y = memory.ward.y + offset.y;
      g.fillStyle(0x9daec6, 0.06).fillCircle(x, y, ARTHUR_WARD_RADIUS);
      g.lineStyle(3, 0xd2bc82, 0.75).strokeCircle(x, y, ARTHUR_WARD_RADIUS);
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        g.fillStyle(0xc2c9d9).fillRect(Math.round(x + Math.cos(angle) * 168) - 3, Math.round(y + Math.sin(angle) * 168) - 3, 6, 6);
      }
    }
    if (nowMs < memory.lastOathUntilMs) g.lineStyle(3, 0xddd4b2, 0.75).strokeCircle(player.x, player.y, 30);
  }
}
