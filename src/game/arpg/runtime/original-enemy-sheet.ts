import type { Scene } from "phaser";
import { getFolklardPixelEnemyFrame, type FolklardPixelEnemyId } from "./folklard-pixel-enemies";

/** Asset-load fallback uses the original drawing, without substituting a hero. */
export function createOriginalPixelEnemySheet(scene: Scene, enemy: FolklardPixelEnemyId, textureKey: string) {
  if (scene.textures.exists(textureKey)) return;
  const frameSize = 256;
  const canvas = document.createElement("canvas");
  canvas.width = frameSize * 4;
  canvas.height = frameSize * 6;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error(`Não foi possível desenhar o inimigo: ${enemy}`);
  context.imageSmoothingEnabled = false;
  for (let row = 0; row < 6; row++) for (let frame = 0; frame < 4; frame++) {
    for (const rect of getFolklardPixelEnemyFrame(enemy, row, frame)) {
      context.fillStyle = rect.color;
      context.fillRect(frame * frameSize + rect.x * 8, row * frameSize + rect.y * 8, rect.width * 8, rect.height * 8);
    }
  }
  const texture = scene.textures.addSpriteSheet(textureKey, canvas as unknown as HTMLImageElement, {
    frameWidth: frameSize, frameHeight: frameSize, endFrame: 23,
  });
  if (!texture || texture.frameTotal !== 25 || !texture.has("23")) {
    if (texture) scene.textures.remove(textureKey);
    throw new Error(`A grade de animações do inimigo ficou incompleta: ${enemy}`);
  }
}
