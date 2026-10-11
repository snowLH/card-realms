import type { Scene } from "phaser";
import { authoredPanel } from "./runtime-art";
import { FOLKLARD_ART_MANIFEST } from "./manifest";

/** Crop authored pixels; neither fill nor frame is painted by the engine. */
export class AuthoredHealthBar {
  private readonly frame;
  private readonly fill;
  private readonly dividers;
  constructor(scene: Scene, private readonly width: number, height: number, boss = false, thresholds:readonly number[]=[0.35,0.7]) {
    this.frame = authoredPanel(scene, 0, 0, boss ? "boss-hp-frame" : "hp-bar-frame", width, height)
      .setScrollFactor(0).setDepth(102);
    const key = `folklard-ui-${boss ? "boss-hp-fill" : "hp-bar-fill"}`;
    const present = scene.textures.exists(key);
    if (!present) console.error(`Missing authored health bar: ${key}`);
    this.fill = scene.add.image(0, 0, present ? key : FOLKLARD_ART_MANIFEST.missing.key)
      .setOrigin(0, 0.5).setDisplaySize(width - 16, height - 6).setScrollFactor(0).setDepth(101);
    const dividerKey="folklard-ui-boss-hp-phase-divider";
    const dividerPresent=scene.textures.exists(dividerKey);
    if(boss&&!dividerPresent)console.error(`Missing authored phase divider: ${dividerKey}`);
    this.dividers = boss ? thresholds.map((threshold)=>({threshold,image:scene.add.image(0,0,dividerPresent?dividerKey:FOLKLARD_ART_MANIFEST.missing.key).setDisplaySize(5,height).setScrollFactor(0).setDepth(103)})) : [];
  }
  update(x: number, y: number, hp: number, maxHp: number, visible: boolean) {
    const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.frame.setPosition(x, y).setVisible(visible);
    this.fill.setPosition(x - this.width / 2 + 8, y)
      .setCrop(0, 0, Math.floor(this.fill.width * fraction), this.fill.height)
      .setVisible(visible && fraction > 0);
    for(const divider of this.dividers)divider.image.setPosition(x-this.width/2+this.width*divider.threshold,y).setVisible(visible);
  }
  destroy() { this.frame.destroy(); this.fill.destroy(); for(const {image} of this.dividers)image.destroy(); }
}
