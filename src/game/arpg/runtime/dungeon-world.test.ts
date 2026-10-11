import { ART_ATLASES, PROP_ART } from "../art/manifest";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { generateDungeon } from "../dungeon/generator";
import { ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WATER_TILE } from "../dungeon/room-tilemap";
import type { DungeonGraph } from "../dungeon/types";
import { DungeonWorldRuntime } from "./dungeon-world";

type MockVisual = {
  visible: boolean;
  setDepth: (depth: number) => MockVisual;
  setOrigin: (x: number, y?: number) => MockVisual;
  setDisplaySize: (width: number, height: number) => MockVisual;
  setAlpha:(alpha:number)=>MockVisual;
  setTint:(color:number)=>MockVisual;
  setRotation:(angle:number)=>MockVisual;
  setVisible:(visible:boolean)=>MockVisual;
  setFlipX: (flipX: boolean) => MockVisual;
  setFlipY: (flipY: boolean) => MockVisual;
};

function createSceneMock() {
  const visuals: MockVisual[] = [];
  const images: Array<{x:number;y:number;key:string;frame:number}> = [];
  const tweens: Array<{ paused: boolean }> = [];
  const cameraBounds: Array<{ x: number; y: number; width: number; height: number }> = [];
  const addVisual = () => {
    const visual: MockVisual = {
      visible: true,
      setDepth() { return this; },
      setOrigin() { return this; },
      setDisplaySize() { return this; },
      setAlpha() {return this;},
      setTint() {return this;},
      setRotation() {return this;},
      setVisible(visible:boolean) {this.visible=visible;return this;},
      setFlipX() { return this; },
      setFlipY() { return this; },
    };
    visuals.push(visual);
    return visual;
  };
  const addTween = () => {
    const tween = {
      paused: false,
      isPaused() { return this.paused; },
      isPlaying() { return !this.paused; },
      pause() { this.paused = true; return this; },
      resume() { this.paused = false; return this; },
    };
    tweens.push(tween);
    return tween;
  };
  const scene = {
    add: {
      image: (x:number,y:number,key:string,frame:number)=>{images.push({x,y,key,frame});return addVisual();},
    },
    tweens: { add: addTween },
    textures: { exists: () => true },
    cameras: {
      main: {
        setBounds(x: number, y: number, width: number, height: number) {
          cameraBounds.push({ x, y, width, height });
          return this;
        },
        pan() {},
      },
    },
  } as unknown as import("phaser").Scene;
  return { scene, visuals, tweens, images, cameraBounds };
}

function makeAmbientTiles() {
  const tiles = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
  tiles[1][1] = ROOM_OBSTACLE_TILE;
  tiles[2][2] = ROOM_RUNE_TILE;
  tiles[3][3] = ROOM_WATER_TILE;
  tiles[3][4] = ROOM_WATER_TILE;
  return tiles;
}

