"use strict";
const GAME_URL = "https://card-realms.vercel.app/";
const GAME_ORIGIN = new URL(GAME_URL).origin;

function isGameUrl(url) {
  try { return new URL(url).origin === GAME_ORIGIN; } catch { return false; }
}
function isExternalUrl(url) {
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}

function bindGameWindow(window, shell, offlinePath) {
  let offline = false;
  const showOffline = () => {
    if (window.isDestroyed() || offline) return;
    offline = true;
    void window.loadFile(offlinePath).catch(() => {
      // The local fallback should still leave a visible window if loading fails.
      if (!window.isDestroyed()) window.show();
    });
  };
  const loadGame = () => {
    offline = false;
    return window.loadURL(GAME_URL).catch(showOffline);
  };
  const openExternal = (url) => {
    if (isExternalUrl(url)) void shell.openExternal(url).catch(() => {});
  };
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, legacyUrl) => {
    const url = event.url || legacyUrl;
    if (offline && isGameUrl(url)) {
      event.preventDefault();
      void loadGame();
    } else if (!isGameUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  window.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) showOffline(); // ERR_ABORTED is an intentional navigation.
  });
  window.webContents.on("render-process-gone", showOffline);
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.isAutoRepeat) return;
    if (input.key === "F11") {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.key === "Escape" && window.isFullScreen()) {
      window.setFullScreen(false);
    }
  });
  return { loadGame };
}

module.exports = { bindGameWindow, isGameUrl, isExternalUrl };
