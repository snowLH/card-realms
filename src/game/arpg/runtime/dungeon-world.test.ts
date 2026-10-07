import { describe, expect, it } from "vitest";
import { generateDungeon } from "../dungeon/generator";
import { ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WATER_TILE } from "../dungeon/room-tilemap";
import type { DungeonGraph } from "../dungeon/types";
import { DungeonWorldRuntime } from "./dungeon-world";

type MockVisual = {
  visible: boolean;
  setDepth: (depth: number) => MockVisual;
  setOrigin: (x: number, y?: number) => MockVisual;
  setDisplaySize: (width: number, height: number) => MockVisual;
  setFlipX: (flipX: boolean) => MockVisual;
  setFlipY: (flipY: boolean) => MockVisual;
  setStrokeStyle: (width: number, color: number, alpha?: number) => MockVisual;
  fillStyle: (color: number, alpha?: number) => MockVisual;
  fillRect: (x: number, y: number, width: number, height: number) => MockVisual;
};

function createSceneMock() {
  const visuals: MockVisual[] = [];
  const graphicsRects: Array<{ x: number; y: number; width: number; height: number }> = [];
  const tweens: Array<{ paused: boolean }> = [];
  const cameraBounds: Array<{ x: number; y: number; width: number; height: number }> = [];
  const addVisual = () => {
    const visual: MockVisual = {
      visible: true,
      setDepth() { return this; },
      setOrigin() { return this; },
      setDisplaySize() { return this; },
      setFlipX() { return this; },
      setFlipY() { return this; },
      setStrokeStyle() { return this; },
      fillStyle() { return this; },
      fillRect() { return this; },
    };
    visuals.push(visual);
    return visual;
  };
  const addGraphics = () => {
    const visual = addVisual();
    visual.fillRect = (x, y, width, height) => {
      graphicsRects.push({ x, y, width, height });
      return visual;
    };
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
      circle: addVisual,
      ellipse: addVisual,
      graphics: addGraphics,
      image: addVisual,
      polygon: addVisual,
      rectangle: addVisual,
      triangle: addVisual,
    },
    tweens: { add: addTween },
    textures: { exists: () => false },
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
  return { scene, visuals, tweens, graphicsRects, cameraBounds };
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
  it("draws deterministic pixel-grid ruin clusters and two room-scoped warm torches", () => {
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

    expect(first.graphicsRects.length).toBeGreaterThan(0);
    expect(first.graphicsRects).toEqual(second.graphicsRects);
    expect(first.graphicsRects.every(({ x, y, width, height }) => [x, y, width, height].every(Number.isInteger))).toBe(true);
    expect(first.tweens).toHaveLength(2);
    expect(first.visualWorld.getAmbientDebugState().rooms.find((entry) => entry.roomId === room.id)?.fx).toEqual({ active: 0, paused: 2 });
    first.visualWorld.focusCamera(room.id);
    expect(first.visualWorld.getAmbientDebugState().rooms.find((entry) => entry.roomId === room.id)?.fx).toEqual({ active: 2, paused: 0 });
  });
});
