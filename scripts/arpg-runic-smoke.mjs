import fs from "node:fs/promises";

const debugBase = "http://127.0.0.1:9224";
const appUrl = "http://localhost:3110/?debugDungeon=1";
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

if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
  await evaluate(`document.querySelector('.welcome-view__preview')?.click(); true`);
  await wait(700);
}
const openedExpeditions = await evaluate(`(() => {
  const button=[...document.querySelectorAll('.mobile-nav button,.side-nav nav button')]
    .find((item)=>item.innerText.trim().toUpperCase()==='JOGAR');
  if(!button) return false;
  button.click();
  return true;
})()`);
if (!openedExpeditions) throw new Error("Navegação Jogar não encontrada.");
await wait(900);

const opened = await evaluate(`(() => {
  const card = [...document.querySelectorAll('.arpg-expedition-card')]
    .find((item) => item.innerText.includes('Montanhas Rúnicas'));
  const button = card?.querySelector('button:not(:disabled)');
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!opened) throw new Error("Não foi possível abrir as Montanhas Rúnicas.");
await wait(3600);

const beforeMove = await evaluate(`window.__cardRealmsDungeonDebug?.() ?? null`);
if (!beforeMove?.player?.active) throw new Error("Diagnóstico da dungeon indisponível para validar movimento por toque.");
const canvasRect = await evaluate(`(() => {
  const rect = document.querySelector('.arpg-stage__canvas canvas')?.getBoundingClientRect();
  return rect ? {x:rect.x,y:rect.y,w:rect.width,h:rect.height} : null;
})()`);
if (!canvasRect) throw new Error("Canvas da dungeon indisponível para validar movimento por toque.");

const moveRight = { x: canvasRect.x + canvasRect.w * 0.59, y: canvasRect.y + canvasRect.h * 0.5 };
await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...moveRight, button: "none" });
await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...moveRight, button: "left", clickCount: 1 });
await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...moveRight, button: "left", clickCount: 1 });
await wait(850);
const afterMouseMove = await evaluate(`window.__cardRealmsDungeonDebug?.() ?? null`);
const mouseMoveDistance = Math.hypot(
  (afterMouseMove?.player?.x ?? beforeMove.player.x) - beforeMove.player.x,
  (afterMouseMove?.player?.y ?? beforeMove.player.y) - beforeMove.player.y,
);

const moveLeft = { x: canvasRect.x + canvasRect.w * 0.41, y: canvasRect.y + canvasRect.h * 0.5 };
await cdp("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: moveLeft.x, y: moveLeft.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
});
await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await wait(850);
const afterTouchMove = await evaluate(`window.__cardRealmsDungeonDebug?.() ?? null`);
const touchMoveDistance = Math.hypot(
  (afterTouchMove?.player?.x ?? afterMouseMove?.player?.x ?? beforeMove.player.x) - (afterMouseMove?.player?.x ?? beforeMove.player.x),
  (afterTouchMove?.player?.y ?? afterMouseMove?.player?.y ?? beforeMove.player.y) - (afterMouseMove?.player?.y ?? beforeMove.player.y),
);

const nextRoomId = beforeMove.doors?.[0]?.targetRoomId ?? null;
const nextRoom = beforeMove.rooms?.find((room) => room.id === nextRoomId) ?? null;
if (!nextRoom) throw new Error("A porta inicial não aponta para uma sala para testar travessia automática.");
const neighborCenter = {
  x: beforeMove.player.x + (nextRoom.gridX - beforeMove.room.gridX) * 896,
  y: beforeMove.player.y + (nextRoom.gridY - beforeMove.room.gridY) * 896,
};
const clickPathStarted = await evaluate(`window.__cardRealmsDungeonMoveToWorld?.(${neighborCenter.x}, ${neighborCenter.y}) ?? false`);
await wait(5200);
const afterRoomMove = await evaluate(`window.__cardRealmsDungeonDebug?.() ?? null`);
const crossedIntoNeighborRoom = afterRoomMove?.room?.id === nextRoomId;

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
    secondAtlasLoaded: performance.getEntriesByType('resource')
      .some((entry) => entry.name.includes('folklore-creatures-second-atlas-chibi-portraits-v1.webp')),
    body:document.body.innerText.slice(0,2200)
  };
})()`);
metrics.clickMove = {
  mouseMoveDistance,
  touchMoveDistance,
  clickPathStarted,
  nextRoomId,
  roomAfterCorridor: afterRoomMove?.room?.id ?? null,
  crossedIntoNeighborRoom,
  before: beforeMove.player,
  afterMouse: afterMouseMove?.player ?? null,
  afterTouch: afterTouchMove?.player ?? null,
};

const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile(
  "C:/Users/user/Documents/ChatGPT/folklard/montanhas-runicas-844x390.png",
  Buffer.from(shot.data, "base64"),
);
await fs.writeFile(
  "C:/Users/user/Documents/ChatGPT/folklard/montanhas-runicas-844x390.json",
  JSON.stringify({ metrics, events }, null, 2),
);

const fatalEvents = events.filter((event) => {
  if (event.method === "Runtime.exceptionThrown") return true;
  const entry = event.params?.entry;
  return entry?.level === "error" && !String(entry?.text ?? "").includes("beforeinstallprompt");
});
const checks = {
  canvasReady: Boolean(metrics.canvas),
  noHorizontalOverflow: metrics.document.sw === metrics.document.cw,
  secondAtlasLoaded: metrics.secondAtlasLoaded === true,
  runicMessage: String(metrics.topbar ?? "").includes("Montanhas Rúnicas"),
  mouseClickMovesPlayer: mouseMoveDistance >= 24,
  touchTapMovesPlayer: touchMoveDistance >= 24,
  clickPathCrossesOpenDoor: clickPathStarted && crossedIntoNeighborRoom,
  noFatalRuntimeErrors: fatalEvents.length === 0,
};
console.log(JSON.stringify({ ...metrics, checks, fatalEvents }, null, 2));
ws.close();
const failed = Object.entries(checks).filter(([, value]) => value !== true);
if (failed.length > 0) throw new Error(`Smoke rúnico falhou: ${failed.map(([key]) => key).join(", ")}`);
