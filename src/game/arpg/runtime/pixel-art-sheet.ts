import type{Scene}from'phaser';
import type{ArpgSpriteSheetDefinition}from'../assets';
import {FOLKLARD_ART_MANIFEST} from '../art/manifest';
export function getPixelArtTextureKey(textureKey:string){return textureKey+'-folklard-pixel';}
/** Registers the original authored image; appearance is never recolored or outlined. */
export function createPixelArtSpriteSheet(
  scene: Scene,
  definition: Pick<ArpgSpriteSheetDefinition, "textureKey" | "frameWidth" | "frameHeight" | "frameCount" | "scale">
    & Pick<Partial<ArpgSpriteSheetDefinition>, "columns" | "rows">,
) {
  const key=getPixelArtTextureKey(definition.textureKey);
  if(scene.textures.exists(key))return key;
  if(!scene.textures.exists(definition.textureKey)){
    console.error('Missing authored actor: '+definition.textureKey);
    return FOLKLARD_ART_MANIFEST.missingActor.key;
  }
  const texture=scene.textures.get(definition.textureKey);
  if(!texture)throw new Error('Missing authored actor: '+definition.textureKey);
  const result=scene.textures.addSpriteSheet(key,texture.getSourceImage() as HTMLImageElement,{frameWidth:definition.frameWidth,frameHeight:definition.frameHeight,endFrame:definition.frameCount-1});
  if(!result)throw new Error('Could not register authored actor: '+key);
  return key;
}
