import type { Scene } from "phaser";
import { FOLKLARD_ART_MANIFEST } from "./manifest";

/** Preserve existing image keys/frame selectors when a packaged asset fails to load. */
export function ensureAuthoredImageTexture(scene: Scene, key: string, frameCount = 1) {
  if (scene.textures.exists(key)) return;
  console.error(`Missing authored image: ${key}`);
  const fallbackKey = FOLKLARD_ART_MANIFEST.missing.key;
  if (!scene.textures.exists(fallbackKey)) throw new Error("Authored image placeholder failed to load");
  const fallback = scene.textures.get(fallbackKey);
  const frame = fallback.get();
  const texture = scene.textures.addImage(key, fallback.getSourceImage() as HTMLImageElement);
  if (!texture) throw new Error(`Could not register authored placeholder: ${key}`);
  for (let index = 0; index < frameCount; index++) texture.add(index, 0, 0, 0, frame.width, frame.height);
}
