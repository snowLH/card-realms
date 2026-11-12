"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

// No generic IPC, filesystem, shell or token API is exposed to the hosted page.
contextBridge.exposeInMainWorld("folklardDesktop", {
  version: 1,
  openAuth: (url) => ipcRenderer.invoke("folklard:auth-open", url),
  onAuthCallback: (listener) => {
    const receive = (_event, url) => { if (typeof url === "string") listener(url); };
    ipcRenderer.on("folklard:auth-callback", receive);
    ipcRenderer.send("folklard:auth-ready");
    return () => { ipcRenderer.removeListener("folklard:auth-callback", receive); };
  },
});
