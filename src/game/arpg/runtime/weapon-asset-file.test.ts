import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARPG_ASSET_MANIFEST } from "../assets";

describe("vendored external CC0 weapon spritesheet", () => {
  it("ships the original PNG locally with the expected 10x7 grid of 16px cells", () => {
    const sheet = ARPG_ASSET_MANIFEST.weapons.bennyboiHack;
    const file = resolve(process.cwd(), "public", sheet.path.slice(1));
    const png = readFileSync(file);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(sheet.columns * sheet.frameWidth);
    expect(png.readUInt32BE(20)).toBe(sheet.rows * sheet.frameHeight);
    expect(sheet.frameCount).toBe(sheet.columns * sheet.rows);
  });
});
