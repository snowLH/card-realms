import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";

const require = createRequire(import.meta.url);
const { bindGameWindow, isGameUrl } = require("../../desktop/window-controller.cjs");
function fixture() {
  const contents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
  const window = {
    webContents: contents, isDestroyed: vi.fn(() => false), loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined), show: vi.fn(),
    isFullScreen: vi.fn(() => false), setFullScreen: vi.fn(),
  };
  const shell = { openExternal: vi.fn().mockResolvedValue(undefined) };
  const controller = bindGameWindow(window, shell, "offline.html");
  return { window, contents, shell, controller };
}

describe("desktop game window", () => {
  it("shows a local recovery screen when the initial network request fails", async () => {
    const { window, controller } = fixture();
    window.loadURL.mockRejectedValueOnce(new Error("offline"));
    await controller.loadGame();
    expect(window.loadFile).toHaveBeenCalledWith("offline.html");
  });
  it("ignores canceled loads and subframe failures, then retries from the recovery page", async () => {
    const { window, contents } = fixture();
    contents.emit("did-fail-load", {}, -3, "aborted", "", true);
    contents.emit("did-fail-load", {}, -106, "offline", "", false);
    expect(window.loadFile).not.toHaveBeenCalled();
    contents.emit("did-fail-load", {}, -106, "offline", "", true);
    contents.emit("did-fail-load", {}, -106, "offline", "", true);
    expect(window.loadFile).toHaveBeenCalledTimes(1);
    const event = { preventDefault: vi.fn() };
    contents.emit("will-navigate", event, "https://card-realms.vercel.app/");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.loadURL).toHaveBeenCalledWith("https://card-realms.vercel.app/");
    await Promise.resolve();
  });
  it("keeps external links in the system browser and rejects executable protocols", () => {
    const { window, contents, shell } = fixture();
    const open = window.webContents.setWindowOpenHandler.mock.calls[0][0];
    expect(open({ url: "https://github.com/snowLH/card-realms" })).toEqual({ action: "deny" });
    open({ url: "javascript:alert(1)" });
    const event = { preventDefault: vi.fn() };
    contents.emit("will-navigate", event, "https://card-realms.vercel.app.attacker.invalid/");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(shell.openExternal).toHaveBeenCalledTimes(2);
    expect(isGameUrl("https://card-realms.vercel.app.attacker.invalid/")).toBe(false);
  });
  it("toggles fullscreen once per F11 press and exits with Escape", () => {
    const { window, contents } = fixture();
    const event = { preventDefault: vi.fn() };
    contents.emit("before-input-event", event, { type: "keyDown", key: "F11", isAutoRepeat: false });
    contents.emit("before-input-event", event, { type: "keyDown", key: "F11", isAutoRepeat: true });
    expect(window.setFullScreen).toHaveBeenCalledExactlyOnceWith(true);
    window.isFullScreen.mockReturnValue(true);
    contents.emit("before-input-event", event, { type: "keyDown", key: "Escape" });
    expect(window.setFullScreen).toHaveBeenLastCalledWith(false);
  });
  it("offers recovery after a renderer crash without touching saved data", () => {
    const { window, contents } = fixture();
    contents.emit("render-process-gone", {}, { reason: "crashed" });
    expect(window.loadFile).toHaveBeenCalledWith("offline.html");
  });
});
