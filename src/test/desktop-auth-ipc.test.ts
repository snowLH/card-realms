import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const callback = "folklard://auth/callback?code=12345678";
async function fixture() {
  const app = Object.assign(new EventEmitter(), {
    requestSingleInstanceLock: vi.fn(() => true), setAsDefaultProtocolClient: vi.fn(), quit: vi.fn(),
    whenReady: () => Promise.resolve(), setName: vi.fn(), setPath: vi.fn(), getPath: () => "appData",
  });
  const contents = Object.assign(new EventEmitter(), {
    setWindowOpenHandler: vi.fn(), mainFrame: { url: "https://card-realms.vercel.app/" },
    send: vi.fn(), getURL: () => "https://card-realms.vercel.app/",
  });
  const window = Object.assign(new EventEmitter(), {
    webContents: contents, isDestroyed: () => false, show: vi.fn(), focus: vi.fn(), restore: vi.fn(),
    isMinimized: () => true, loadURL: vi.fn().mockResolvedValue(undefined), loadFile: vi.fn().mockResolvedValue(undefined),
  });
  const options = vi.fn();
  class BrowserWindow {
    constructor(value: unknown) { options(value); return window; }
    static getAllWindows() { return [window]; }
  }
  const handlers = new Map<string, (event: unknown, value?: string) => Promise<void>>();
  const ipc = Object.assign(new EventEmitter(), { handle: (name: string, handler: (event: unknown, value?: string) => Promise<void>) => handlers.set(name, handler) });
  const shell = { openExternal: vi.fn().mockResolvedValue(undefined) };
  const electron = { app, BrowserWindow, shell, ipcMain: ipc,
    session: { defaultSession: { setPermissionRequestHandler: vi.fn() } }, Menu: { setApplicationMenu: vi.fn() } };
  const desktopRequire = (name: string) => name === "electron" ? electron
    : name.startsWith("./") ? require(resolve("desktop", name)) : require(name);
  runInNewContext(readFileSync("desktop/main.cjs", "utf8"), {
    require: desktopRequire, __dirname: resolve("desktop"), URL,
    process: { argv: ["electron", "desktop", callback, "--flag"], execPath: "electron.exe", defaultApp: true, platform: "win32", env: {} },
  });
  await Promise.resolve();
  const sender = { sender: contents, senderFrame: contents.mainFrame };
  return { app, contents, window, options, ipc, handlers, shell, sender };
}
describe("Electron protocol / IPC authority", () => {
  it("registers a single instance and isolated preload, then delivers first-launch and second-instance callbacks", async () => {
    const { app, options, ipc, sender, contents, window } = await fixture();
    expect(app.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledWith("folklard", "electron.exe", [resolve("desktop")]);
    expect(options.mock.calls[0][0].webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, preload: resolve("desktop", "preload.cjs") });
    ipc.emit("folklard:auth-ready", sender);
    expect(contents.send).toHaveBeenCalledExactlyOnceWith("folklard:auth-callback", callback);
    app.emit("second-instance", {}, ["exe", "--flag", callback]);
    expect(contents.send).toHaveBeenCalledTimes(2); expect(window.restore).toHaveBeenCalled();
    contents.emit("did-start-navigation", {}, "https://card-realms.vercel.app/", false, true);
    app.emit("second-instance", {}, ["exe", callback]);
    expect(contents.send).toHaveBeenCalledTimes(2);
    ipc.emit("folklard:auth-ready", sender);
    expect(contents.send).toHaveBeenCalledTimes(3);
  });
  it("does not deliver codes to subframes or other web contents", async () => {
    const { ipc, sender, contents } = await fixture();
    ipc.emit("folklard:auth-ready", { ...sender, senderFrame: { url: sender.senderFrame.url } });
    ipc.emit("folklard:auth-ready", { ...sender, sender: {} });
    expect(contents.send).not.toHaveBeenCalled();
    ipc.emit("folklard:auth-ready", sender); expect(contents.send).toHaveBeenCalledOnce();
  });
  it("only opens public HTTPS Google authorize endpoints for the trusted main frame", async () => {
    const { handlers, sender, shell } = await fixture();
    const open = handlers.get("folklard:auth-open")!;
    const valid = "https://project.supabase.co/auth/v1/authorize?provider=google";
    await open(sender, valid); expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(valid);
    for (const raw of ["file:///secret", "javascript:alert(1)", "https://evil.example/", "https://project.supabase.co/auth/v1/admin?provider=google", "https://project.supabase.co/auth/v1/authorize?provider=other"]) {
      await expect(open(sender, raw)).rejects.toThrow();
    }
    await expect(open({ ...sender, senderFrame: {} }, valid)).rejects.toThrow();
    expect(shell.openExternal).toHaveBeenCalledOnce();
  });
});
