"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, shell, session, Menu } = require("electron");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindGameWindow } = require("./window-controller.cjs");
let window;
function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 560,
    backgroundColor: "#0b1715", title: "Folklard — Crônicas de Aurória",
    autoHideMenuBar: true, show: false, icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false, spellcheck: false },
  });
  window.once("ready-to-show", () => window.show());
  const controller = bindGameWindow(window, shell, path.join(__dirname, "offline.html"));
  void controller.loadGame();
  Menu.setApplicationMenu(null);
}
app.whenReady().then(() => {
  app.setName("Folklard");
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["fullscreen", "clipboard-sanitized-write"].includes(permission));
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
