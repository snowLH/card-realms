import {describe,expect,it,vi,afterEach} from "vitest";
import {createWeaponRuntimeTextures,WEAPON_RUNTIME_TEXTURE_KEYS} from "./weapon-runtime-textures";
import {FOLKLARD_ART_MANIFEST} from '../art/manifest';
import {ARPG_ASSET_MANIFEST} from '../assets';
afterEach(()=>vi.restoreAllMocks());
describe("authored projectile textures",()=>{
  it("reports a missing image instead of creating a drawing surface",()=>{
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    const image={} as HTMLImageElement;
    const add=vi.fn();
    const addImage=vi.fn(()=>({add}));
    createWeaponRuntimeTextures({textures:{exists:(key:string)=>key===FOLKLARD_ART_MANIFEST.missing.key,get:()=>({getSourceImage:()=>image,get:()=>({width:64,height:64})}),addImage}} as unknown as import("phaser").Scene);
    expect(error).toHaveBeenCalledTimes(WEAPON_RUNTIME_TEXTURE_KEYS.length+1);
    expect(addImage).toHaveBeenCalledWith(ARPG_ASSET_MANIFEST.weapons.bennyboiHack.textureKey,image);
    expect(add).toHaveBeenCalledWith(69,0,0,0,64,64);
  });
  it("reuses preloaded images",()=>{
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    createWeaponRuntimeTextures({textures:{exists:()=>true}} as unknown as import("phaser").Scene);
    expect(error).not.toHaveBeenCalled();
  });
});
