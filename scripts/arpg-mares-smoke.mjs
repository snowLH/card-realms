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
  if (!pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
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
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 844,
  height: 390,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: 844,
  screenHeight: 390,
});
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await cdp("Page.navigate", { url: appUrl });
await wait(1600);

const buttons = await evaluate(`[...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean)`);
if (buttons.some((text) => /visitante|preview|explorar/i.test(text))) {
  let entered = await clickContaining("visitante");
  if (!entered) entered = await clickContaining("explorar");
  if (!entered) await clickContaining("preview");
  await wait(700);
}
await clickContaining("jogar");
await wait(700);

const opened = await evaluate(`(() => {
  const card = [...document.querySelectorAll('.arpg-expedition-card')]
    .find((item) => item.innerText.includes('Arquipélago das Marés'));
  const button = card?.querySelector('button:not(:disabled)');
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!opened) throw new Error("Não foi possível abrir o Arquipélago das Marés.");
await wait(3600);

const metrics = await evaluate(`(() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height,sw:el.scrollWidth,cw:el.clientWidth,sh:el.scrollHeight,ch:el.clientHeight};
  };
  return {
    document:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth},
    shell:rect('.arpg-shell'),
    canvas:rect('.arpg-stage__canvas canvas'),
    hud:rect('.arpg-hud'),
    topbar:document.querySelector('.arpg-shell__topbar')?.innerText ?? null,
    body:document.body.innerText.slice(0,2200)
  };
})()`);

const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile(
  "C:/Users/user/Documents/ChatGPT/folklard/arquipelago-844x390.png",
  Buffer.from(shot.data, "base64"),
);
await fs.writeFile(
  "C:/Users/user/Documents/ChatGPT/folklard/arquipelago-844x390.json",
  JSON.stringify({ metrics, events }, null, 2),
);

console.log(JSON.stringify({
  document: metrics.document,
  shell: metrics.shell,
  canvas: metrics.canvas,
  hud: metrics.hud,
  topbar: metrics.topbar,
  events: events.length,
}, null, 2));
ws.close();
