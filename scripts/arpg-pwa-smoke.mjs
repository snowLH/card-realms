const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3100";
const appOrigin = new URL(appUrl);
if (!new Set(["localhost", "127.0.0.1", "::1"]).has(appOrigin.hostname)
  && !appOrigin.hostname.endsWith(".localhost")) {
  throw new Error("O smoke PWA limpa estado local; APP_URL deve apontar para localhost ou loopback.");
}
const serviceWorkerResponse = await fetch(new URL("/sw.js", appUrl));
if (!serviceWorkerResponse.ok) throw new Error(`Service worker indisponível: HTTP ${serviceWorkerResponse.status}`);
const serviceWorkerSource = await serviceWorkerResponse.text();
const cacheVersion = serviceWorkerSource.match(/const CACHE_VERSION = "([^"]+)"/)?.[1];
const coreAssetsBody = serviceWorkerSource.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1];
if (!cacheVersion || !coreAssetsBody) throw new Error("Não foi possível ler a versão e os assets essenciais do service worker.");
const previousCacheVersion = cacheVersion.replace(/-v(\d+)$/, (_, version) => `-v${Number(version) - 1}`);
if (previousCacheVersion === cacheVersion) throw new Error(`Versão do cache fora do formato esperado: ${cacheVersion}`);
const staticCacheName = `${cacheVersion}-static`;
const previousStaticCacheName = `${previousCacheVersion}-static`;
const expectedCachePaths = [...coreAssetsBody.matchAll(/"([^\"]+)"/g)].map((match) => match[1]);
const requiredGameAssets = [
  "/art/guild-bestiary-keeper-spritesheet.png",
  "/art/treasure-chest-spritesheet-v2.png",
];
const expectedIcons = [
  { src: "/icon.svg", size: null, purpose: "any" },
  { src: "/icons/card-realms-192.png", size: 192, purpose: "any" },
  { src: "/icons/card-realms-512.png", size: 512, purpose: "any" },
  { src: "/icons/card-realms-maskable-512.png", size: 512, purpose: "maskable" },
];
if (!expectedIcons.every((icon) => expectedCachePaths.includes(icon.src))) {
  throw new Error("O service worker não inclui todos os ícones PWA esperados no cache essencial.");
}
if (!requiredGameAssets.every((asset) => expectedCachePaths.includes(asset))) {
  throw new Error("O service worker não inclui todos os sprites NPC essenciais ao HUB.");
}

const target = await fetch(`${debugBase}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })
  .then((response) => {
    if (!response.ok) throw new Error(`CDP new target falhou: HTTP ${response.status}`);
    return response.json();
  });
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  if (message.error) item.reject(new Error(message.error.message));
  else item.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Storage.clearDataForOrigin", {
  origin: new URL(appUrl).origin,
  storageTypes: "service_workers,cache_storage",
});
await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const originalRegister = ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register = async function(...args) {
      const legacyCache = await caches.open(${JSON.stringify(previousStaticCacheName)});
      await legacyCache.put(
        new URL("/__pwa-upgrade-probe__", location.origin),
        new Response("legacy cache probe"),
      );
      window.__legacyCacheSeeded = true;
      return originalRegister.apply(this, args);
    };
  })();`,
});
await cdp("Page.navigate", { url: appUrl });

let report;
for (let attempt = 0; attempt < 30; attempt += 1) {
  await wait(500);
  report = await evaluate(`(async () => {
    const ready = document.readyState === "complete";
    const registration = (await navigator.serviceWorker?.getRegistrations?.() ?? [])
      .find((item) => item.scope === location.origin + "/");
    const cacheNames = await caches.keys();
    const staticCacheName = ${JSON.stringify(staticCacheName)};
    const cachedPaths = cacheNames.includes(staticCacheName)
      ? await caches.open(staticCacheName).then((cache) => cache.keys()).then((keys) => keys.map((key) => new URL(key.url).pathname))
      : [];
    if (!ready || registration?.active?.state !== "activated"
      || !${JSON.stringify(expectedCachePaths)}.every((path) => cachedPaths.includes(path))) return null;

    const manifestResponse = await fetch("/manifest.webmanifest", { cache: "no-store" });
    const manifest = await manifestResponse.json();
    const icons = await Promise.all(${JSON.stringify(expectedIcons)}.map(async (expected) => {
      const declared = manifest.icons?.find((icon) => icon.src === expected.src);
      const response = await fetch(expected.src, { cache: "no-store" });
      let dimensions = null;
      if (expected.size) {
        const image = await createImageBitmap(await response.blob());
        dimensions = { width: image.width, height: image.height };
        image.close();
      }
      return {
        ...expected,
        declared: Boolean(declared && (!expected.size || declared.sizes === expected.size + "x" + expected.size)
          && (!expected.purpose || declared.purpose === expected.purpose)),
        status: response.status,
        contentType: response.headers.get("content-type"),
        dimensions,
      };
    }));
    const appleLink = document.querySelector('link[rel="apple-touch-icon"]');
    let appleIcon = null;
    if (appleLink) {
      const response = await fetch(appleLink.href, { cache: "no-store" });
      const image = await createImageBitmap(await response.blob());
      appleIcon = {
        path: new URL(appleLink.href).pathname,
        status: response.status,
        contentType: response.headers.get("content-type"),
        dimensions: { width: image.width, height: image.height },
      };
      image.close();
    }
    return {
      manifest: {
        status: manifestResponse.status,
        name: manifest.name,
        shortName: manifest.short_name,
        startUrl: manifest.start_url,
        display: manifest.display,
        orientation: manifest.orientation,
      },
      serviceWorker: { scope: registration.scope, state: registration.active.state },
      icons,
      appleIcon,
      cacheNames,
      staticCacheName,
      cachedPaths,
      legacyCacheSeeded: window.__legacyCacheSeeded === true,
    };
  })()`);
  if (report) break;
}

const result = {
  ...(report ?? { error: "Página ou service worker não ficou pronto em 15 segundos." }),
  checks: {
    manifestServed: report?.manifest.status === 200,
    standaloneLandscape: report?.manifest.display === "standalone" && report?.manifest.orientation === "landscape",
    serviceWorkerActive: report?.serviceWorker.state === "activated",
    requiredIconsDeclaredAndServed: report?.icons.length === expectedIcons.length
      && report.icons.every((icon) => icon.declared && icon.status === 200),
    rasterDimensionsValid: report?.icons.filter((icon) => icon.size).every((icon) =>
      icon.dimensions?.width === icon.size && icon.dimensions?.height === icon.size),
    appleTouchIcon: report?.appleIcon?.path === "/apple-icon.png"
      && report.appleIcon.status === 200
      && report.appleIcon.contentType?.includes("image/png")
      && report.appleIcon.dimensions?.width === 180
      && report.appleIcon.dimensions?.height === 180,
    coreIconsCached: expectedCachePaths.every((iconPath) => report?.cachedPaths.includes(iconPath)),
    bestiaryKeeperCached: requiredGameAssets.every((asset) => report?.cachedPaths.includes(asset)),
    legacyCacheSeeded: report?.legacyCacheSeeded === true,
    previousCacheRemoved: !report?.cacheNames.includes(previousStaticCacheName),
  },
};
console.log(JSON.stringify(result, null, 2));
await cdp("Page.close").catch(() => undefined);
ws.close();
if (Object.values(result.checks).some((passed) => !passed)) process.exitCode = 1;
