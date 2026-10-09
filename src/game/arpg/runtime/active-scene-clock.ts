import type { Scene } from "phaser";

/** Elapsed simulation time, using the same delta as Phaser's delayed calls. */
export class ActiveSceneClock {
  private elapsedMs = 0;

  get now() {
    return this.elapsedMs;
  }

  advance(deltaMs: number) {
    if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsedMs += deltaMs;
  }
}

export function bindActiveSceneClock(scene: Pick<Scene, "events" | "time">) {
  const clock = new ActiveSceneClock();
  // Paused and sleeping scenes emit no preupdate. The absolute frame timestamp,
  // unlike delta, includes the pause and must never drive combat deadlines.
  const advance = (_frameTime: number, deltaMs: number) => {
    if (!scene.time.paused) clock.advance(deltaMs * scene.time.timeScale);
  };
  const dispose = () => {
    scene.events.off("preupdate", advance);
    scene.events.off("shutdown", dispose);
    scene.events.off("destroy", dispose);
  };
  scene.events.on("preupdate", advance);
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  return clock;
}
