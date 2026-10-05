const CACHE_VERSION = "card-realms-arpg-v15";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CORE_ASSETS = [
  "/icon.svg",
  "/icons/card-realms-192.png",
  "/icons/card-realms-512.png",
  "/icons/card-realms-maskable-512.png",
  "/apple-icon.png",
  "/art/forest-sanctuary-arena-v2.png",
  "/art/folklore-creatures-five-elements.png",
  "/art/folklore-creatures-second-atlas.png",
  "/art/curupira-boss-spritesheet.png",
  "/art/amarok-boss-spritesheet-v2.png",
  "/art/iara-boss-spritesheet.png",
  "/art/sprout-enemy-spritesheet.png",
  "/art/boto-enemy-spritesheet.png",
  "/art/raiju-enemy-spritesheet.png",
  "/art/guild-blacksmith-spritesheet.png",
  "/art/guild-merchant-spritesheet.png",
  "/art/guild-archivist-spritesheet.png",
  "/art/guild-bestiary-keeper-spritesheet.png",
  "/art/title-screen-forest-portal.png",
  "/art/treasure-chest-spritesheet-v2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("card-realms-") && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableStatic(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return false;
  if (request.mode === "navigate") return false;
  return url.pathname.startsWith("/art/")
    || url.pathname.startsWith("/_next/static/")
    || ["image", "font", "style", "script", "audio"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isCacheableStatic(request)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      event.waitUntil(fetch(request)
        .then((response) => response.ok
          ? caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()))
          : undefined)
        .catch(() => undefined));
      return cached;
    }

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
