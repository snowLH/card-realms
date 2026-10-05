import { describe, expect, it } from "vitest";
import { generateDungeon } from "../dungeon/generator";
import { ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WATER_TILE } from "../dungeon/room-tilemap";
import type { DungeonGraph } from "../dungeon/types";
import { DungeonWorldRuntime } from "./dungeon-world";

type MockVisual = { visible: boolean; setDepth: () => MockVisual; setStrokeStyle: () => MockVisual };

function createSceneMock() {
  const visuals: MockVisual[] = [];
  const tweens: Array<{ paused: boolean }> = [];
  const addVisual = () => {
    const visual: MockVisual = {
      visible: true,
      setDepth() { return this; },
      setStrokeStyle() { return this; },
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
      circle: addVisual,
      ellipse: addVisual,
      polygon: addVisual,
      rectangle: addVisual,
      triangle: addVisual,
    },
    tweens: { add: addTween },
    cameras: { main: { setBounds() {}, pan() {} } },
  } as unknown as import("phaser").Scene;
  return { scene, visuals, tweens };
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
});
