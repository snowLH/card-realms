import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARPG_ASSET_MANIFEST } from "../assets";
import {createHash} from "node:crypto";
import sharp from "sharp";

describe("vendored external CC0 weapon spritesheet", () => {
  it("ships the alpha-normalized PNG locally with the expected 10x7 grid of 16px cells", () => {
    const sheet = ARPG_ASSET_MANIFEST.weapons.bennyboiHack;
    const file = resolve(process.cwd(), "public", sheet.path.slice(1));
    const png = readFileSync(file);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(sheet.columns * (sheet.frameWidth + sheet.spacing));
    expect(png.readUInt32BE(20)).toBe(sheet.rows * (sheet.frameHeight + sheet.spacing));
    expect(sheet.frameCount).toBe(sheet.columns * sheet.rows);
  });
  it("preserves the verified CC0 original and every non-matte foreground pixel",async()=>{
    const original=readFileSync(resolve(process.cwd(),"public/art/vendor/opengameart/bennyboi-hack/weaponpack.png"));
    expect(createHash("sha256").update(original).digest("hex")).toBe("37f4ce4a3e875b8e7f23897e583c1991253788eff271a1c283498e38629e45d3");
    const before=await sharp(original).ensureAlpha().raw().toBuffer();
    const after=await sharp(resolve(process.cwd(),"public",ARPG_ASSET_MANIFEST.weapons.bennyboiHack.path.slice(1))).ensureAlpha().raw().toBuffer();
    expect(after.length).toBe(before.length);
    let transparent=0;
    for(let i=0;i<before.length;i+=4){
      if(after[i+3]===0){transparent++;expect([...before.subarray(i,i+3)]).toEqual([170,170,170]);}
      else expect([...after.subarray(i,i+4)]).toEqual([...before.subarray(i,i+4)]);
    }
    expect(transparent).toBeGreaterThan(3000);
  });
});
