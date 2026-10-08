import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import type { PluginListenerHandle } from "@capacitor/core";
import { NATIVE_BACK_EVENT, NATIVE_SUSPEND_EVENT } from "./native-events";
export { NATIVE_BACK_EVENT, NATIVE_SUSPEND_EVENT } from "./native-events";

/** Older installed clients may not contain these plugins; web/PWA remains unchanged. */
export function connectNativeApp() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("App")) return () => {};
  let disposed = false;
  const handles = new Set<PluginListenerHandle>();
  const retain = async (pending: Promise<PluginListenerHandle>) => {
    try {
      const handle = await pending;
      if (disposed) await handle.remove();
      else handles.add(handle);
    } catch { /* Unsupported events must not prevent the game from booting. */ }
  };
  void retain(App.addListener("appStateChange", ({ isActive }) => {
    if (!disposed && !isActive) window.dispatchEvent(new Event(NATIVE_SUSPEND_EVENT));
  }));
  if (Capacitor.getPlatform() === "android") {
    void retain(App.addListener("backButton", () => {
      if (disposed) return;
      const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
      if (dialogs.length) {
        // Radix handles Escape, including its existing focus restoration and nested dialogs.
        dialogs[dialogs.length - 1].dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape", code: "Escape", bubbles: true, cancelable: true,
        }));
        return;
      }
      const event = new Event(NATIVE_BACK_EVENT, { cancelable: true });
      window.dispatchEvent(event);
      if (!event.defaultPrevented) void App.minimizeApp().catch(() => {});
    }));
  }
  return () => {
    disposed = true;
    for (const handle of handles) void handle.remove().catch(() => {});
    handles.clear();
  };
}

let orientationQueue = Promise.resolve();
/** Serialize requests so leaving a dungeon cannot be followed by a late lock. */
export function setNativeLandscape(landscape: boolean) {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ScreenOrientation")) return Promise.resolve();
  orientationQueue = orientationQueue.then(() => landscape
    ? ScreenOrientation.lock({ orientation: "landscape" })
    : ScreenOrientation.unlock()).catch(() => {});
  return orientationQueue;
}
