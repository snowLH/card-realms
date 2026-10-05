import fs from "node:fs/promises";

const debugBase = "http://127.0.0.1:9224";
const appUrl = "http://localhost:3110";
const localProgress = {
  version: 4,
  coins: 500,
  xp: 0,
  openedTreasures: [],
  playerRegionId: "roots",
  currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"],
  mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: [
    "iron-sword", "forest-bow", "ritual-staff", "tide-blade", "river-bow", "iara-song-staff",
    "leather-armor", "forest-guardian-armor", "ritual-cloak", "river-shell-armor", "kelpie-mist-cloak", "ahuizotl-guard-armor",
    "support-saci", "support-iara",
  ],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const [resolve, reject] = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, [resolve, reject]);
  ws.send(JSON.stringify({ id, method, params }));
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await cdp("Page.enable");
await cdp("Runtime.enable");

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result.value;
}

async function openArsenal() {
  const preview = await evaluate(`(() => {
    const button=document.querySelector('.welcome-view__preview');
    if(!button) return false;
    button.click();
    return true;
  })()`);
  if (preview) await wait(700);
  const opened = await evaluate(`(() => {
    const button=[...document.querySelectorAll('.side-nav nav button,.mobile-nav button')]
      .find((item)=>item.innerText.trim().toLowerCase()==='arsenal');
    if(!button) return false;
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error("Não encontrei o botão Arsenal na navegação atual.");
  await wait(700);
}
async function audit(label, width, height, mobile) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
  });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 5 });
  await cdp("Page.navigate", { url: appUrl });
  await wait(900);
  await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(localProgress))}); true`);
  await cdp("Page.reload", { ignoreCache: true });
  await wait(1200);
  await openArsenal();

  const metrics = await evaluate(`(() => {
    const box = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height,sw:el.scrollWidth,cw:el.clientWidth};
    };
    return {
      viewport:{w:innerWidth,h:innerHeight},
      document:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth},
      view:box('.arpg-loadout-view'),
      hero:box('.arpg-loadout-hero'),
      summary:box('.arpg-loadout-summary'),
      disabled:[...document.querySelectorAll('.arpg-loadout-grid button:disabled')].map(b=>b.innerText.trim()),
      selected:[...document.querySelectorAll('.arpg-loadout-grid button.is-selected')].map(b=>b.innerText.trim()),
      effects:[...document.querySelectorAll('.arpg-loadout-grid--equipment em')].map(e=>e.innerText.trim()),
      body:document.body.innerText.slice(0,5000)
    };
  })()`);
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(
    `C:/Users/user/Documents/ChatGPT/folklard/arsenal-${label}.png`,
    Buffer.from(shot.data, "base64"),
  );
  await fs.writeFile(
    `C:/Users/user/Documents/ChatGPT/folklard/arsenal-${label}.json`,
    JSON.stringify(metrics, null, 2),
  );
  console.log(label, JSON.stringify({
    viewport: metrics.viewport,
    document: metrics.document,
    overflow: metrics.document.sw !== metrics.document.cw,
    view: metrics.view,
    disabled: metrics.disabled.length,
    selected: metrics.selected.length,
    effects: metrics.effects.length,
  }));
}

for (const [label, width, height, mobile] of [
  ["1366x768", 1366, 768, false],
  ["390x844", 390, 844, true],
  ["844x390", 844, 390, true],
]) {
  await audit(label, width, height, mobile);
}
ws.close();
