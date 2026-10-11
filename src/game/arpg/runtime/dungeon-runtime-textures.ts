import {LEGACY_IMAGE_ART} from '../art/manifest';
import {ensureAuthoredImageTexture} from '../art/missing-texture';
/** All former runtime textures are preloaded authored images. Never draw a fallback. */
export function createDungeonRuntimeTextures(scene:import('phaser').Scene){
  for(const key of Object.keys(LEGACY_IMAGE_ART))ensureAuthoredImageTexture(scene,key);
}
