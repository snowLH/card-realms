import fs from "node:fs/promises";

const debugBase = "http://127.0.0.1:9222";
const appUrl = "http://localhost:3110";
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) {
    if (["Runtime.exceptionThrown", "Log.entryAdded", "Network.loadingFailed"].includes(message.method)) events.push(message);
    return;
  }
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  if (message.error) item.reject(new Error(message.error.message));
  else item.resolve(message.result);
});
function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result.value;
}

async function clickContaining(text) {
  return evaluate(`(() => {
    const button=[...document.querySelectorAll('button')]
      .find((item)=>item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if(!button) return false;
    button.click();
    return true;
  })()`);
}
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1366,
  height: 768,
  deviceScaleFactor: 1,
  mobile: false,
  screenWidth: 1366,
  screenHeight: 768,
});
await cdp("Page.navigate", { url: appUrl });
await wait(900);

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
  equipmentIds: ["kappa-splash"],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(localProgress))}); true`);
await cdp("Page.reload", { ignoreCache: true });
await wait(1200);

const welcomeButtons = await evaluate(`[...document.querySelectorAll('button')].map((b)=>b.innerText.trim()).filter(Boolean)`);
if (welcomeButtons.some((text) => /visitante|preview|explorar/i.test(text))) {
  let entered = await clickContaining("visitante");
  if (!entered) entered = await clickContaining("explorar");
  if (!entered) await clickContaining("preview");
  await wait(700);
}

await clickContaining("arsenal");
await wait(700);
const cardStateBefore = await evaluate(`(() => {
  const button=[...document.querySelectorAll('.arpg-ability-collection button')]
    .find((item)=>item.innerText.includes('Impacto do Kappa'));
  return button ? { disabled: button.disabled, text: button.innerText } : null;
})()`);

await evaluate(`document.querySelector('.arpg-ability-slots button')?.click(); true`);
await clickContaining("Impacto do Kappa");
await wait(500);
const slotAfter = await evaluate(`document.querySelector('.arpg-ability-slots button')?.innerText ?? ''`);
const savedLoadout = await evaluate(`localStorage.getItem('card-realms-arpg-loadout-v1:guest')`);
await clickContaining("Escolher expedição");
await wait(700);
const selectedExpedition = await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')]
    .find((item)=>item.innerText.includes('Arquipélago das Marés'));
  const button=card?.querySelector('button');
  if(!button) return false;
  button.click();
  return true;
})()`);
await wait(1800);

const dungeonState = await evaluate(`(() => ({
  title: document.querySelector('.arpg-topbar strong')?.innerText ?? '',
  body: document.body.innerText,
  width: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  canvas: document.querySelector('canvas') ? true : false,
}))()`);

await evaluate(`window.focus(); document.querySelector('canvas')?.focus(); true`);
await cdp("Input.dispatchKeyEvent", {
  type: "rawKeyDown",
  code: "Digit1",
  key: "1",
  windowsVirtualKeyCode: 49,
  nativeVirtualKeyCode: 49,
});
await wait(120);
await cdp("Input.dispatchKeyEvent", {
  type: "keyUp",
  code: "Digit1",
  key: "1",
  windowsVirtualKeyCode: 49,
  nativeVirtualKeyCode: 49,
});
await wait(450);
const activationText = await evaluate(`document.body.innerText`);

const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile("C:/Users/user/Documents/ChatGPT/folklard/arpg-card-loadout-smoke.png", Buffer.from(screenshot.data, "base64"));
console.log(JSON.stringify({
  cardStateBefore,
  slotAfter,
  savedLoadout: savedLoadout ? JSON.parse(savedLoadout) : null,
  selectedExpedition,
  dungeon: {
    title: dungeonState.title,
    canvas: dungeonState.canvas,
    overflow: dungeonState.width !== dungeonState.clientWidth,
    hasKappaCard: dungeonState.body.includes("Impacto do Kappa"),
    activatedKappa: activationText.includes("Impacto do Kappa ativada"),
  },
  events: events.map((event) => ({ method: event.method, params: event.params })),
}, null, 2));

ws.close();
