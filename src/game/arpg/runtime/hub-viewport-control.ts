import { ARPG_LOGICAL_VIEWPORT } from "./render-config";

type HubScale = Pick<import("phaser").Scale.ScaleManager, "scaleMode" | "autoCenter" | "setGameSize" | "refresh">;

export function createHubViewportControl(
  parent: HTMLElement,
  modes: { portrait: number; landscape: number; centered: number; uncentered: number },
  initialPortrait: boolean,
  clearInput: () => void,
) {
  let portrait = initialPortrait;
  let scale: HubScale | null = null;
  let observer: ResizeObserver | null = null;
  let destroyed = false;
  let lastSize = "";

  const update = () => {
    if (!scale || destroyed || parent.clientWidth <= 0 || parent.clientHeight <= 0) return;
    const viewport = portrait
      ? { width: parent.clientWidth, height: parent.clientHeight }
      : ARPG_LOGICAL_VIEWPORT;
    const signature = `${portrait}:${viewport.width}:${viewport.height}`;
    scale.scaleMode = portrait ? modes.portrait : modes.landscape;
    scale.autoCenter = portrait ? modes.uncentered : modes.centered;
    if (signature !== lastSize) {
      lastSize = signature;
      scale.setGameSize(viewport.width, viewport.height);
    } else {
      scale.refresh();
    }
  };

  return {
    attach(readyScale: HubScale) {
      if (destroyed || scale) return;
      scale = readyScale;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(update);
        observer.observe(parent);
      } else {
        window.addEventListener("resize", update);
      }
      update();
    },
    setPortraitMode(next: boolean) {
      if (destroyed || next === portrait) return;
      portrait = next;
      clearInput();
      update();
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
      window.removeEventListener("resize", update);
      scale = null;
    },
  };
}
