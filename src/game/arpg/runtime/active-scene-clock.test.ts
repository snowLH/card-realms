import { EventEmitter } from "node:events";
import type { Scene } from "phaser";
import { describe, expect, it } from "vitest";
import { ActiveSceneClock, bindActiveSceneClock } from "./active-scene-clock";

function createScene() {
  const events = new EventEmitter();
  const time = { paused: false, timeScale: 1 };
  const clock = bindActiveSceneClock({ events, time } as unknown as Pick<Scene, "events" | "time">);
  return { clock, events, time };
}

describe("active dungeon time", () => {
  it("preserves a pending strike, dash and cooldown after a long scene pause", () => {
    const { clock, events } = createScene();
    events.emit("preupdate", 10_000, 100);
    const strikeAt = clock.now + 620;
    const dashUntil = clock.now + 180;
    const abilityAt = clock.now + 8_000;
    // Scene pause stops updates. On resume Phaser supplies the new absolute
    // timestamp, while delayed calls advance only by this frame's delta.
    events.emit("pause");
    events.emit("resume");
    events.emit("preupdate", 3_610_000, 16);
    expect(strikeAt - clock.now).toBe(604);
    expect(dashUntil - clock.now).toBe(164);
    expect(abilityAt - clock.now).toBe(7_984);
    events.emit("preupdate", 3_610_604, 604);
    expect(clock.now).toBe(strikeAt);
  });

  it("follows timer pause and time scale without consuming wall time", () => {
    const { clock, events, time } = createScene();
    time.timeScale = 0.5;
    events.emit("preupdate", 5_000, 100);
    expect(clock.now).toBe(50);
    time.paused = true;
    events.emit("preupdate", 6_000, 100);
    expect(clock.now).toBe(50);
    time.paused = false;
    time.timeScale = 1;
    events.emit("preupdate", 7_000, 100);
    expect(clock.now).toBe(150);
  });

  it.each(["shutdown", "destroy"])("releases every listener on %s before a new scene starts", (event) => {
    const { clock, events } = createScene();
    events.emit("preupdate", 10_000, 100);
    events.emit(event);
    expect(events.eventNames()).toEqual([]);
    events.emit("preupdate", 20_000, 100);
    expect(clock.now).toBe(100);
    const restarted = bindActiveSceneClock({ events, time: { paused: false, timeScale: 1 } } as unknown as Pick<Scene, "events" | "time">);
    events.emit("preupdate", 30_000, 16);
    expect(restarted.now).toBe(16);
    expect(clock.now).toBe(100);
  });

  it("ignores invalid deltas and retains monotonic simulation time", () => {
    const clock = new ActiveSceneClock();
    clock.advance(16);
    for (const delta of [NaN, Infinity, -16, 0]) clock.advance(delta);
    expect(clock.now).toBe(16);
  });
});
