import type { GameObjects, Scene } from 'phaser';
import { ART_ATLASES, DUNGEON_ART, FOLKLARD_ART_MANIFEST, RUNTIME_IMAGE_ART, UI_ART, type UiArtName } from './manifest';

export type ArtPack = keyof typeof ART_ATLASES;
const reported = new Set<string>();
export function queueAuthoredArt(scene:Scene,regionId?:string) {
  for(const [pack,art] of Object.entries(ART_ATLASES)) {
    if(pack==='ui'||scene.textures.exists(art.key)) continue;
    scene.load.spritesheet(art.key,art.path,{frameWidth:art.frameSize,frameHeight:art.frameSize,endFrame:63});
  }
  const missing=FOLKLARD_ART_MANIFEST.missing;
  if(!scene.textures.exists(missing.key)) scene.load.image(missing.key,missing.path);
  const actor=FOLKLARD_ART_MANIFEST.missingActor;
  if(!scene.textures.exists(actor.key))scene.load.spritesheet(actor.key,actor.path,{frameWidth:256,frameHeight:256,endFrame:23});
  const tiles=FOLKLARD_ART_MANIFEST.missingTiles;
  if(!scene.textures.exists(tiles.key))scene.load.spritesheet(tiles.key,tiles.path,{frameWidth:32,frameHeight:32,endFrame:7});
  for(const [key,art] of Object.entries(RUNTIME_IMAGE_ART))if(!scene.textures.exists(key))scene.load.image(key,art.path);
  for(const name of ['panel-dark','panel-parchment','dialogue-frame','tooltip-frame','hp-bar-frame','boss-hp-frame','hp-bar-fill','boss-hp-fill','boss-hp-phase-divider'] as const){
    const key=`folklard-ui-${name}`;
    if(!scene.textures.exists(key))scene.load.image(key,UI_ART[name].path);
  }
  const biome=DUNGEON_ART[regionId as keyof typeof DUNGEON_ART];
  if(biome&&!scene.textures.exists(biome.key)) scene.load.spritesheet(biome.key,biome.path,{frameWidth:32,frameHeight:32,endFrame:7});
}
export function authoredImage(scene:Scene,x:number,y:number,pack:ArtPack,frame:number,width?:number,height=width) {
  const key=ART_ATLASES[pack].key;
  const present=scene.textures.exists(key);
  if(!present&&!reported.has(key)) { reported.add(key);console.error(`Missing authored art: ${key}`); }
  const image=scene.add.image(x,y,present?key:FOLKLARD_ART_MANIFEST.missing.key,present?frame:undefined);
  if(width!==undefined&&height!==undefined) image.setDisplaySize(width,height);
  return image;
}
export function authoredPanel(scene:Scene,x:number,y:number,name:UiArtName,width:number,height:number){
  const key=`folklard-ui-${name}`;
  const present=scene.textures.exists(key);
  if(!present&&!reported.has(key)){reported.add(key);console.error(`Missing authored panel: ${key}`);}
  return scene.add.nineslice(x,y,present?key:FOLKLARD_ART_MANIFEST.missing.key,undefined,width,height,8,8,8,8);
}

/** Reuses sprite objects between frames. No drawing surface and no procedural fallback. */
export class AuthoredEffectLayer {
  private images=new Map<string,GameObjects.Image>();
  private used=new Set<string>();
  constructor(private scene:Scene,private depth=12){}
  begin(){this.used.clear();}
  image(id:string,pack:ArtPack,frame:number,x:number,y:number,width:number,height=width,alpha=1,rotation=0) {
    this.used.add(id);
    let image=this.images.get(id);
    if(!image){image=authoredImage(this.scene,x,y,pack,frame).setDepth(this.depth);this.images.set(id,image);}
    if(this.scene.textures.exists(ART_ATLASES[pack].key)) image.setTexture(ART_ATLASES[pack].key,frame);
    return image.setPosition(Math.round(x),Math.round(y)).setDisplaySize(width,height).setAlpha(alpha).setRotation(rotation).setVisible(true);
  }
  end(){for(const [id,image] of this.images)if(!this.used.has(id)){image.destroy();this.images.delete(id);}}
  destroy(){for(const image of this.images.values())image.destroy();this.images.clear();}
}
