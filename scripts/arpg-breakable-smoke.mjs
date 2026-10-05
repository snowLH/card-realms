import fs from "node:fs/promises";
import path from "node:path";

const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://localhost:3100";
const screenshotBefore = path.resolve(process.env.BREAKABLE_BEFORE ?? "breakable-objects-before.png");
const screenshotBroken = path.resolve(process.env.BREAKABLE_AFTER ?? "breakable-objects-broken.png");
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" })
  .then((response) => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let sequence = 0;
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
  const id = ++sequence;
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

async function readDungeon() {
  return evaluate("window.__cardRealmsDungeonDebug?.() ?? null");
}

async function moveStick(dx, dy, ms) {
  const point = await evaluate(`(() => {
    const stick=document.querySelector('.arpg-stick');
    if(!stick) return null;
    const r=stick.getBoundingClientRect();
    const radius=Math.min(r.width,r.height)*0.32;
    return {x:r.left+r.width/2+${dx}*radius,y:r.top+r.height/2+${dy}*radius};
  })()`);
  if (!point) throw new Error("Joystick touch não encontrado.");
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
  await wait(ms);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(180);
}

async function installVirtualGamepad() {
  const installed = await evaluate(`(() => {
    const buttons=Array.from({length:16},()=>({pressed:false,value:0}));
    window.__cardRealmsSmokePad={connected:true,axes:[0,0,0,0],buttons};
    try {
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__cardRealmsSmokePad]});
      return typeof navigator.getGamepads==='function';
    } catch { return false; }
  })()`);
  if (!installed) throw new Error("Gamepad virtual não pôde ser instalado.");
}

async function travelThroughDoor(debug, door) {
  const horizontal = door.direction === "east" || door.direction === "west";
  const axis = horizontal ? "y" : "x";
  const target = horizontal
    ? debug.bounds.y + debug.bounds.height / 2
    : debug.bounds.x + debug.bounds.width / 2;
  const delta = target - debug.player[axis];
  if (Math.abs(delta) > 18) {
    const adjustment = Math.sign(delta);
    const duration = Math.min(1_600, Math.max(260, Math.round(Math.abs(delta) / 220 * 1_000 + 150)));
    await moveStick(horizontal ? 0 : adjustment, horizontal ? adjustment : 0, duration);
  }

  const directions = {
    north: { dx: 0, dy: -1 },
    east: { dx: 1, dy: 0 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 },
  };
  for (let step = 0; step < 10; step += 1) {
    const direction = directions[door.direction];
    await moveStick(direction.dx, direction.dy, 1_250);
    const current = await readDungeon();
    if (current?.room?.id === door.targetRoomId) return current;
  }
  throw new Error(`Não atravessou a porta ${door.direction} para ${door.targetRoomId}.`);
}

async function tapButton(selector) {
  const clicked = await evaluate(`(() => {
    const button=[...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((item)=>{
        const r=item.getBoundingClientRect();
        return item.innerText.trim().toUpperCase()==='JOGAR' && r.width>0 && r.height>0;
      });
    if(!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Botão JOGAR visível não encontrado em: ${selector}`);
  await wait(1_000);
}

async function saveScreenshot(file) {
  const image = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(file, Buffer.from(image.data, "base64"));
}

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 390, deviceScaleFactor: 1, mobile: true,
  screenWidth: 844, screenHeight: 390,
});
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

const progress = {
  version: 4,
  coins: 500,
  xp: 0,
  openedTreasures: [],
  playerRegionId: "roots",
  currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"],
  mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: ["iron-sword", "leather-armor"],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const loadout = {
  weaponId: "iron-sword",
  armorId: "leather-armor",
  relicId: "cartographer-compass",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};
await cdp("Page.navigate", { url: `${appUrl}/?breakableSmoke=${Date.now()}&debugDungeon=1` });
await wait(800);
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(progress))}); true`);
await evaluate(`localStorage.setItem('card-realms-arpg-loadout-v1:guest', ${JSON.stringify(JSON.stringify(loadout))}); true`);
await cdp("Page.reload", { ignoreCache: true });
await wait(1_400);

if (await evaluate("Boolean(document.querySelector('.welcome-view__preview'))")) {
  await evaluate("document.querySelector('.welcome-view__preview')?.click(); true");
  await wait(700);
}
const titlePlay = await evaluate(`(() => {
  const button=[...document.querySelectorAll('.title-screen button')].find((item)=>item.innerText.includes('JOGAR'));
  if(!button) return false;
  button.click();
  return true;
})()`);
if (!titlePlay) throw new Error("Botão JOGAR da abertura não apareceu.");
await wait(900);
await tapButton(".side-nav nav button, .mobile-nav button");
await wait(1_200);
const expeditionPoint = await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')].find((item)=>item.innerText.includes('Mata Encantada'));
  const button=card?.querySelector('button:not(:disabled)');
  if(!button) return null;
  button.scrollIntoView({block:'center',inline:'center'});
  const r=button.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
})()`);
if (!expeditionPoint) {
  const body = await evaluate("document.body.innerText.slice(0,800)");
  throw new Error(`Expedição Mata Encantada não apareceu. Tela atual: ${body}`);
}
await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...expeditionPoint, button: "left", clickCount: 1 });
await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...expeditionPoint, button: "left", clickCount: 1 });
await wait(1_700);
await installVirtualGamepad();

