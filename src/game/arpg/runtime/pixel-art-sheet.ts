import type { Scene } from "phaser";
import type { ArpgSpriteSheetDefinition } from "../assets";

const PIXEL_TEXTURE_SUFFIX = "-folklard-pixel";

export function getPixelArtTextureKey(textureKey: string) {
  return `${textureKey}${PIXEL_TEXTURE_SUFFIX}`;
}

/**
 * Reduces painted character sheets to crisp, low-resolution pixel clusters while
 * keeping the original frame grid so the existing animation and hitbox data fit.
 */
export function createPixelArtSpriteSheet(
  scene: Scene,
  definition: Pick<ArpgSpriteSheetDefinition, "textureKey" | "frameWidth" | "frameHeight" | "frameCount" | "scale">
    & Pick<Partial<ArpgSpriteSheetDefinition>, "columns" | "rows">,
) {
  const pixelTextureKey = getPixelArtTextureKey(definition.textureKey);
  if (scene.textures.exists(pixelTextureKey)) {
    const cachedTexture = scene.textures.get(pixelTextureKey);
    if (cachedTexture.frameTotal === definition.frameCount + 1 && cachedTexture.has(String(definition.frameCount - 1))) {
      return pixelTextureKey;
    }
    scene.textures.remove(pixelTextureKey);
  }

  const sourceTexture = scene.textures.get(definition.textureKey);
  const source = sourceTexture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const columns = definition.columns ?? 1;
  const rows = definition.rows ?? Math.ceil(definition.frameCount / columns);
  const outputWidth = definition.frameWidth * columns;
  const outputHeight = definition.frameHeight * rows;
  const sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = outputWidth;
  sheetCanvas.height = outputHeight;
  const sheetContext = sheetCanvas.getContext("2d", { alpha: true });
  if (!sheetContext) throw new Error(`Não foi possível criar o sprite pixelado: ${definition.textureKey}`);

  const displayedFrameSize = Math.min(definition.frameWidth, definition.frameHeight) * definition.scale;
  const pixelWidth = Math.max(18, Math.round(displayedFrameSize / 2));
  const pixelHeight = Math.max(18, Math.round(displayedFrameSize / 2));
  const pixelCanvas = document.createElement("canvas");
  pixelCanvas.width = pixelWidth;
  pixelCanvas.height = pixelHeight;
  const pixelContext = pixelCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!pixelContext) throw new Error(`Não foi possível criar a paleta pixelada: ${definition.textureKey}`);

  sheetContext.imageSmoothingEnabled = false;
  for (let frame = 0; frame < definition.frameCount; frame += 1) {
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    pixelContext.clearRect(0, 0, pixelWidth, pixelHeight);
    pixelContext.imageSmoothingEnabled = true;
    pixelContext.drawImage(
      source,
      column * definition.frameWidth,
      row * definition.frameHeight,
      definition.frameWidth,
      definition.frameHeight,
      0,
      0,
      pixelWidth,
      pixelHeight,
    );

    const pixels = pixelContext.getImageData(0, 0, pixelWidth, pixelHeight);
    const colors = pixels.data;
    const opaque = new Uint8Array(pixelWidth * pixelHeight);
    for (let index = 0; index < pixelWidth * pixelHeight; index += 1) {
      const offset = index * 4;
      if (colors[offset + 3] < 96) {
        colors[offset + 3] = 0;
        continue;
      }

      opaque[index] = 1;
      colors[offset + 3] = 255;
      // A small 4-level channel palette removes the painted gradients and glow noise.
      colors[offset] = Math.round(colors[offset] / 85) * 85;
      colors[offset + 1] = Math.round(colors[offset + 1] / 85) * 85;
      colors[offset + 2] = Math.round(colors[offset + 2] / 85) * 85;
    }

    const outlined = new Uint8ClampedArray(colors);
    for (let y = 0; y < pixelHeight; y += 1) {
      for (let x = 0; x < pixelWidth; x += 1) {
        const index = y * pixelWidth + x;
        if (!opaque[index]) continue;
        const touchesClear = x === 0
          || y === 0
          || x === pixelWidth - 1
          || y === pixelHeight - 1
          || !opaque[index - 1]
          || !opaque[index + 1]
          || !opaque[index - pixelWidth]
          || !opaque[index + pixelWidth];
        if (!touchesClear) continue;
        const offset = index * 4;
        outlined[offset] = Math.round(outlined[offset] * 0.36);
        outlined[offset + 1] = Math.round(outlined[offset + 1] * 0.36);
        outlined[offset + 2] = Math.round(outlined[offset + 2] * 0.36);
      }
    }
    pixels.data.set(outlined);
    pixelContext.putImageData(pixels, 0, 0);

    const destinationX = column * definition.frameWidth;
    const destinationY = row * definition.frameHeight;
    sheetContext.drawImage(
      pixelCanvas,
      0,
      0,
      pixelWidth,
      pixelHeight,
      destinationX,
      destinationY,
      definition.frameWidth,
      definition.frameHeight,
    );
  }

  const pixelTexture = scene.textures.addSpriteSheet(pixelTextureKey, sheetCanvas as unknown as HTMLImageElement, {
    frameWidth: definition.frameWidth,
    frameHeight: definition.frameHeight,
    endFrame: definition.frameCount - 1,
  });
  if (!pixelTexture) throw new Error(`Não foi possível registrar a textura pixelada: ${pixelTextureKey}`);
  if (pixelTexture.frameTotal !== definition.frameCount + 1 || !pixelTexture.has(String(definition.frameCount - 1))) {
    scene.textures.remove(pixelTextureKey);
    throw new Error(`A grade de quadros da textura pixelada ficou incompleta: ${pixelTextureKey}`);
  }
  return pixelTextureKey;
}
