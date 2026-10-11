import type {Scene} from 'phaser';
import {FOLKLARD_ART_MANIFEST} from '../art/manifest';
import type {FolklardPixelEnemyId} from './folklard-pixel-enemies';
export function createOriginalPixelEnemySheet(scene:Scene,enemy:FolklardPixelEnemyId,textureKey:string){
  if(scene.textures.exists(textureKey))return;
  console.error('Missing authored enemy image: '+enemy);
  const image=scene.textures.get(FOLKLARD_ART_MANIFEST.missingActor.key).getSourceImage();
  scene.textures.addSpriteSheet(textureKey,image as HTMLImageElement,{frameWidth:256,frameHeight:256,endFrame:23});
}
