import fs from "node:fs/promises";

const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3111";
const seedSuffix = process.env.ARPG_SMOKE_SEED_SUFFIX ?? "river-visual-10";
const expectedSeed = `mata-encantada:${seedSuffix}`;
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(`${appUrl}/?riverSmoke=${Date.now()}&debugDungeon=1`)}`, { method: "PUT" })
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
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}
async function clickPoint(point) {
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}
async function pressKey(key, code, windowsVirtualKeyCode) {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode });
  await wait(140);
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
}
async function waitFor(selector, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return true;
    await wait(250);
  }
  return false;
}
async function readDungeon() {
  return evaluate(`(() => {
    const debug=typeof window.__cardRealmsDungeonDebug === 'function' ? window.__cardRealmsDungeonDebug() : null;
    const current=debug?.room;
    return {
      seed:debug?.seed ?? null,
      current,
      currentTemplate:debug?.rooms?.find((room)=>room.id===current?.id)?.templateId ?? null,
      rooms:debug?.rooms ?? [],
      doors:debug?.doors ?? [],
      player:debug?.player ?? null,
      bounds:debug?.bounds ?? null,
      runtime:debug?.runtime ?? null,
    };
  })()`);
}
async function setPad(dx, dy) {
  await evaluate(`(() => {
    if (!window.__cardRealmsSmokePad) return false;
    window.__cardRealmsSmokePad.axes[0]=${dx};
    window.__cardRealmsSmokePad.axes[1]=${dy};
    return true;
  })()`);
}
async function movePad(dx, dy, duration) {
  await setPad(dx, dy);
  await wait(duration);
  await setPad(0, 0);
  await wait(180);
}
async function installVirtualGamepad() {
  const installed = await evaluate(`(() => {
    const buttons=Array.from({length:16},()=>({pressed:false,value:0}));
    window.__cardRealmsSmokePad={connected:true,axes:[0,0,0,0],buttons};
    try {
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__cardRealmsSmokePad]});
      return typeof navigator.getGamepads === 'function';
    } catch { return false; }
  })()`);
  if (!installed) throw new Error("Não foi possível instalar o gamepad virtual.");
}
async function enterNextRoom(initial, targetRoomId) {
  const connection = initial.doors.find((door) => door.targetRoomId === targetRoomId);
  const bounds = initial.bounds;
  if (!connection || !bounds) throw new Error(`Porta da sala fluvial ausente: ${JSON.stringify(initial.doors)}`);
  const vectors = {
    north: { dx: 0, dy: -1 },
    east: { dx: 1, dy: 0 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 },
  };
  const direction = vectors[connection.direction];
  if (!direction) throw new Error(`Direção da porta inválida: ${connection.direction}`);
  const horizontal = direction.dx !== 0;
  const center = horizontal ? bounds.y + bounds.height / 2 : bounds.x + bounds.width / 2;
  const current = horizontal ? initial.player?.y : initial.player?.x;
  if (current != null && Math.abs(center - current) > 20) {
    const adjustment = Math.sign(center - current);
    const duration = Math.min(1400, Math.max(260, Math.round(Math.abs(center - current) / 220 * 1000 + 150)));
    await movePad(horizontal ? 0 : adjustment, horizontal ? adjustment : 0, duration);
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await movePad(direction.dx, direction.dy, 1250);
    const currentDungeon = await readDungeon();
    if (currentDungeon.current?.id === targetRoomId) return currentDungeon;
  }
  throw new Error(`Não consegui entrar na sala ${targetRoomId}. Estado: ${JSON.stringify(await readDungeon())}`);
}

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false, screenWidth: 1366, screenHeight: 768 });
await cdp("Emulation.setTouchEmulationEnabled", { enabled: false, maxTouchPoints: 1 });
await cdp("Page.navigate", { url: `${appUrl}/?riverSmoke=${Date.now()}&debugDungeon=1` });
await wait(900);
const progress = {
  version: 4, coins: 500, xp: 0, openedTreasures: [], playerRegionId: "roots", currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"], mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: ["iara-song-staff", "ahuizotl-guard-armor"],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const loadout = {
  weaponId: "iara-song-staff", armorId: "ahuizotl-guard-armor", relicId: "cartographer-compass",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(progress))}); localStorage.setItem('card-realms-arpg-loadout-v1:guest', ${JSON.stringify(JSON.stringify(loadout))}); true`);
