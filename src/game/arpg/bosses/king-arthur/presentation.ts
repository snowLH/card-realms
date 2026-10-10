import type { Scene, GameObjects } from "phaser";
import { arthurPixels } from "./pixel-art";
import type { BossEncounterSnapshot } from "../boss-encounter-controller";
import { introPose } from "../boss-intro-controller";
import { purificationPose, purificationColor } from "../boss-purification-controller";

/** Scene-local presentation only. Simulation, clocks and rewards live elsewhere. */
export class ArthurPresentation {
  private actor: GameObjects.Graphics;
  private scenery: GameObjects.Graphics;
  private effects: GameObjects.Graphics;
  constructor(scene: Scene, private readonly origin: { x: number; y: number }, width: number, height: number) {
    this.actor = scene.add.graphics().setDepth(9);
    this.scenery = scene.add.graphics().setDepth(5);
    this.effects = scene.add.graphics().setDepth(12);
    const g = this.scenery;
    const rect = (x: number, y: number, w: number, h: number, color: number) => { g.fillStyle(color); g.fillRect(origin.x + x, origin.y + y, w, h); };
    rect(32, 32, width - 64, height - 64, 0x343b49);
    for (let y = 32; y < height - 32; y += 64) for (let x = 32; x < width - 32; x += 64) {
      rect(x + 2, y + 2, 60, 60, (x / 64 + y / 64) % 2 ? 0x394151 : 0x3c4350);
      rect(x + 10, y + 50, 18, 2, 0x454c58);
    }
    rect(width / 2 - 100, 190, 200, height - 260, 0x3c465b);
    for (let y = 210; y < height - 85; y += 72) { rect(width / 2 - 94, y, 4, 30, 0x706952); rect(width / 2 + 90, y + 14, 4, 22, 0x706952); }
    // Ruined throne and broken round table kept at the perimeter, never colliders.
    rect(width / 2 - 72, 48, 144, 130, 0x252734);
    rect(width / 2 - 60, 54, 120, 18, 0x8d815e);
    rect(width / 2 - 44, 80, 88, 70, 0x464252);
    rect(width / 2 - 65, 140, 22, 46, 0x9a927b); rect(width / 2 + 43, 140, 22, 46, 0x9a927b);
    rect(width / 2 - 90, 184, 180, 12, 0x716f72);
    for (const x of [92, width - 124]) for (let y = 130; y < height - 110; y += 210) {
      rect(x, y, 34, 72, 0x8a8d97); rect(x + 6, y + 7, 21, 61, 0x485060);
      rect(x + 14, y + 24, 6, 26, 0x272d3b); rect(x - 8, y + 74, 50, 10, 0x69778a);
      rect(x + 50, y + 12, 26, 55, 0x3d5475); rect(x + 58, y + 62, 8, 12, 0x2b374b);
      rect(x + 56, y + 18, 12, 4, 0xad986e);
      rect(x + 36, y + 86, 4, 48, 0x4b4142); rect(x + 31, y + 87, 14, 6, 0x8f9699);
    }
    for (const x of [190, width - 250]) {
      rect(x, 92, 65, 35, 0x4e484d); rect(x + 5, 97, 51, 9, 0xa0916a);
      rect(x + 26, 116, 8, 32, 0x3d3d44);
    }
  }
  update(snapshot: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string) {
    const intro = ["ROOM_ENTERED", "INTRO_LOCK", "AWAKENING"].includes(snapshot.state);
    const restored = ["RESTORED", "UNLOCK", "CLEARED"].includes(snapshot.state);
    const elapsed = nowMs - snapshot.stateAtMs;
    const pose = intro ? introPose(nowMs - snapshot.enteredAtMs, snapshot.seenByAll)
      : snapshot.state === "DEFEATED" ? "kneeling" : snapshot.state === "PURIFICATION" ? purificationPose(elapsed)
        : restored ? "restored" : snapshot.pattern === "old-wound" ? "support" : "ready";
    const g = this.actor;
    g.clear();
    const scale = 2;
    for (const p of arthurPixels(pose, restored || (snapshot.state === "PURIFICATION" && elapsed > 5200), Math.floor(nowMs / 250))) {
      g.fillStyle(p.color); g.fillRect(Math.round(this.origin.x + snapshot.x + (p.x - 32) * scale), Math.round(this.origin.y + snapshot.y + (p.y - 40) * scale), p.width * scale, p.height * scale);
    }
    const fx = this.effects;
    fx.clear();
    if (snapshot.state === "DEFEATED" || snapshot.state === "PURIFICATION") {
      const sx = this.origin.x + snapshot.x + 58, sy = this.origin.y + snapshot.y + 34;
      fx.fillStyle(0xb3b8ae).fillRect(sx, sy, 48, 4);
      fx.fillStyle(0xad986e).fillRect(sx + 35, sy - 6, 4, 16);
    }
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
  destroy() { this.actor.destroy(); this.scenery.destroy(); this.effects.destroy(); }
}
