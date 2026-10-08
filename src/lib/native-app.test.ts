// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectNativeApp, NATIVE_BACK_EVENT, NATIVE_SUSPEND_EVENT, setNativeLandscape } from "./native-app";

const native = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => true), isPluginAvailable: vi.fn(() => true), getPlatform: vi.fn(() => "android") }));
const plugin = vi.hoisted(() => ({ addListener: vi.fn(), minimizeApp: vi.fn().mockResolvedValue(undefined) }));
const orientation = vi.hoisted(() => ({ lock: vi.fn().mockResolvedValue(undefined), unlock: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@capacitor/core", () => ({ Capacitor: native }));
vi.mock("@capacitor/app", () => ({ App: plugin }));
vi.mock("@capacitor/screen-orientation", () => ({ ScreenOrientation: orientation }));
beforeEach(() => { vi.clearAllMocks(); native.isNativePlatform.mockReturnValue(true); native.isPluginAvailable.mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); });

describe("native app integration", () => {
  it("leaves browser/PWA and old native clients without plugins untouched", async () => {
    native.isNativePlatform.mockReturnValue(false);
    connectNativeApp()();
    await setNativeLandscape(true);
    expect(plugin.addListener).not.toHaveBeenCalled();
    expect(orientation.lock).not.toHaveBeenCalled();
    native.isNativePlatform.mockReturnValue(true);
    native.isPluginAvailable.mockReturnValue(false);
    connectNativeApp()();
    expect(plugin.addListener).not.toHaveBeenCalled();
  });
  it("clears inputs on backgrounding and preserves a handled Back action", async () => {
    const listeners = new Map<string, (value?: { isActive: boolean }) => void>();
    const remove = vi.fn().mockResolvedValue(undefined);
    plugin.addListener.mockImplementation(async (event, callback) => { listeners.set(event, callback); return { remove }; });
    const suspend = vi.fn();
    const back = (event: Event) => event.preventDefault();
    window.addEventListener(NATIVE_SUSPEND_EVENT, suspend);
    window.addEventListener(NATIVE_BACK_EVENT, back);
    const dispose = connectNativeApp();
    await Promise.resolve();
    listeners.get("appStateChange")?.({ isActive: false });
    listeners.get("appStateChange")?.({ isActive: true });
    listeners.get("backButton")?.();
    expect(suspend).toHaveBeenCalledOnce();
    expect(plugin.minimizeApp).not.toHaveBeenCalled();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.append(dialog);
    const dismiss = vi.fn();
    dialog.addEventListener("keydown", dismiss);
    listeners.get("backButton")?.();
    expect(dismiss).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    expect(plugin.minimizeApp).not.toHaveBeenCalled();
    dialog.remove();
    window.removeEventListener(NATIVE_BACK_EVENT, back);
    listeners.get("backButton")?.();
    expect(plugin.minimizeApp).toHaveBeenCalledOnce();
    dispose();
    expect(remove).toHaveBeenCalledTimes(2);
    listeners.get("backButton")?.();
    expect(plugin.minimizeApp).toHaveBeenCalledOnce();
    window.removeEventListener(NATIVE_SUSPEND_EVENT, suspend);
  });
  it("removes listeners that finish registering after unmount", async () => {
    let resolve!: (handle: { remove: () => Promise<void> }) => void;
    const pending = new Promise<{ remove: () => Promise<void> }>((done) => { resolve = done; });
    plugin.addListener.mockReturnValue(pending);
    const dispose = connectNativeApp();
    dispose();
    const remove = vi.fn().mockResolvedValue(undefined);
    resolve({ remove });
    await Promise.resolve();
    await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(2);
  });
  it("unlocks after an in-flight dungeon lock instead of leaving the guilda locked", async () => {
    let finishLock!: () => void;
    orientation.lock.mockReturnValueOnce(new Promise<void>((done) => { finishLock = done; }));
    const lock = setNativeLandscape(true);
    const unlock = setNativeLandscape(false);
    await Promise.resolve();
    expect(orientation.unlock).not.toHaveBeenCalled();
    finishLock();
    await lock;
    await unlock;
    expect(orientation.lock).toHaveBeenCalledWith({ orientation: "landscape" });
    expect(orientation.unlock).toHaveBeenCalledOnce();
  });
});
