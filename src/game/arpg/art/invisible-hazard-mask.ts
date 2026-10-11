import type { Scene, GameObjects } from 'phaser';

/** Technical mask only: never added to the display list, never visible as art. */
export function createInvisibleArcMask(scene:Scene) {
  const geometry=scene.make.graphics({x:0,y:0},false);
  geometry.setVisible(false);
  const mask=geometry.createGeometryMask();
  return {
    apply(image:GameObjects.Image,x:number,y:number,radius:number,angle:number,arc:number){
      geometry.clear().fillStyle(0xffffff,1);
      geometry.slice(x,y,radius,angle-arc/2,angle+arc/2,false).fillPath();
      image.setMask(mask);
    },
    destroy(){mask.destroy();geometry.destroy();},
  };
}
