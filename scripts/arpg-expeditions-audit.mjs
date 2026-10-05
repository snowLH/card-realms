import fs from "node:fs/promises";

const debugBase = "http://127.0.0.1:9222";
const appUrl = "http://localhost:3110";
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

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

async function clickContaining(text) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}
async function openExpeditions() {
  const labels = await evaluate(`[...document.querySelectorAll('button')].map((button) => button.innerText.trim()).filter(Boolean)`);
  if (labels.some((label) => /visitante|preview|explorar/i.test(label))) {
    let entered = await clickContaining("visitante");
    if (!entered) entered = await clickContaining("preview");
    if (!entered) await clickContaining("explorar");
    await wait(700);
  }
  const opened = await clickContaining("jogar");
  if (!opened) throw new Error("Não encontrei o botão Jogar.");
  await wait(600);
}

async function audit(label, width, height, mobile) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
  });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 5 });
  await cdp("Page.navigate", { url: appUrl });
  await wait(1100);
  await openExpeditions();

  const metrics = await evaluate(`(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, sw: element.scrollWidth, cw: element.clientWidth };
    };
    return {
      document: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
      view: box('.arpg-expeditions'),
      hero: box('.arpg-expeditions__hero'),
      cards: [...document.querySelectorAll('.arpg-expedition-card')].map((card) => card.innerText.slice(0, 500)),
      disabled: document.querySelectorAll('.arpg-expedition-card button:disabled').length,
    };
  })()`);

  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(
    `C:/Users/user/Documents/ChatGPT/folklard/expeditions-${label}.png`,
    Buffer.from(shot.data, "base64"),
  );
  console.log(label, JSON.stringify(metrics));
}

for (const [label, width, height, mobile] of [
  ["1366x768", 1366, 768, false],
  ["390x844", 390, 844, true],
  ["844x390", 844, 390, true],
]) {
  await audit(label, width, height, mobile);
}

ws.close();
