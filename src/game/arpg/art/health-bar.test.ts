import {describe,expect,it,vi} from "vitest";
import {AuthoredHealthBar} from "./health-bar";
function fixture(){
  const images:Array<{crop:number[];visible:boolean;x:number;y:number;width:number;height:number;destroy:ReturnType<typeof vi.fn<()=>void>>}>=[];
  const create=()=>{
    const image={width:128,height:45,crop:[] as number[],visible:false,x:0,y:0,destroy:vi.fn<()=>void>(),
      setScrollFactor(){return this;},setDepth(){return this;},setOrigin(){return this;},setDisplaySize(){return this;},
      setPosition(x:number,y:number){this.x=x;this.y=y;return this;},setVisible(visible:boolean){this.visible=visible;return this;},
      setCrop(...crop:number[]){this.crop=crop;return this;}};
    images.push(image);return image;
  };
  const scene={textures:{exists:()=>true},add:{image:create,nineslice:create}} as unknown as import("phaser").Scene;
  return {bar:new AuthoredHealthBar(scene,330,18,true),images};
}
describe("authored HP crop",()=>{
  it("clips texture pixels after damage and hides fill at zero without destroying the encounter",()=>{
    const {bar,images}=fixture();
    bar.update(640,132,70,100,true);
    expect(images[1].crop).toEqual([0,0,89,45]);
    expect(images[1].visible).toBe(true);
    bar.update(640,132,0,100,true);
    expect(images[1].visible).toBe(false);
    expect(images[0].visible).toBe(true);
    expect(images.every(image=>image.destroy.mock.calls.length===0)).toBe(true);
  });
  it("keeps the authored phase markers fixed and handles invalid or overhealed HP safely",()=>{
    const {bar,images}=fixture();
    bar.update(640,132,150,100,true);
    expect(images[1].crop[2]).toBe(128);
    expect(images[2].x).toBe(590.5);expect(images[3].x).toBe(706);
    bar.update(640,132,10,0,true);expect(images[1].visible).toBe(false);
    bar.update(640,132,100,100,false);expect(images.every(image=>!image.visible)).toBe(true);
    bar.destroy();expect(images.every(image=>image.destroy.mock.calls.length===1)).toBe(true);
  });
});