let dungeon = null;
for (let attempt = 0; attempt < 24; attempt += 1) {
  dungeon = await readDungeon();
  if (dungeon?.room?.id) break;
  await wait(350);
}
if (!dungeon?.room?.id) {
  const page = await evaluate("JSON.stringify({url:location.href,body:document.body.innerText.slice(0,1200)})");
  throw new Error(`Debug da dungeon não ficou disponível após a entrada: ${page}`);
}
if (dungeon.room.type === "start") {
  const door = dungeon.doors.find((item) => dungeon.rooms.find((room) => room.id === item.targetRoomId)?.type !== "start");
  if (!door) throw new Error("A sala inicial não tem porta de saída válida.");
  dungeon = await travelThroughDoor(dungeon, door);
}
let props = dungeon.breakables?.filter((item) => item.roomId === dungeon.room.id && item.active && item.hitPoints > 0) ?? [];
if (!props.length) throw new Error(`A sala ${dungeon.room.id} não tem prop quebrável ativo: ${JSON.stringify(dungeon.breakables)}`);

const player = dungeon.player;
const targetProp = [...props].sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
const approached = await evaluate(`window.__cardRealmsDungeonMoveToWorld?.(${targetProp.x},${targetProp.y}) ?? false`);
if (!approached) throw new Error("O personagem não encontrou caminho até o prop.");
let distanceToProp = Number.POSITIVE_INFINITY;
for (let attempt = 0; attempt < 30; attempt += 1) {
  await wait(160);
  dungeon = await readDungeon();
  const currentPlayer = dungeon.player;
  const currentProp = dungeon.breakables.find((item) => item.id === targetProp.id);
  distanceToProp = Math.hypot(currentProp.x - currentPlayer.x, currentProp.y - currentPlayer.y);
  if (distanceToProp <= 112) break;
}
if (distanceToProp > 112) throw new Error(`O personagem parou a ${Math.round(distanceToProp)} px do prop.`);

const initialProp = dungeon.breakables.find((item) => item.id === targetProp.id);
const initialRunShards = dungeon.runShards;
await saveScreenshot(screenshotBefore);
const dx = initialProp.x - dungeon.player.x;
const dy = initialProp.y - dungeon.player.y;
const aimLength = Math.hypot(dx, dy) || 1;
await evaluate(`(() => {
  const pad=window.__cardRealmsSmokePad;
  pad.axes[2]=${Math.abs(dx) + Math.abs(dy) < 8 ? 1 : dx / aimLength};
  pad.axes[3]=${Math.abs(dx) + Math.abs(dy) < 8 ? 0 : dy / aimLength};
  pad.buttons[0]={pressed:true,value:1};
  return true;
})()`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(90);
    dungeon = await readDungeon();
    const currentProp = dungeon.breakables.find((item) => item.id === targetProp.id);
    if (!currentProp?.active) break;
  }
await evaluate(`(() => { const pad=window.__cardRealmsSmokePad; if(pad) pad.buttons[0]={pressed:false,value:0}; return true; })()`);
await wait(90);
dungeon = await readDungeon();
const finalProp = dungeon.breakables.find((item) => item.id === targetProp.id);
await saveScreenshot(screenshotBroken);

const significantErrors = events.filter((event) => {
  if (event.method === "Network.loadingFailed" && event.params?.canceled) return false;
  const text = event.params?.entry?.text ?? "";
  if (text.includes("beforeinstallpromptevent.preventDefault")) return false;
  if (text.includes("AudioContext was not allowed to start")) return false;
  return true;
});
const result = {
  room: dungeon.room,
  weaponId: loadout.weaponId,
  initialProp,
  finalProp,
  distanceToProp: Math.round(distanceToProp),
  screenshotBefore,
  screenshotBroken,
  checks: {
    nonStartRoom: dungeon.room.type !== "start",
    propApproached: distanceToProp <= 112,
    propDamaged: finalProp.hitPoints < initialProp.hitPoints,
    propDestroyed: !finalProp.active && finalProp.hitPoints === 0,
    fragmentGranted: dungeon.runShards >= initialRunShards + 1,
    noRuntimeErrors: significantErrors.length === 0,
  },
  events: significantErrors.map((event) => ({ method: event.method, params: event.params })),
};
console.log(JSON.stringify(result, null, 2));
ws.close();
if (Object.values(result.checks).some((passed) => !passed)) process.exitCode = 1;
