import type {WeaponVisualDefinition} from './weapon-visuals';
import {ARPG_ASSET_MANIFEST} from '../assets';
import {ensureAuthoredImageTexture} from '../art/missing-texture';
export const WEAPON_RUNTIME_TEXTURE_KEYS=['arpg-weapon-projectile-arrow','arpg-weapon-projectile-focus'] as const;
export function createWeaponRuntimeTextures(scene:import('phaser').Scene){
  for(const key of WEAPON_RUNTIME_TEXTURE_KEYS)ensureAuthoredImageTexture(scene,key);
  const weapons=ARPG_ASSET_MANIFEST.weapons.bennyboiHack;
  ensureAuthoredImageTexture(scene,weapons.textureKey,weapons.frameCount);
}
export function getWeaponRuntimeTextureKey(visual:WeaponVisualDefinition){return visual.textureKey;}
