const CACHE_VERSION = "folklard-arpg-v21";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DEVELOPMENT_ORIGIN = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);
const CORE_ASSETS = [
  "/icon.svg",
  "/icons/card-realms-192.png",
  "/icons/card-realms-512.png",
  "/icons/card-realms-maskable-512.png",
  "/apple-icon.png",
  "/art/forest-sanctuary-arena-v2.webp",
  "/art/folklore-creatures-chibi-portraits-v1.webp",
  "/art/folklore-creatures-second-atlas-chibi-portraits-v1.webp",
  "/art/monster-curupira-ancestral-spritesheet-v2.webp",
  "/art/monster-amarok-elder-wolf-spritesheet-v2.webp",
  "/art/monster-iara-boss-spritesheet-v2.webp",
  "/art/monster-sprout-spritesheet-v1.webp",
  "/art/monster-boto-enemy-spritesheet-v1.webp",
  "/art/monster-raiju-enemy-spritesheet-v1.webp",
  "/art/guild-blacksmith-spritesheet-v1.webp",
  "/art/guild-merchant-spritesheet-v1.webp",
  "/art/guild-archivist-spritesheet-v1.webp",
  "/art/guild-bestiary-keeper-spritesheet-v1.webp",
  "/art/folklard-title-forest-portal-pixel-v3.webp",
  "/art/guild-room-wide-background-v2.webp",
  "/art/refuge-pixel-v2.webp",
  "/art/village-tavern-pixel-v2.webp",
  "/art/world-map-pixel-v2.webp",
  "/art/treasure-chest-spritesheet-v2.webp",
];

self.addEventListener("install", (event) => {
  if (DEVELOPMENT_ORIGIN) {
    event.waitUntil(self.skipWaiting());
    return;
  }
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
        .filter((key) => key.startsWith("card-realms-") && (DEVELOPMENT_ORIGIN || key !== STATIC_CACHE))
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
  // Development chunks keep the same URLs between rebuilds; never serve an old bundle.
  if (DEVELOPMENT_ORIGIN || request.method !== "GET" || !isCacheableStatic(request)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      return cached ?? Response.error();
    }
  })());
});
