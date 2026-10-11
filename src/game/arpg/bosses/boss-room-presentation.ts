import type { GameObjects, Scene } from "phaser";
import { BOSS_ROOM_ART, type BossRoomArtDefinition } from "./boss-room-art";

/** Owned by the world, not the encounter. Restoration never deletes the floor. */
export class BossRoomPresentation {
  private readonly background: GameObjects.Image;
  private readonly images: GameObjects.Image[];
  private restored = false;

  constructor(scene: Scene, art: BossRoomArtDefinition, origin: { x: number; y: number }) {
    this.background = scene.add.image(origin.x, origin.y, art.background.key)
      .setOrigin(0).setDisplaySize(art.width, art.height).setDepth(0.8).setTint(art.corruptionTint);
    this.images = [this.background];
    if (art.foreground) this.images.push(scene.add.image(origin.x, origin.y, art.foreground.key)
      .setOrigin(0).setDisplaySize(art.width, art.height).setDepth(10));
    for (const prop of art.props ?? []) this.images.push(scene.add.image(origin.x + prop.x, origin.y + prop.y, prop.key).setDepth(prop.depth));
    scene.events.once("shutdown", () => this.destroy());
  }
  restore() {
    if (this.restored) return;
    this.restored = true;
    // Returning the authored palette restores the green canopy, clear water
    // and surviving Camelot gold; cracks and ruins remain in the artwork.
    this.background.clearTint();
  }
  destroy() { for (const image of this.images.splice(0)) image.destroy(); }
}

export function createBossRoomPresentation(scene: Scene, id: string, origin: { x: number; y: number }) {
  const art = BOSS_ROOM_ART[id];
  if (!art || !scene.textures.exists(art.background.key)) return null;
  return new BossRoomPresentation(scene, art, origin);
}
