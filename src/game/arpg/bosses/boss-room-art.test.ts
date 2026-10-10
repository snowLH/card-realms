import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { BOSS_ROOM_ART, bossRoomThronePosition } from "./boss-room-art";
import { BossRoomPresentation } from "./boss-room-presentation";
import { buildRoomTileData, ROOM_FLOOR_TILE, ROOM_WALL_TILE } from "../dungeon/room-tilemap";
import { generateDungeon } from "../dungeon/generator";

describe("authored boss environments", () => {
  it("shares the declared throne position across runtimes while preserving legacy rooms", () => {
    for (const id of Object.keys(BOSS_ROOM_ART)) {
      expect(bossRoomThronePosition(id, 1952)).toEqual(BOSS_ROOM_ART[id].thronePosition);
      expect(bossRoomThronePosition(id, 1184)).toEqual({ x: 592, y: 144 });
    }
  });
  it.each(Object.entries(BOSS_ROOM_ART))("%s ships an opaque 61x31 arena with crisp two-pixel cells", async (_, art) => {
    const asset = sharp(readFileSync(`public${art.background.path}`));
    const metadata = await asset.metadata();
    expect([metadata.width, metadata.height]).toEqual([1952, 992]);
    const { data, info } = await asset.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const colors = new Set<number>();
    let transparent = 0;
    for (let y = 0; y < info.height; y += 2) for (let x = 0; x < info.width; x += 2) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] !== 255) transparent++;
      // Sample many cells without thousands of expensive matcher invocations.
      if (x % 80 === 0 && y % 80 === 0) {
        expect(data.subarray(i, i + 4)).toEqual(data.subarray(i + 4, i + 8));
        const below = i + info.width * 4;
        expect(data.subarray(i, i + 4)).toEqual(data.subarray(below, below + 4));
      }
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    expect(colors.size).toBeLessThanOrEqual(128);
    expect(transparent).toBe(0);
  });

  it.each(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"])("%s keeps invisible collision walls and the south approach clear", (regionId) => {
    const graph = generateDungeon({ seed: "art-contract", regionId });
    const room = graph.rooms[graph.bossRoomId];
    const tiles = buildRoomTileData(room.templateId, room.connections, graph.seed);
    expect(tiles.width).toBe(61); expect(tiles.height).toBe(31);
    expect(tiles.data[0].every((tile) => tile === ROOM_WALL_TILE)).toBe(true);
    for (let y = 8; y < 25; y++) for (let x = 6; x < 55; x++) expect(tiles.data[y][x]).toBe(ROOM_FLOOR_TILE);
    expect(tiles.data[30].slice(29, 32)).toEqual([0, 0, 0]);
  });

  it("the room owns its images independently and restoration preserves ruined artwork", () => {
    const image = { setOrigin: vi.fn(() => image), setDisplaySize: vi.fn(() => image), setDepth: vi.fn(() => image), setTint: vi.fn(() => image), clearTint: vi.fn(), destroy: vi.fn() };
    const scene = { add: { image: vi.fn(() => image), graphics: vi.fn(() => { throw new Error("No geometric scenery"); }) }, events: { once: vi.fn() } };
    const presentation = new BossRoomPresentation(scene as unknown as ConstructorParameters<typeof BossRoomPresentation>[0], BOSS_ROOM_ART["king-arthur"], { x: 160, y: 160 });
    expect(scene.add.image).toHaveBeenCalledWith(160, 160, BOSS_ROOM_ART["king-arthur"].background.key);
    presentation.restore(); presentation.restore();
    expect(image.clearTint).toHaveBeenCalledOnce(); expect(image.destroy).not.toHaveBeenCalled();
    presentation.destroy(); presentation.destroy(); expect(image.destroy).toHaveBeenCalledOnce();
  });

  it("environment rendering never substitutes primitive shapes for scenery", () => {
    const room = readFileSync("src/game/arpg/bosses/boss-room-presentation.ts", "utf8");
    expect(room).not.toMatch(/graphics\(|fillRect|fillTriangle|fillEllipse/);
    for (const file of ["regional-presentation.ts", "king-arthur/presentation.ts"]) {
      const renderer = readFileSync(`src/game/arpg/bosses/${file}`, "utf8");
      expect(renderer).not.toMatch(/scenery|fillTriangle|fillEllipse/);
    }
  });
});
