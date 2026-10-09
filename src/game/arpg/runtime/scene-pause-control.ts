import type { ArpgRuntimeBridge } from "../domain/types";

type PauseTarget = {
  scene: { isActive(): boolean; isPaused(): boolean; pause(): unknown; resume(): unknown };
  input?: { keyboard?: { resetKeys(): unknown } | null };
  events: { once(event: string, listener: () => void): unknown; off(event: string, listener: () => void): unknown };
};

/** Keeps the latest pause request while Phaser is booting or loading assets. */
export function createScenePauseControl(bridge: Pick<ArpgRuntimeBridge, "clearGameplayInput">) {
  let requestedPause = false;
  let disposed = false;
  const targets = new Map<PauseTarget, () => void>();
  const apply = (target: PauseTarget) => {
    if (disposed || (!target.scene.isActive() && !target.scene.isPaused())) return;
    target.input?.keyboard?.resetKeys();
    if (requestedPause && !target.scene.isPaused()) target.scene.pause();
    else if (!requestedPause && target.scene.isPaused()) target.scene.resume();
  };

  return {
    attach(target: PauseTarget | undefined) {
      if (!target || disposed || targets.has(target)) return;
      const onCreate = () => apply(target);
      targets.set(target, onCreate);
      target.events.once("create", onCreate);
      apply(target);
    },
    setPaused(paused: boolean) {
      if (disposed) return;
      requestedPause = paused;
      bridge.clearGameplayInput();
      targets.forEach((_listener, target) => apply(target));
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      targets.forEach((listener, target) => target.events.off("create", listener));
      targets.clear();
      bridge.clearGameplayInput();
    },
  };
}
