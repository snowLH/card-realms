import {resolve} from "node:path";
import sharp from "sharp";
import {describe,expect,it} from "vitest";
import {getAuthoredDungeonTiles} from "./dungeon-floor-tiles";
describe("authored biome tiles",()=>{
  it.each(["mata-encantada","arquipelago-das-mares","montanhas-runicas"])("loads eight distinct authored 32px tiles for %s",async region=>{
    const art=getAuthoredDungeonTiles(region);
    const image=sharp(resolve(process.cwd(),"public"+art.path));
    expect(await image.metadata()).toMatchObject({width:256,height:32,format:"webp"});
    const tiles=await Promise.all(Array.from({length:8},(_,i)=>image.clone().extract({left:i*32,top:0,width:32,height:32}).raw().toBuffer()));
    expect(new Set(tiles.map(tile=>tile.toString("base64"))).size).toBe(8);
  });
  it("rejects unregistered regions instead of drawing a fallback",()=>expect(()=>getAuthoredDungeonTiles("unknown")).toThrow("missing"));
});
