const CACHE_VERSION = "folklard-arpg-v25";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_STATE_CACHE = "folklard-offline-state-v1";
const READY_URL = "/__folklard-offline-ready__";
const DEVELOPMENT_ORIGIN = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);
const CORE_ASSETS = ["/icon.svg", "/icons/card-realms-192.png", "/icons/card-realms-512.png", "/icons/card-realms-maskable-512.png", "/apple-icon.png", "/offline.html"];

// Keep installation small; the full game downloads when the player asks.
self.addEventListener("install", (event) => {
  event.waitUntil((DEVELOPMENT_ORIGIN ? Promise.resolve() : caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => !key.startsWith("folklard-offline-") && key !== STATIC_CACHE && (key.startsWith("card-realms-") || key.startsWith("folklard-")))
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function offlineState() {
  const response = await (await caches.open(OFFLINE_STATE_CACHE)).match(READY_URL);
  return response ? response.json() : null;
}
async function offlineResponse(request) {
  const state = await offlineState();
  return state ? (await caches.open(state.cacheName)).match(request) : undefined;
}
function cacheableStatic(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || request.mode === "navigate") return false;
  return url.pathname.startsWith("/art/") || url.pathname.startsWith("/_next/static/")
    || ["image", "font", "style", "script", "audio"].includes(request.destination);
}
let preparation = null;
const progressPorts = new Set();
function broadcast(state) { for (const port of progressPorts) port.postMessage(state); }
async function prepareOffline() {
  let completed = 0;
  let total = 0;
  try {
    const response = await fetch("/offline-pack.json", { cache: "no-store" });
    if (!response.ok) throw new Error("O download offline está indisponível.");
    const manifest = await response.json();
    if (!Array.isArray(manifest.files) || !manifest.version || !manifest.files.includes("/offline")) throw new Error("Pacote offline inválido.");
    const cacheName = `folklard-offline-pack-${manifest.version}`;
    const cache = await caches.open(cacheName);
    total = manifest.files.length;
    let index = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (index < total) {
        const path = manifest.files[index++];
        if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /^(\/api\/|\/auth\/)/.test(path)) throw new Error("Arquivo offline inválido.");
        if (!await cache.match(path)) {
          const asset = await fetch(path, { cache: "reload", credentials: "omit" });
          if (!asset.ok || asset.redirected) throw new Error(`Falha ao baixar ${path}. Tente novamente com internet.`);
          await cache.put(path, asset);
        }
        completed++;
        broadcast({ ready: false, completed, total });
      }
    }));
    // A failed update keeps the previous complete pack and all player saves.
    await (await caches.open(OFFLINE_STATE_CACHE)).put(READY_URL, Response.json({ cacheName, version: manifest.version, total }));
    await Promise.all((await caches.keys()).filter((key) => key.startsWith("folklard-offline-pack-") && key !== cacheName).map((key) => caches.delete(key)));
    broadcast({ ready: true, completed, total });
  } catch (error) {
    broadcast({ ready: false, completed, total, error: error instanceof Error ? error.message : "O jogo offline não pôde ser preparado." });
  } finally { preparation = null; progressPorts.clear(); }
}
self.addEventListener("message", (event) => {
  const port = event.ports[0];
  if (!port) return;
  if (event.data?.type === "OFFLINE_STATUS") {
    event.waitUntil(offlineState().then((state) => port.postMessage({ ready: Boolean(state), completed: state?.total ?? 0, total: state?.total ?? 0 })));
  } else if (event.data?.type === "PREPARE_OFFLINE") {
    progressPorts.add(port);
    if (!preparation) preparation = prepareOffline();
    event.waitUntil(preparation);
  }
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEVELOPMENT_ORIGIN || request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const url = new URL(request.url);
        const offline = await offlineResponse("/offline");
        if (offline) return url.pathname === "/offline" ? offline : Response.redirect(new URL("/offline", self.location.origin));
        return await caches.match("/offline.html") ?? Response.error();
      }
    })());
  } else if (cacheableStatic(request)) {
    event.respondWith((async () => {
      // Versioned art and hashed bundles don't redownload on every opening.
      const cached = await (await caches.open(STATIC_CACHE)).match(request) ?? await offlineResponse(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    })());
  }
});
