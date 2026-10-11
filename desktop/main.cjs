"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, shell, session, Menu, ipcMain } = require("electron");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindGameWindow, isGameUrl } = require("./window-controller.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createAuthMailbox, findAuthCallback } = require("./auth-protocol.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAppConfig } = require("./app-config.cjs");
const config = resolveAppConfig();
let window;
// Explicit local QA uses isolated storage; regular installed clients keep defaultSession.
if (config.qa) app.setPath("userData", path.join(app.getPath("appData"), "Folklard-Native-QA"));
const mailbox = createAuthMailbox();
const initialCallback = findAuthCallback(process.argv);
if (initialCallback) mailbox.accept(initialCallback);
// macOS can deliver this before ready; Windows/Linux use second-instance/argv.
app.on("open-url", (event, url) => { event.preventDefault(); mailbox.accept(url); });
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient("folklard", process.execPath, [path.resolve(process.argv[1]), ...config.protocolArgs]);
  } else if (config.qa) {
    // Preserve the QA origin/profile when Windows launches the callback with the app closed.
    app.setAsDefaultProtocolClient("folklard", process.execPath, config.protocolArgs);
  } else app.setAsDefaultProtocolClient("folklard");
  app.on("second-instance", (_event, args) => {
    const callback = findAuthCallback(args);
    if (callback) mailbox.accept(callback);
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.show(); window.focus();
    }
  });
}
function trustedSender(event) {
  return window && !window.isDestroyed() && event.sender === window.webContents
    && event.senderFrame === window.webContents.mainFrame && isGameUrl(event.senderFrame.url);
}
ipcMain.handle("folklard:auth-open", async (event, raw) => {
  if (!trustedSender(event) || typeof raw !== "string" || raw.length > 8192) throw new Error("Invalid auth request");
  const url = new URL(raw);
  // OAuth starts on the public Supabase endpoint, never an arbitrary shell URL.
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.pathname !== "/auth/v1/authorize"
    || url.username || url.password || url.port || url.searchParams.get("provider") !== "google") {
    throw new Error("Invalid auth address");
  }
  await shell.openExternal(url.toString());
});
ipcMain.on("folklard:auth-ready", (event) => {
  if (!trustedSender(event)) return;
  mailbox.subscribe((url) => {
    if (window && !window.isDestroyed() && isGameUrl(window.webContents.getURL())) {
      window.webContents.send("folklard:auth-callback", url);
      window.show(); window.focus();
    } else { mailbox.disconnect(); mailbox.accept(url); }
  });
});
function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 560,
    backgroundColor: "#0b1715", title: "Folklard — Crônicas de Aurória",
    autoHideMenuBar: true, show: false, icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false, spellcheck: false, preload: path.join(__dirname, "preload.cjs") },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.on("did-start-navigation", (_event, _url, _inPlace, isMainFrame) => {
    if (isMainFrame) mailbox.disconnect();
  });
  window.on("closed", () => { mailbox.disconnect(); window = undefined; });
  const controller = bindGameWindow(window, shell, path.join(__dirname, "offline.html"));
  void controller.loadGame();
  Menu.setApplicationMenu(null);
}
if (singleInstance) app.whenReady().then(() => {
  app.setName("Folklard");
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["fullscreen", "clipboard-sanitized-write"].includes(permission));
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
