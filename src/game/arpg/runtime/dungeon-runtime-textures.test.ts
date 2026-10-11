import {describe,expect,it,vi,afterEach} from "vitest";
import {createDungeonRuntimeTextures} from './dungeon-runtime-textures';
import {LEGACY_IMAGE_ART,FOLKLARD_ART_MANIFEST} from '../art/manifest';
afterEach(()=>vi.restoreAllMocks());
describe("authored dungeon textures",()=>{
  it("reports a missing image instead of creating a drawing surface",()=>{
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    const image={} as HTMLImageElement;
    const add=vi.fn();
    const addImage=vi.fn(()=>({add}));
    createDungeonRuntimeTextures({textures:{exists:(key:string)=>key===FOLKLARD_ART_MANIFEST.missing.key,get:()=>({getSourceImage:()=>image,get:()=>({width:64,height:64})}),addImage}} as unknown as import("phaser").Scene);
    expect(error).toHaveBeenCalledTimes(Object.keys(LEGACY_IMAGE_ART).length);
    expect(addImage).toHaveBeenCalledTimes(Object.keys(LEGACY_IMAGE_ART).length);
    expect(addImage).toHaveBeenCalledWith('arpg-projectile',image);
    expect(add).toHaveBeenCalledWith(0,0,0,0,64,64);
  });
  it("reuses preloaded images",()=>{
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    createDungeonRuntimeTextures({textures:{exists:()=>true}} as unknown as import("phaser").Scene);
    expect(error).not.toHaveBeenCalled();
  });
});
