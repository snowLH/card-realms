import type { GameObjects } from "phaser";

/** Do not restart the idle cycle each update; that would freeze it on frame zero. */
export function playActorIdle(sprite: GameObjects.Sprite, key: string, firstFrame = 0, reducedMotion = false) {
  if (reducedMotion) {
    sprite.anims.stop();
    sprite.setFrame(firstFrame);
  } else if (sprite.anims.currentAnim?.key !== key || !sprite.anims.isPlaying) {
    sprite.play(key);
  }
}
