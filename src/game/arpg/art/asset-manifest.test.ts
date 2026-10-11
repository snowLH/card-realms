import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import sharp from "sharp";
import {describe,expect,it} from "vitest";
import {ART_ATLASES,DUNGEON_ART,FOLKLARD_ART_MANIFEST,UI_ART,PROP_IMAGE_ART,WORLD_IMAGE_ART,REFUGE_ART,LEGACY_IMAGE_ART} from "./manifest";
import {ARPG_ASSET_PATHS} from "../assets";
const file=(path:string)=>resolve(process.cwd(),"public",path.slice(1));
describe("authored asset pipeline",()=>{
  it("ships every dynamic UI, prop, world, refuge and compatibility path",()=>{
    const paths=[...Object.values(UI_ART).map(art=>art.path),...Object.values(PROP_IMAGE_ART).map(art=>art.path),...WORLD_IMAGE_ART.map(art=>art.path),...Object.values(REFUGE_ART),FOLKLARD_ART_MANIFEST.missing.path,FOLKLARD_ART_MANIFEST.missingActor.path,...Object.keys(LEGACY_IMAGE_ART).map(id=>`/art/authored/runtime/${id}.webp`)];
    for(const path of paths)expect(existsSync(file(path)),path).toBe(true);
    for(const path of Object.values(REFUGE_ART))expect(ARPG_ASSET_PATHS).toContain(path);
    expect(new Set(ARPG_ASSET_PATHS).size).toBe(ARPG_ASSET_PATHS.length);
  });
  it("keeps all 64 atlas cells and eight biome tiles in their declared dimensions",async()=>{
    for(const art of Object.values(ART_ATLASES)){
      const {data,info}=await sharp(file(art.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      expect(info.width).toBe(art.frameSize*8);expect(info.height).toBe(art.frameSize*8);
      for(let frame=0;frame<64;frame++){
        const left=frame%8*art.frameSize,top=Math.floor(frame/8)*art.frameSize;
        let hasVisiblePixel=false;
        for(let y=top;y<top+art.frameSize&&!hasVisiblePixel;y++){
          for(let x=left;x<left+art.frameSize;x++){
            if(data[(y*info.width+x)*info.channels+3]>100){hasVisiblePixel=true;break;}
          }
        }
        expect(hasVisiblePixel,`${art.key}:${frame}`).toBe(true);
      }
    }
    for(const art of Object.values(DUNGEON_ART))expect(await sharp(file(art.path)).metadata()).toMatchObject({width:256,height:32});
    expect(await sharp(file(FOLKLARD_ART_MANIFEST.missingActor.path)).metadata()).toMatchObject({width:1024,height:1536});
    expect(await sharp(file(FOLKLARD_ART_MANIFEST.missingTiles.path)).metadata()).toMatchObject({width:256,height:32});
  });
  it("exports CSS paths from the same central UI/prop manifest",()=>{
    const css=readFileSync(resolve(process.cwd(),"src/app/authored-art.css"),"utf8");
    for(const [name,art] of Object.entries(UI_ART))expect(css).toContain(`--art-${name}:url("${art.path}")`);
    for(const [name,art] of Object.entries(PROP_IMAGE_ART))expect(css).toContain(`--art-prop-${name}:url("${art.path}")`);
  });
});