describe("DungeonWorldRuntime ambient room state", () => {
  it("bounds the atmosphere canvas to the viewport through pan, zoom and resize, then removes its listener", () => {
    const graph = generateDungeon({ seed: "viewport-atmosphere", regionId: "montanhas-runicas" });
    const events = new EventEmitter();
    const camera = { width: 1280, height: 720, zoom: 1, scrollX: 3000, scrollY: 2000 };
    const background = {
      width: camera.width, height: camera.height,
      setScrollFactor: vi.fn().mockReturnThis(), setTint: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(), setTileScale: vi.fn().mockReturnThis(),
      setTilePosition: vi.fn().mockReturnThis(),
      setSize: vi.fn(function (width: number, height: number) {
        background.width = width; background.height = height;
        return background;
      }),
    };
    const tileSprite = vi.fn(() => background);
    const scene = { add: { tileSprite }, cameras: { main: camera }, events } as unknown as import("phaser").Scene;
    const world = new DungeonWorldRuntime(scene, graph);
    (world as unknown as { drawWorldAtmosphere: () => void }).drawWorldAtmosphere();

    expect(world.layout.width * world.layout.height).toBeGreaterThan(camera.width * camera.height * 20);
    expect(tileSprite).toHaveBeenCalledWith(640, 360, 1280, 720, "card-realms-dungeon-tiles-montanhas-runicas", 1);
    expect(background.setTilePosition).toHaveBeenLastCalledWith(3000, 2000);
    camera.scrollX = 6000; camera.zoom = 0.8;
    events.emit("prerender");
    expect(background.setSize).not.toHaveBeenCalled();
    expect(background.setScale).toHaveBeenLastCalledWith(1.25);
    expect(background.setTileScale).toHaveBeenLastCalledWith(0.8);
    expect(background.setTilePosition).toHaveBeenLastCalledWith(5840, 1910);
    camera.width = 852; camera.height = 393;
    events.emit("prerender"); events.emit("prerender");
    expect(background.setSize).toHaveBeenCalledExactlyOnceWith(852, 393);
    expect(background.setPosition).toHaveBeenLastCalledWith(426, 196.5);
    events.emit("shutdown");
    expect(events.listenerCount("prerender")).toBe(0);
    expect(events.listenerCount("destroy")).toBe(0);
    const syncCount = background.setPosition.mock.calls.length;
    events.emit("prerender");
    expect(background.setPosition).toHaveBeenCalledTimes(syncCount);
  });

  it("pauses and hides distant room FX, then resumes the room in focus", () => {
    const graph = generateDungeon({ seed: "ambient-focus", regionId: "montanhas-runicas" });
    const { scene, visuals, tweens } = createSceneMock();
    const world = new DungeonWorldRuntime(scene, graph);
    const drawAmbient = world as unknown as {
      drawAmbientDetails: (
        room: DungeonGraph["rooms"][string],
        tiles: number[][],
        layout: (typeof world.layout)["rooms"][string],
      ) => void;
    };
    const first = graph.rooms[graph.startRoomId];
    const second = graph.rooms[Object.values(first.connections).find(Boolean)!];

    for (const room of [first, second]) {
      drawAmbient.drawAmbientDetails(room, makeAmbientTiles(), world.layout.rooms[room.id]);
    }

    const createdFxPerRoom = tweens.length / 2;
    expect(createdFxPerRoom).toBeGreaterThan(0);
    expect(visuals.every((visual) => !visual.visible)).toBe(true);
    expect(tweens.every((tween) => tween.paused)).toBe(true);

    world.focusCamera(first.id);
    let debug = world.getAmbientDebugState();
    expect(debug.activeRoomId).toBe(first.id);
    expect(debug.rooms.find(({ roomId }) => roomId === first.id)).toEqual({
      roomId: first.id,
      tweens: { active: createdFxPerRoom, paused: 0 },
      fx: { active: createdFxPerRoom, paused: 0 },
    });
    expect(debug.rooms.find(({ roomId }) => roomId === second.id)).toEqual({
      roomId: second.id,
      tweens: { active: 0, paused: createdFxPerRoom },
      fx: { active: 0, paused: createdFxPerRoom },
    });

    world.focusCamera(second.id);
    debug = world.getAmbientDebugState();
    expect(debug.activeRoomId).toBe(second.id);
    expect(debug.rooms.find(({ roomId }) => roomId === first.id)).toMatchObject({
      tweens: { active: 0, paused: createdFxPerRoom },
      fx: { active: 0, paused: createdFxPerRoom },
    });
    expect(debug.rooms.find(({ roomId }) => roomId === second.id)).toMatchObject({
      tweens: { active: createdFxPerRoom, paused: 0 },
      fx: { active: createdFxPerRoom, paused: 0 },
    });
  });

  it("keeps camera bounds on the full map when focus moves between rooms", () => {
    const graph = generateDungeon({ seed: "camera-room-transition", regionId: "montanhas-runicas" });
    const { scene, cameraBounds } = createSceneMock();
    const world = new DungeonWorldRuntime(scene, graph);
    const connectedRoomId = Object.values(graph.rooms[graph.startRoomId].connections).find(Boolean)!;

    world.focusCamera(graph.startRoomId);
    world.focusCamera(connectedRoomId);

    expect(cameraBounds).toEqual([
      { x: 0, y: 0, width: world.layout.width, height: world.layout.height },
      { x: 0, y: 0, width: world.layout.width, height: world.layout.height },
    ]);
  });
});

describe("Mata START room dressing", () => {
  it("places the same authored ruin and lantern frames for a seed, with two room-scoped animations", () => {
    const graph = generateDungeon({ seed: "mata-start-ruins", regionId: "mata-encantada" });
    const room = graph.rooms[graph.startRoomId];
    const tiles = Array.from({ length: 15 }, () => Array<number>(15).fill(0));
    const draw = () => {
      const mockedScene = createSceneMock();
      const { scene } = mockedScene;
      const visualWorld = new DungeonWorldRuntime(scene, graph);
      const drawStartRoomDressing = visualWorld as unknown as {
        drawMataStartRoomDressing: (
          room: DungeonGraph["rooms"][string],
          tiles: number[][],
          layout: (typeof visualWorld.layout)["rooms"][string],
        ) => void;
      };
      drawStartRoomDressing.drawMataStartRoomDressing(room, tiles, visualWorld.layout.rooms[room.id]);
      return { ...mockedScene, visualWorld };
    };
    const first = draw();
    const second = draw();

    expect(first.images.map(({key,frame})=>({key,frame}))).toEqual([
      {key:ART_ATLASES.props.key,frame:PROP_ART.ruin},{key:ART_ATLASES.props.key,frame:PROP_ART.lantern},
      {key:ART_ATLASES.props.key,frame:PROP_ART.ruin},{key:ART_ATLASES.props.key,frame:PROP_ART.lantern},
    ]);
    expect(first.images).toEqual(second.images);
    expect(first.images.every(({x,y})=>Number.isInteger(x)&&Number.isInteger(y))).toBe(true);
    expect(first.tweens).toHaveLength(2);
    expect(first.visualWorld.getAmbientDebugState().rooms.find((entry) => entry.roomId === room.id)?.fx).toEqual({ active: 0, paused: 2 });
    first.visualWorld.focusCamera(room.id);
    expect(first.visualWorld.getAmbientDebugState().rooms.find((entry) => entry.roomId === room.id)?.fx).toEqual({ active: 2, paused: 0 });
  });
});
