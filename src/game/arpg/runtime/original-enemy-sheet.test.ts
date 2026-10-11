import type {Scene} from "phaser";
import {describe,expect,it,vi,afterEach} from "vitest";
import {FOLKLARD_ART_MANIFEST} from "../art/manifest";
import {FOLKLARD_PIXEL_ENEMIES} from "./folklard-pixel-enemies";
import {createOriginalPixelEnemySheet} from "./original-enemy-sheet";
afterEach(()=>vi.restoreAllMocks());
describe("authored image fallback",()=>{
  it.each(FOLKLARD_PIXEL_ENEMIES)("uses the shared placeholder image when %s fails",enemy=>{
    const image={} as HTMLImageElement;
    const get=vi.fn(()=>({getSourceImage:()=>image}));
    const addSpriteSheet=vi.fn();
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    const scene={textures:{exists:()=>false,get,addSpriteSheet}} as unknown as Scene;
    createOriginalPixelEnemySheet(scene,enemy,"missing-enemy");
    expect(error).toHaveBeenCalledWith("Missing authored enemy image: "+enemy);
    expect(get).toHaveBeenCalledWith(FOLKLARD_ART_MANIFEST.missingActor.key);
    expect(addSpriteSheet).toHaveBeenCalledWith("missing-enemy",image,{frameWidth:256,frameHeight:256,endFrame:23});
  });
  it("keeps an already loaded actor intact",()=>{
    const get=vi.fn();
    createOriginalPixelEnemySheet({textures:{exists:()=>true,get}} as unknown as Scene,FOLKLARD_PIXEL_ENEMIES[0],"present");
    expect(get).not.toHaveBeenCalled();
  });
});