await cdp("Page.reload", { ignoreCache: true });
await wait(1400);
if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
  await evaluate(`document.querySelector('.welcome-view__preview')?.click(); true`);
  await wait(800);
}
await evaluate(`document.querySelector('.title-screen__play')?.click(); true`);
if (!await waitFor(".arpg-hub-stage canvas")) throw new Error("Guilda jogável não carregou.");
await evaluate(`(() => {
  window.focus();
  const canvas=document.querySelector('.arpg-hub-stage canvas');
  if(canvas){canvas.tabIndex=0;canvas.focus();}
  return Boolean(canvas && document.activeElement===canvas);
})()`);
const cartographerPoint = await evaluate(`(() => {
  const rect=document.querySelector('.arpg-hub-stage canvas')?.getBoundingClientRect();
  return rect?{x:rect.x+rect.width*0.5,y:rect.y+rect.height*0.15}:null;
})()`);
if (!cartographerPoint) throw new Error("Canvas da Guilda ausente.");
await clickPoint(cartographerPoint);
await wait(1400);
const approachPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
if (!/Cartógrafo|Expedições/i.test(approachPrompt)) {
  await pressKey("w", "KeyW", 1100);
  await wait(250);
}
await pressKey("e", "KeyE", 69);
if (!await waitFor(".arpg-expeditions")) {
  await evaluate(`([...document.querySelectorAll('.arpg-hub-topbar button')]
    .find((button)=>button.textContent?.includes('Menu clássico')))?.click(); true`);
  if (!await waitFor(".hub-continue")) throw new Error("Nem o Cartógrafo nem a entrada clássica chegaram às expedições.");
  const continuePoint = await evaluate(`(() => {
    const rect=document.querySelector('.hub-continue')?.getBoundingClientRect();
    return rect?{x:rect.x+rect.width/2,y:rect.y+rect.height/2}:null;
  })()`);
  if (!continuePoint) throw new Error("Atalho clássico de expedição indisponível.");
  await clickPoint(continuePoint);
  if (!await waitFor(".arpg-expeditions")) throw new Error("O atalho clássico não abriu as expedições.");
}
await cdp("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true, screenWidth: 844, screenHeight: 390 });
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await wait(350);
const seeded = await evaluate(`(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const requestUrl = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (requestUrl.pathname === '/api/arpg/run' && JSON.parse(init.body ?? '{}').action === 'start') {
      return new Response(JSON.stringify({
        token: 'river-visual-smoke',
        runSeed: ${JSON.stringify(expectedSeed)},
        checkpoint: {},
        persistent: false,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return originalFetch(input, init);
  };
  return true;
})()`);
if (!seeded) throw new Error("Não consegui fixar a seed reproduzível do smoke.");
const expeditionPoint = await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')].find((item)=>item.innerText.includes('Mata Encantada'));
  const button=card?.querySelector('button:not(:disabled)');
  if(!button) return null;
  button.scrollIntoView({block:'center',inline:'center'});
  const rect=button.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
})()`);
if (!expeditionPoint) throw new Error("Card da Mata Encantada indisponível.");
await clickPoint(expeditionPoint);
await wait(1700);
await installVirtualGamepad();
await evaluate(`window.focus(); document.querySelector('canvas')?.setAttribute('tabindex','0'); document.querySelector('canvas')?.focus(); true`);
let initial = await readDungeon();
for (let attempt = 0; attempt < 32 && !initial.rooms.length; attempt += 1) {
  await wait(250);
  initial = await readDungeon();
}
if (initial.seed !== expectedSeed) throw new Error(`Seed divergente: esperado ${expectedSeed}, recebido ${initial.seed}`);
const riverRoom = initial.rooms.find((room) => room.templateId === "mata-combat-river");
const startRoom = initial.rooms.find((room) => room.id === initial.current?.id);
const riverNeighbor = riverRoom && Object.values(startRoom?.connections ?? {}).includes(riverRoom.id);
if (!riverRoom || !riverNeighbor) throw new Error(`A seed não posicionou a sala fluvial junto à entrada: ${JSON.stringify(initial.rooms)}`);
const riverState = await enterNextRoom(initial, riverRoom.id);
await pressKey("Tab", "Tab", 9);
await wait(180);
const mapState = await readDungeon();
const mapDialogAccessible = await evaluate(`Boolean(document.querySelector('.arpg-map-overlay[role="dialog"][aria-modal="true"] #arpg-map-title'))`);
const mapStats = await evaluate(`(() => {
  const overlay=document.querySelector('.arpg-map-overlay');
  return {
    visibleRooms:overlay?.querySelectorAll('.arpg-minimap-room').length ?? 0,
    unknownRooms:overlay?.querySelectorAll('.arpg-minimap-room.is-type-unknown').length ?? 0,
    currentRoomKnown:Boolean(overlay?.querySelector('.arpg-minimap-room.is-current:not(.is-type-unknown)')),
    panelFitsViewport:(()=>{const panel=overlay?.querySelector('.arpg-map-overlay__panel');if(!panel)return false;const rect=panel.getBoundingClientRect();return rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight})(),
    continueButtonVisible:(()=>{const button=overlay?.querySelector('.arpg-map-overlay__close');if(!button)return false;const rect=button.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth})(),
  };
})()`);
const mapScreenshotPath = "arpg-map-overlay-smoke.png";
const mapScreenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile(mapScreenshotPath, Buffer.from(mapScreenshot.data, "base64"));
await wait(220);
const mapFrozenState = await readDungeon();
const mapPausesScene = mapState.runtime?.scenePaused === true
  && mapFrozenState.runtime?.scenePaused === true
  && mapState.runtime?.sceneTime === mapFrozenState.runtime?.sceneTime;
const mapKeepsUndiscoveredRoomsMasked = mapStats.visibleRooms < initial.rooms.length && mapStats.unknownRooms > 0;
await pressKey("Tab", "Tab", 9);
await wait(180);
const mapClosedState = await readDungeon();
const mapClosesAndResumes = !await evaluate(`Boolean(document.querySelector('.arpg-map-overlay'))`)
  && mapClosedState.runtime?.scenePaused === false;
await pressKey("Escape", "Escape", 27);
await wait(180);
const pausedState = await readDungeon();
const pauseDialogAccessible = await evaluate(`Boolean(document.querySelector('.arpg-pause[role="dialog"][aria-modal="true"] #arpg-pause-title'))`);
await wait(220);
const frozenState = await readDungeon();
const pauseFreezesScene = pausedState.runtime?.scenePaused === true
  && frozenState.runtime?.scenePaused === true
  && pausedState.runtime?.sceneTime === frozenState.runtime?.sceneTime;
await pressKey("Escape", "Escape", 27);
await wait(180);
const resumedState = await readDungeon();
const pauseResumesScene = !await evaluate(`Boolean(document.querySelector('.arpg-pause'))`)
  && resumedState.runtime?.scenePaused === false;
await wait(900);
const screenshotPath = "arpg-river-visual-smoke.png";
const viewport = await evaluate(`({width:innerWidth,height:innerHeight})`);
await evaluate(`window.__cardRealmsDungeonDebugOverlay?.(false); true`);
const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
const current = await readDungeon();
const significantErrors = events.filter((event) => {
  if (event.method === "Network.loadingFailed" && event.params?.canceled) return false;
  const text = event.params?.entry?.text ?? "";
  return !text.includes("beforeinstallprompt") && !text.includes("AudioContext was not allowed to start");
});
const result = {
  seed: current.seed,
  viewport,
  startRoom: initial.current,
  riverRoom: riverState.current,
  riverTemplate: riverState.currentTemplate,
  map: {
    accessibleDialog: mapDialogAccessible,
    visibleRooms: mapStats.visibleRooms,
    unknownRooms: mapStats.unknownRooms,
    currentRoomTypeRevealed: mapStats.currentRoomKnown,
    panelFitsViewport: mapStats.panelFitsViewport,
    continueButtonVisible: mapStats.continueButtonVisible,
    pausedGameplay: mapPausesScene,
    hidesUndiscoveredRooms: mapKeepsUndiscoveredRoomsMasked,
    tabClosesAndResumes: mapClosesAndResumes,
  },
  pause: {
    accessibleDialog: pauseDialogAccessible,
    stateWhenPaused: pausedState.runtime,
    stateAfterPauseWait: frozenState.runtime,
    frozeSceneClock: pauseFreezesScene,
    resumedWithEscape: pauseResumesScene,
  },
  screenshot: screenshotPath,
  mapScreenshot: mapScreenshotPath,
  errors: significantErrors.map((event) => ({ method: event.method, text: event.params?.entry?.text ?? "" })),
  checks: {
    reproducibleSeed: current.seed === expectedSeed,
    adjacentRiverRoomGenerated: Boolean(riverRoom && riverNeighbor),
    physicallyEnteredRiverRoom: riverState.current?.id === riverRoom?.id,
    correctRiverTemplateActive: current.current?.id === riverRoom?.id && current.currentTemplate === "mata-combat-river",
    tabOpensAccessibleMap: mapDialogAccessible,
    mapRevealsCurrentRoomType: mapStats.currentRoomKnown,
    mapPanelFitsViewport: mapStats.panelFitsViewport,
    mapContinueButtonVisible: mapStats.continueButtonVisible,
    mapPausesGameplay: mapPausesScene,
    mapHidesUndiscoveredRooms: mapKeepsUndiscoveredRoomsMasked,
    tabClosesAndResumesGameplay: mapClosesAndResumes,
    escapeOpensAccessiblePause: pauseDialogAccessible,
    pauseFreezesSceneClock: pauseFreezesScene,
    escapeResumesScene: pauseResumesScene,
    noRuntimeErrors: significantErrors.length === 0,
  },
};
console.log(JSON.stringify(result, null, 2));
ws.close();
if (Object.values(result.checks).some((passed) => !passed)) process.exitCode = 1;
