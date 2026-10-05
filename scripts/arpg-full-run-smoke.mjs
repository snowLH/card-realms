import fs from "node:fs/promises";

const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://localhost:3111";
const expeditionName = process.argv[2] ?? "Mata Encantada";
const bossOnly = process.env.ARPG_SMOKE_BOSS_ONLY === "1";
const forceChestPathfinding = process.env.ARPG_SMOKE_FORCE_CHEST_PATHFINDING === "1";
const desktopMode = process.env.ARPG_SMOKE_DESKTOP === "1";
const viewport = desktopMode ? { width: 1366, height: 768 } : { width: 844, height: 390 };
const screenshotSuffix = desktopMode ? "-desktop" : "";
const expeditionSlug = expeditionName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "expedition";
const resultFile = `arpg-full-run-smoke-${expeditionSlug}-${viewport.width}x${viewport.height}.json`;
const bossProfile = expeditionName === "Montanhas Rúnicas"
  ? "amarok-boss"
  : expeditionName === "Arquipélago das Marés"
    ? "iara-boss"
    : "curupira-boss";
const commonEnemyProfile = expeditionName === "Mata Encantada"
  ? "sprout-enemy"
  : expeditionName === "Arquipélago das Marés"
    ? "boto-enemy"
    : "raiju-enemy";
const bossScreenshotFile = `${bossProfile}-smoke${screenshotSuffix}.png`;
const rootArenaScreenshotFile = `curupira-root-arena-smoke${screenshotSuffix}.png`;
const treasureChestScreenshotFile = `treasure-chest-open-smoke${screenshotSuffix}.png`;
const treasureChestLootScreenshotFile = `${expeditionSlug}-chest-loot-drop${screenshotSuffix}.png`;
const sproutScreenshotFile = `mata-sprout-enemy-smoke${screenshotSuffix}.png`;
const botoScreenshotFile = `mares-boto-enemy-smoke${screenshotSuffix}.png`;
const raijuScreenshotFile = `montanhas-raiju-enemy-smoke${screenshotSuffix}.png`;
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(`${appUrl}/?proceduralSmoke=${Date.now()}&debugDungeon=1`)}`, { method: "PUT" })
  .then((response) => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const events = [];
const animationsObserved = new Set();
const sproutAnimationsObserved = new Set();
const botoAnimationsObserved = new Set();
const raijuAnimationsObserved = new Set();
const idleObservationAttempted = new Set();
const idleRoomEntranceSamples = new Set();
const doorStatesObserved = new Set();
const bossPatternsObserved = new Set();
let rootBarriersObserved = 0;
let bossScreenshotSaved = false;
let rootArenaScreenshotSaved = false;
let treasureChestScreenshotSaved = false;
let treasureChestLootScreenshotSaved = false;
const treasureChestAnimationFramesObserved = new Set();
const treasureChestDimensionsObserved = [];
const chestPresentationsObserved = new Map();
let sproutScreenshotSaved = false;
let botoScreenshotSaved = false;
let raijuScreenshotSaved = false;
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
async function dispatchKey(type, key, code, windowsVirtualKeyCode) {
  await cdp("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode });
}
async function getDesktopAimPoint(state) {
  const enemy = state?.debug?.enemyPositions?.length
    ? state.debug.enemyPositions
    : state?.debug?.animatedEnemies;
  const target = enemy
    ?.filter((candidate) => !candidate.defeatPending)
    .sort((left, right) => {
      const player = state.debug?.player;
      return Math.hypot(left.x - player.x, left.y - player.y)
        - Math.hypot(right.x - player.x, right.y - player.y);
    })[0];
  const player = state?.debug?.player;
  const canvas = await evaluate(`(() => { const rect=document.querySelector('canvas')?.getBoundingClientRect(); return rect?{x:rect.left,y:rect.top,width:rect.width,height:rect.height}:null; })()`);
  if (!canvas) throw new Error("Canvas indisponível para mira desktop");
  const scaleX = canvas.width / 1280;
  const scaleY = canvas.height / 720;
  return {
    x: canvas.x + canvas.width / 2 + (target && player ? (target.x - player.x) * scaleX : 0),
    y: canvas.y + canvas.height / 2 + (target && player ? (target.y - player.y) * scaleY : 0),
  };
}
async function setAttack(active, state) {
  if (desktopMode) {
    const point = await getDesktopAimPoint(state);
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point, button: "none" });
    await cdp("Input.dispatchMouseEvent", {
      type: active ? "mousePressed" : "mouseReleased",
      ...point,
      button: "left",
      buttons: active ? 1 : 0,
      clickCount: 1,
    });
    return;
  }
  const point = await evaluate(`(() => {
    const rect=document.querySelector('.arpg-touch__attack')?.getBoundingClientRect();
    return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null;
  })()`);
  if (!point) throw new Error("Botão de ataque indisponível no modo toque.");
  await cdp("Input.dispatchTouchEvent", {
    type: active ? "touchStart" : "touchEnd",
    touchPoints: active ? [{ ...point, id: 77 }] : [],
  });
}
async function updateAttackAim(state) {
  if (!desktopMode) return;
  const point = await getDesktopAimPoint(state);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point, button: "none", buttons: 1 });
}
async function dash() {
  if (desktopMode) {
    await dispatchKey("keyDown", " ", "Space", 32);
    await wait(90);
    await dispatchKey("keyUp", " ", "Space", 32);
    return;
  }
  await evaluate(`(() => {
    const button=document.querySelector('.arpg-touch__combat button:nth-of-type(2)');
    if(!button || button.disabled) return false;
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:505,pointerType:'touch'}));
    return true;
  })()`);
}
async function activateCombatAbilities(state, attackHeld = false) {
  if (desktopMode) {
    for (const [key, code, windowsVirtualKeyCode] of [["1", "Digit1", 49], ["2", "Digit2", 50], ["3", "Digit3", 51], ["4", "Digit4", 52]]) {
      await dispatchKey("keyDown", key, code, windowsVirtualKeyCode);
      await wait(40);
      await dispatchKey("keyUp", key, code, windowsVirtualKeyCode);
    }
    const point = await getDesktopAimPoint(state);
    const heldButtons = attackHeld ? 1 : 0;
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point, button: "none", buttons: heldButtons });
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "right", buttons: heldButtons | 2, clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "right", buttons: heldButtons, clickCount: 1 });
    return;
  }
  await evaluate(`(() => {
    document.querySelectorAll('.arpg-touch__cards button').forEach((button,index)=>
      button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:100+index,pointerType:'touch'}))
    );
    return true;
  })()`);
}
async function readState() {
  const state = await evaluate(`(() => {
    const status=[...document.querySelectorAll('.arpg-hud__status span')].map((item)=>item.innerText ?? '');
    const text=status.find((value)=>/^Sala\\s+/i.test(value)) ?? '';
    const match=text.match(/Sala\\s+(\\d+)\\/(\\d+)\\s+·\\s+(\\d+)/);
    return {
      text,
      room: match ? Number(match[1]) : 0,
      roomCount: match ? Number(match[2]) : 0,
      enemies: match ? Number(match[3]) : 0,
      health: status[0] ?? '',
      message: document.querySelector('.arpg-shell__topbar span')?.innerText ?? '',
      pendingLoot: Boolean(document.querySelector('.arpg-loot-choice')),
      roomChoice: Boolean(document.querySelector('.arpg-room-choice')),
      result: document.querySelector('.arpg-run-result')?.innerText ?? '',
      map: document.querySelector('.arpg-hud__minimap svg')?.textContent ?? '',
      debug: typeof window.__cardRealmsDungeonDebug === 'function' ? window.__cardRealmsDungeonDebug() : null,
    };
  })()`);
  const presentation = state.debug?.chestPresentation;
  if (presentation && Number.isInteger(presentation.id)) {
    const observed = chestPresentationsObserved.get(presentation.id) ?? {
      id: presentation.id,
      kind: presentation.kind,
      roomId: presentation.roomId,
      itemId: presentation.itemId,
      phases: new Set(),
      maxItemCount: 0,
      maxSpawnCount: 0,
    };
    observed.phases.add(presentation.phase);
    observed.maxItemCount = Math.max(observed.maxItemCount, Number(presentation.itemCount) || 0);
    observed.maxSpawnCount = Math.max(observed.maxSpawnCount, Number(presentation.itemSpawnCount) || 0);
    chestPresentationsObserved.set(presentation.id, observed);
    if (!treasureChestLootScreenshotSaved && presentation.kind === "loot"
      && ["fall", "contact"].includes(presentation.phase)) {
      const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await fs.writeFile(treasureChestLootScreenshotFile, Buffer.from(screenshot.data, "base64"));
      treasureChestLootScreenshotSaved = true;
    }
  }
  for (const enemy of state.debug?.animatedEnemies ?? []) {
    if (enemy.animation) animationsObserved.add(enemy.animation);
    if (enemy.animation?.startsWith("sprout-enemy-")) sproutAnimationsObserved.add(enemy.animation);
    if (enemy.animation?.startsWith("boto-enemy-")) botoAnimationsObserved.add(enemy.animation);
    if (enemy.animation?.startsWith("raiju-enemy-")) raijuAnimationsObserved.add(enemy.animation);
    for (const animation of enemy.animationHistory ?? []) {
      if (typeof animation !== "string") continue;
      animationsObserved.add(animation);
      if (animation.startsWith("sprout-enemy-")) sproutAnimationsObserved.add(animation);
      if (animation.startsWith("boto-enemy-")) botoAnimationsObserved.add(animation);
      if (animation.startsWith("raiju-enemy-")) raijuAnimationsObserved.add(animation);
    }
    if (enemy.bossPattern) bossPatternsObserved.add(`${enemy.phase}:${enemy.bossPattern}`);
  }
  for (const door of state.debug?.doorStates ?? []) {
    if (door.state) doorStatesObserved.add(door.state);
  }
  rootBarriersObserved = Math.max(rootBarriersObserved, state.debug?.activeCurupiraRootBarriers ?? 0);
  const chestFrame = Number(state.debug?.chest?.frame);
  const chestDimensions = state.debug?.chest;
  if (chestDimensions) {
    const frameWidth = Number(chestDimensions.frameWidth);
    const frameHeight = Number(chestDimensions.frameHeight);
    const displayWidth = Number(chestDimensions.displayWidth);
    const displayHeight = Number(chestDimensions.displayHeight);
    treasureChestDimensionsObserved.push({
      frameWidth,
      frameHeight,
      displayWidth,
      displayHeight,
      scaleX: displayWidth / frameWidth,
      scaleY: displayHeight / frameHeight,
    });
  }
  if (state.debug?.chest?.opening && Number.isInteger(chestFrame)) {
    treasureChestAnimationFramesObserved.add(chestFrame);
  }
  if (!treasureChestScreenshotSaved && state.debug?.chest?.opening && chestFrame === 3) {
    await evaluate(`window.__cardRealmsDungeonDebugOverlay?.(false); true`);
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(treasureChestScreenshotFile, Buffer.from(screenshot.data, "base64"));
    treasureChestScreenshotSaved = true;
  }
  if (!rootArenaScreenshotSaved && rootBarriersObserved > 0) {
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(rootArenaScreenshotFile, Buffer.from(screenshot.data, "base64"));
    rootArenaScreenshotSaved = true;
  }
  if (!bossScreenshotSaved && state.debug?.animatedEnemies?.some((enemy) => enemy.animation?.startsWith(`${bossProfile}-`))) {
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(bossScreenshotFile, Buffer.from(screenshot.data, "base64"));
    bossScreenshotSaved = true;
  }
  if (!sproutScreenshotSaved && state.debug?.animatedEnemies?.some((enemy) => enemy.animation === "sprout-enemy-attack")) {
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(sproutScreenshotFile, Buffer.from(screenshot.data, "base64"));
    sproutScreenshotSaved = true;
  }
  if (!botoScreenshotSaved && state.debug?.animatedEnemies?.some((enemy) => enemy.animation === "boto-enemy-attack")) {
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(botoScreenshotFile, Buffer.from(screenshot.data, "base64"));
    botoScreenshotSaved = true;
  }
  if (!raijuScreenshotSaved && state.debug?.animatedEnemies?.some((enemy) => enemy.animation === "raiju-enemy-attack")) {
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(raijuScreenshotFile, Buffer.from(screenshot.data, "base64"));
    raijuScreenshotSaved = true;
  }
  return state;
}
async function setPad(dx, dy) {
  await evaluate(`(() => {
    if (!window.__cardRealmsSmokePad) return false;
    window.__cardRealmsSmokePad.axes[0]=${dx};
    window.__cardRealmsSmokePad.axes[1]=${dy};
    return true;
  })()`);
}
async function move(dx, dy, duration, sampleAnimations = false, stopOnRoomId = null) {
  if (desktopMode) {
    const keys = [];
    if (dx < -0.1) keys.push(["KeyA", "a", 65]);
    if (dx > 0.1) keys.push(["KeyD", "d", 68]);
    if (dy < -0.1) keys.push(["KeyW", "w", 87]);
    if (dy > 0.1) keys.push(["KeyS", "s", 83]);
    for (const [code, key, windowsVirtualKeyCode] of keys) await dispatchKey("keyDown", key, code, windowsVirtualKeyCode);
    if (sampleAnimations) {
      const deadline = Date.now() + duration;
      while (Date.now() < deadline) {
        await wait(Math.min(16, deadline - Date.now()));
        const state = await readState();
        if (stopOnRoomId && state.debug?.room?.id === stopOnRoomId) break;
      }
    } else {
      await wait(duration);
    }
    for (const [code, key, windowsVirtualKeyCode] of keys) await dispatchKey("keyUp", key, code, windowsVirtualKeyCode);
    await wait(180);
    return;
  }
  await setPad(dx, dy);
  if (sampleAnimations) {
    const deadline = Date.now() + duration;
    while (Date.now() < deadline) {
      // Idle can be a short transition between spawn readiness and the first
      // movement update, so sample close to the browser frame cadence.
      const sampleInterval = desktopMode ? 16 : 4;
      await wait(Math.min(sampleInterval, deadline - Date.now()));
      const state = await readState();
      if (stopOnRoomId && state.debug?.room?.id === stopOnRoomId) break;
    }
  } else {
    await wait(duration);
  }
  await setPad(0, 0);
  await wait(180);
}
async function moveKeys(dx, dy, duration) {
  const keys = [];
  if (dx < -0.1) keys.push(["KeyA", "a", 65]);
  if (dx > 0.1) keys.push(["KeyD", "d", 68]);
  if (dy < -0.1) keys.push(["KeyW", "w", 87]);
  if (dy > 0.1) keys.push(["KeyS", "s", 83]);
  for (const [code, key, windowsVirtualKeyCode] of keys) {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", code, key, windowsVirtualKeyCode });
  }
  await wait(duration);
  for (const [code, key, windowsVirtualKeyCode] of keys) {
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", code, key, windowsVirtualKeyCode });
  }
  await wait(180);
}
async function moveToward(targetPoint, distanceLimit = 55) {
  let noMovementSteps = 0;
  for (let step = 0; step < 20; step += 1) {
    const state = await readState();
    const player = state.debug?.player;
    if (!player || !targetPoint) return false;
    const dx = targetPoint.x - player.x;
    const dy = targetPoint.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= distanceLimit) return true;
    const moveX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
    const moveY = moveX === 0 ? Math.sign(dy) : 0;
    const remaining = Math.max(18, (moveX !== 0 ? Math.abs(dx) : Math.abs(dy)) - distanceLimit / Math.SQRT2);
    const duration = Math.min(1100, Math.max(360, Math.round(remaining / 220 * 1000 * 0.78)));
    await move(moveX, moveY, duration);
    const afterPad = await readState();
    const afterPosition = afterPad.debug?.player;
    if (afterPosition && Math.hypot(afterPosition.x - player.x, afterPosition.y - player.y) < 5) {
      await moveKeys(moveX, moveY, duration);
      const afterKeys = await readState();
      const keyboardPosition = afterKeys.debug?.player;
      if (keyboardPosition && Math.hypot(keyboardPosition.x - player.x, keyboardPosition.y - player.y) < 5) {
        noMovementSteps += 1;
        if (noMovementSteps === 1) {
          console.log("chest-approach-blocked", JSON.stringify({ room: state.debug?.room?.id, player: keyboardPosition, targetPoint, runtime: afterKeys.debug?.runtime }));
        }
        if (noMovementSteps >= 2) return false;
      } else {
        noMovementSteps = 0;
      }
    } else {
      noMovementSteps = 0;
    }
  }
  const state = await readState();
  return Boolean(state.debug?.player && Math.hypot(targetPoint.x - state.debug.player.x, targetPoint.y - state.debug.player.y) <= distanceLimit + 20);
}
async function moveToWorld(targetPoint, distanceLimit = 92) {
  if (!targetPoint) return false;
  const pathAccepted = await evaluate(`window.__cardRealmsDungeonMoveToWorld?.(${targetPoint.x}, ${targetPoint.y}) ?? false`);
  if (!pathAccepted) return false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await wait(320);
    const state = await readState();
    const player = state.debug?.player;
    if (!player || state.result) return false;
    if (Math.hypot(targetPoint.x - player.x, targetPoint.y - player.y) <= distanceLimit) return true;
  }
  return false;
}
async function interact(waitForResponse = true) {
  if (desktopMode) {
    await dispatchKey("keyDown", "e", "KeyE", 69);
    await wait(waitForResponse ? 140 : 40);
    await dispatchKey("keyUp", "e", "KeyE", 69);
    if (waitForResponse) await wait(260);
    return;
  }
  await evaluate(`(() => {
    const button=document.querySelector('.arpg-touch__interact');
    if(!button) return false;
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:505,pointerType:'touch'}));
    return true;
  })()`);
  if (waitForResponse) await wait(260);
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
  if (!installed) throw new Error("Não foi possível instalar o gamepad virtual");
}
function chooseBossDodgeDirection(state) {
  const player = state.debug?.player;
  const bounds = state.debug?.bounds;
  const boss = state.debug?.animatedEnemies?.find((enemy) => enemy.animation?.startsWith(`${bossProfile}-`));
  const target = boss ?? state.debug?.enemyPositions?.length
    ? boss ?? state.debug.enemyPositions
      ?.filter((enemy) => !enemy.defeatPending)
      .sort((left, right) => Math.hypot(left.x - player.x, left.y - player.y)
        - Math.hypot(right.x - player.x, right.y - player.y))[0]
    : state.debug?.animatedEnemies
    ?.filter((enemy) => !enemy.defeatPending)
    .sort((left, right) => Math.hypot(left.x - player.x, left.y - player.y)
      - Math.hypot(right.x - player.x, right.y - player.y))[0];
  if (!player || !bounds || !target) return null;

  const deltaX = player.x - target.x;
  const deltaY = player.y - target.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const awayX = deltaX / distance;
  const awayY = deltaY / distance;
  const directions = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  const keepRange = distance < 180;
  const approach = distance > 280;
  const direction = directions
    .map((candidate) => {
      const horizontalRoom = candidate.x > 0
        ? bounds.x + bounds.width - player.x
        : player.x - bounds.x;
      const verticalRoom = candidate.y > 0
        ? bounds.y + bounds.height - player.y
        : player.y - bounds.y;
      const clearance = Math.min(
        Math.abs(candidate.x) < 0.1 ? Number.POSITIVE_INFINITY : horizontalRoom / Math.abs(candidate.x),
        Math.abs(candidate.y) < 0.1 ? Number.POSITIVE_INFINITY : verticalRoom / Math.abs(candidate.y),
      );
      const separation = candidate.x * awayX + candidate.y * awayY;
      const orbit = Math.abs(candidate.x * awayY - candidate.y * awayX);
      const edgePenalty = clearance < 125 ? (125 - clearance) / 125 * 1.8 : 0;
      const score = separation * (approach ? -2.3 : keepRange ? 1.8 : 0.05)
        + orbit * (approach ? 0.05 : keepRange ? 0.15 : 0.8)
        + Math.min(clearance, 260) / 260 * 0.25
        - edgePenalty;
      return { ...candidate, score };
    })
    .sort((left, right) => right.score - left.score)[0];
  return { x: direction.x, y: direction.y, distance };
}
function shortestPath(rooms, startId, endId) {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const queue = [startId];
  const previous = new Map([[startId, null]]);
  while (queue.length) {
    const currentId = queue.shift();
    if (currentId === endId) break;
    const current = byId.get(currentId);
    for (const nextId of Object.values(current?.connections ?? {})) {
      if (!nextId || previous.has(nextId)) continue;
      previous.set(nextId, currentId);
      queue.push(nextId);
    }
  }
  if (!previous.has(endId)) return [];
  const path = [];
  for (let cursor = endId; cursor; cursor = previous.get(cursor)) path.unshift(cursor);
  return path;
}
const directionVectors = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};
function commonEnemyIdleObserved() {
  if (commonEnemyProfile === "sprout-enemy") return sproutAnimationsObserved.has("sprout-enemy-idle");
  if (commonEnemyProfile === "boto-enemy") return botoAnimationsObserved.has("boto-enemy-idle");
  return raijuAnimationsObserved.has("raiju-enemy-idle");
}
async function travelToRoom(targetRoomId) {
  let state = await readState();
  const current = state.debug?.room;
  const bounds = state.debug?.bounds;
  if (!bounds) throw new Error(`Limites da sala ausentes: ${current?.id}`);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  for (const axis of ["x", "y"]) {
    for (let correction = 0; correction < 4; correction += 1) {
      state = await readState();
      const position = state.debug?.player;
      if (!position) break;
      const delta = center[axis] - position[axis];
      if (Math.abs(delta) <= 18) break;
      const duration = Math.min(1300, Math.max(180, Math.round(Math.abs(delta) / 220 * 1000 * 0.82)));
      await move(axis === "x" ? Math.sign(delta) : 0, axis === "y" ? Math.sign(delta) : 0, duration, desktopMode);
    }
  }
  state = await readState();
  const connection = state.debug?.doors?.find((door) => door.targetRoomId === targetRoomId);
  if (!connection) throw new Error(`Sala ${targetRoomId} não está conectada a ${current?.id}; doors=${JSON.stringify(state.debug?.doors)}; room=${JSON.stringify(state.debug?.rooms?.find((room) => room.id === current?.id)?.connections)}`);
  const doorState = state.debug?.doorStates?.find((door) => door.targetRoomId === targetRoomId);
  if (!doorState || doorState.openX == null || doorState.openY == null) {
    throw new Error(`Coordenadas da porta ${targetRoomId} ausentes: ${JSON.stringify(state.debug?.doorStates)}`);
  }
  const direction = directionVectors[connection.direction];
  if (!direction) throw new Error(`Direção desconhecida: ${connection.direction}`);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const targetRoom = state.debug?.rooms?.find((room) => room.id === targetRoomId);
    const sampleForEnemyIdle = ["combat", "elite"].includes(targetRoom?.type)
      && !commonEnemyIdleObserved()
      && !idleRoomEntranceSamples.has(targetRoomId)
      && idleRoomEntranceSamples.size < 8;
    const sampleAnimations = desktopMode || sampleForEnemyIdle;
    if (sampleForEnemyIdle) {
      idleRoomEntranceSamples.add(targetRoomId);
      console.log("idle-observation-sample", JSON.stringify({ room: targetRoomId, type: targetRoom?.type }));
    }
    await move(direction.dx, direction.dy, 1400, sampleAnimations, sampleForEnemyIdle ? targetRoomId : null);
    state = await readState();
    if (state.debug?.room?.id === targetRoomId) return state;
    if (state.result) break;
  }
  await setPad(0, 0);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    state = await readState();
    const gamepad = state.debug?.runtime?.gamepad;
    if (!gamepad || (Math.abs(gamepad.moveX) < 0.1 && Math.abs(gamepad.moveY) < 0.1)) break;
    await wait(100);
  }
  for (const worldTarget of [
    { x: doorState.openX + direction.dx * 600, y: doorState.openY + direction.dy * 600 },
    { x: doorState.openX, y: doorState.openY },
  ]) {
    const pathAccepted = await evaluate(`window.__cardRealmsDungeonMoveToWorld?.(${worldTarget.x}, ${worldTarget.y}) ?? false`);
    if (!pathAccepted) {
      console.log("door-path-unavailable", JSON.stringify({ from: current?.id, targetRoomId, worldTarget, player: state.debug?.player }));
      continue;
    }
    console.log("door-path-started", JSON.stringify({ from: current?.id, targetRoomId, worldTarget, player: state.debug?.player }));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await wait(320);
      state = await readState();
      if (state.debug?.room?.id === targetRoomId) return state;
      if (state.result) break;
    }
    console.log("door-path-stalled", JSON.stringify({ from: current?.id, targetRoomId, worldTarget, player: state.debug?.player }));
  }
  throw new Error(`Falha ao atravessar a porta para ${targetRoomId}; state=${JSON.stringify({ room: state.debug?.room, player: state.debug?.player, doors: state.debug?.doorStates })}`);
}
async function resolveCurrentRoom() {
  let state = await readState();
  let attackHeld = false;
  const combatStepLimit = desktopMode ? 240 : 120;
  for (let step = 0; step < combatStepLimit; step += 1) {
    if (state.result) break;
    if (state.roomChoice) {
      const clicked = await evaluate(`(() => {
        const kind=window.__cardRealmsDungeonDebug?.().room?.type;
        const choices=[...document.querySelectorAll('.arpg-room-choice__options button:not(:disabled)')];
        const preferred=kind==='rest'
          ? choices.find((button)=>button.innerText.includes('Descansar'))
          : kind==='shop'
            ? choices.find((button)=>button.innerText.includes('Tônico de viagem'))
              ?? choices.find((button)=>button.innerText.includes('Seguir viagem'))
            : choices.find((button)=>button.innerText.includes('Contornar') || button.innerText.includes('Recolher oferendas'));
        const choice=preferred ?? choices.find((button)=>button.innerText.includes('Grátis')) ?? choices[0];
        choice?.click(); return Boolean(choice);
      })()`);
      if (!clicked) throw new Error(`Escolha indisponível em ${state.debug?.room?.id}`);
      await wait(420);
      state = await readState();
      if (["rest", "shop", "event"].includes(state.debug?.room?.type)
        && state.debug?.room?.state !== "cleared") {
        throw new Error(`A escolha não concluiu a sala especial ${state.debug?.room?.id}: ${JSON.stringify(state.debug?.room)}`);
      }
      continue;
    }
    if (state.pendingLoot) {
      const decisionButton = await evaluate(`(() => {
        const button=document.querySelector('.arpg-loot-choice__actions button:not(.is-primary)');
        if(!button) return null;
        const rect=button.getBoundingClientRect();
        button.click();
        return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      })()`);
      if (!decisionButton) throw new Error(`Escolha de loot indisponível em ${state.debug?.room?.id}`);
      await wait(220);
      state = await readState();
      if (state.pendingLoot) {
        await cdp("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: decisionButton.x,
          y: decisionButton.y,
          button: "none",
        });
        await cdp("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x: decisionButton.x,
          y: decisionButton.y,
          button: "left",
          buttons: 1,
          clickCount: 1,
        });
        await cdp("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: decisionButton.x,
          y: decisionButton.y,
          button: "left",
          buttons: 0,
          clickCount: 1,
        });
        const decisionDeadline = Date.now() + 1200;
        while (Date.now() < decisionDeadline && state.pendingLoot) {
          await wait(40);
          state = await readState();
        }
      }
      if (state.pendingLoot) {
        throw new Error(`Decisão de loot não aplicada: ${JSON.stringify({ room: state.debug?.room?.id, pendingLoot: state.debug?.runtime?.pendingLootKind })}`);
      }
      continue;
    }
    const portal = state.debug?.exitPortal;
    if (portal) {
      if (attackHeld) {
        await setAttack(false);
        attackHeld = false;
      }
      await moveToward(portal, 84);
      await interact();
      await wait(800);
      state = await readState();
      continue;
    }
    const chest = state.debug?.chest;
    if (chest) {
      if (attackHeld) {
        await setAttack(false);
        attackHeld = false;
      }
      let opened = false;
      for (let attempt = 0; attempt < 5 && !opened; attempt += 1) {
        const approached = forceChestPathfinding ? false : await moveToward(chest, 92);
        const position = (await readState()).debug?.player;
        let usedPathfinding = false;
        if (!approached || !position || Math.hypot(chest.x - position.x, chest.y - position.y) > 92) {
          usedPathfinding = true;
          const pathApproached = await moveToWorld(chest, 92);
          console.log("chest-path-result", JSON.stringify({ room: state.debug?.room?.id, arrived: pathApproached, player: (await readState()).debug?.player, chest }));
          if (!pathApproached) {
            const blockedState = await readState();
            console.log("chest-path-stalled", JSON.stringify({ room: state.debug?.room?.id, player: blockedState.debug?.player, chest }));
          }
        }
        await interact(false);
        const openingDeadline = Date.now() + 2400;
        state = await readState();
        while (Date.now() < openingDeadline && state.debug?.chest && !state.pendingLoot) {
          await wait(16);
          state = await readState();
        }
        opened = !state.debug?.chest || state.pendingLoot;
        if (opened) console.log("chest-opened", JSON.stringify({ room: state.debug?.room?.id, usedPathfinding }));
      }
      if (!opened) {
        throw new Error(`Baú não abriu em ${state.debug?.room?.id}; ${JSON.stringify({ player: state.debug?.player, chest, message: state.message })}`);
      }
      continue;
    }
    const activeRoom = state.debug?.room;
    const specialRoomAnchor = state.debug?.specialRoomAnchor;
    if (["rest", "shop", "event"].includes(activeRoom?.type)
      && activeRoom.state !== "cleared"
      && specialRoomAnchor
      && !state.roomChoice) {
      if (attackHeld) {
        await setAttack(false);
        attackHeld = false;
      }
      let choiceOpened = false;
      for (let attempt = 0; attempt < 3 && !choiceOpened; attempt += 1) {
        await moveToWorld(specialRoomAnchor, 92);
        await interact();
        await wait(280);
        state = await readState();
        choiceOpened = state.roomChoice;
      }
      if (!choiceOpened) {
        throw new Error(`A sala especial ${activeRoom.id} não abriu as opções após interação física: ${JSON.stringify({ player: state.debug?.player, anchor: specialRoomAnchor, message: state.message })}`);
      }
      console.log("special-room-choice-opened", JSON.stringify({ room: activeRoom.id, type: activeRoom.type }));
      continue;
    }
    const isCombatRoom = ["combat", "elite", "boss"].includes(activeRoom?.type);
    if (isCombatRoom && (activeRoom?.state === "combat" || state.debug?.wave)) {
      const contactEnemyTarget = expeditionName === "Mata Encantada"
        ? { definitionId: "sprout", profile: "sprout-enemy", animations: sproutAnimationsObserved }
        : expeditionName === "Arquipélago das Marés"
          ? { definitionId: "skirmisher", profile: "boto-enemy", animations: botoAnimationsObserved }
          : expeditionName === "Montanhas Rúnicas"
            ? { definitionId: "stormBeast", profile: "raiju-enemy", animations: raijuAnimationsObserved }
          : null;
      const contactEnemy = contactEnemyTarget
        ? state.debug?.animatedEnemies?.find((enemy) => enemy.definitionId === contactEnemyTarget.definitionId && !enemy.defeatPending)
        : null;
      const waitingForContactEnemyAttack = Boolean(contactEnemyTarget && contactEnemy
        && !contactEnemyTarget.animations.has(`${contactEnemyTarget.profile}-attack`));
      if (waitingForContactEnemyAttack && contactEnemy) {
        if (attackHeld) {
          await setAttack(false);
          attackHeld = false;
        }
        const idleAnimation = `${contactEnemyTarget.profile}-idle`;
        if (!contactEnemyTarget.animations.has(idleAnimation)
          && !idleObservationAttempted.has(contactEnemyTarget.profile)) {
          idleObservationAttempted.add(contactEnemyTarget.profile);
          await move(0, 0, 620, true);
          state = await readState();
          continue;
        }
        await moveToward({ x: contactEnemy.x, y: contactEnemy.y }, 18);
        await move(0, 0, 700, true);
        state = await readState();
        continue;
      }
      const bossState = state.debug?.animatedEnemies?.find((enemy) => enemy.animation?.startsWith(`${bossProfile}-`));
      const bossPhase = bossState?.phase;
      const waitingForRootArena = activeRoom?.type === "boss"
        && bossState?.bossPattern === "root-arena"
        && rootBarriersObserved === 0;
      if (waitingForRootArena && attackHeld) {
        await setAttack(false);
        attackHeld = false;
      }
      if (attackHeld) await updateAttackAim(state);
      if (!attackHeld && !waitingForRootArena) {
        await setAttack(true, state);
        attackHeld = true;
      }
      if (activeRoom?.type !== "boss" || (bossPhase === 3 && !waitingForRootArena)) {
        await activateCombatAbilities(state, attackHeld);
      }
      for (let sample = 0; sample < 4; sample += 1) {
        await wait(80);
        await readState();
      }
      if (step % 2 === 0) {
        const bossDodge = activeRoom?.type === "boss" || desktopMode ? chooseBossDodgeDirection(state) : null;
        const angle = step * 0.63;
        const moveX = bossDodge?.x ?? Math.cos(angle);
        const moveY = bossDodge?.y ?? Math.sin(angle);
        if (bossDodge && step % 4 === 0) {
          console.log(activeRoom?.type === "boss" ? "boss-dodge" : "enemy-dodge", JSON.stringify({ room: activeRoom.id, distance: Math.round(bossDodge.distance), direction: { x: Number(moveX.toFixed(2)), y: Number(moveY.toFixed(2)) } }));
        }
        if (!desktopMode && step % 3 === 0) {
          await dash();
        }
        await move(moveX, moveY, 420, true);
      }
      state = await readState();
      if (step % 8 === 0) console.log("fight", JSON.stringify({ room: state.debug?.room?.id, type: state.debug?.room?.type, wave: state.debug?.wave, enemies: state.debug?.enemiesActive, hp: state.health }));
      if (state.result) break;
      continue;
    }
    break;
  }
  if (attackHeld) await setAttack(false);
  state = await readState();
  if (state.result && !state.result.includes('RUN CONCLUÍDA')) {
    const boss = state.debug?.animatedEnemies?.find((enemy) => enemy.definitionId === "boss");
    throw new Error(`Run terminou sem vitória: ${JSON.stringify({ result: state.result, health: state.health, player: state.debug?.player, boss, wave: state.debug?.wave })}`);
  }
  if (state.debug?.room?.state === "combat" || state.pendingLoot || state.roomChoice || state.debug?.chest) {
    throw new Error(`Sala não resolveu: ${JSON.stringify({ room: state.debug?.room, wave: state.debug?.wave, chest: state.debug?.chest, choice: state.roomChoice, loot: state.pendingLoot })}`);
  }
  return state;
}

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: !desktopMode, screenWidth: viewport.width, screenHeight: viewport.height });
await cdp("Emulation.setTouchEmulationEnabled", { enabled: !desktopMode, maxTouchPoints: desktopMode ? 1 : 5 });
await cdp("Page.navigate", { url: `${appUrl}/?proceduralSmoke=${Date.now()}&debugDungeon=1` });
await wait(900);
const smokeEquipment = expeditionName === "Montanhas Rúnicas"
  ? { weaponId: "raiju-staff", armorId: "amarok-hunter-armor" }
  : { weaponId: "iara-song-staff", armorId: "ahuizotl-guard-armor" };
const progress = {
  version: 4, coins: 500, xp: 0, openedTreasures: [], playerRegionId: "roots", currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"], mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: [smokeEquipment.weaponId, smokeEquipment.armorId],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const loadout = {
  ...smokeEquipment, relicId: "cartographer-compass",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(progress))}); localStorage.setItem('card-realms-arpg-loadout-v1:guest', ${JSON.stringify(JSON.stringify(loadout))}); true`);
await cdp("Page.reload", { ignoreCache: true });
await wait(1400);
if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
  await evaluate(`document.querySelector('.welcome-view__preview')?.click(); true`);
  await wait(800);
}
const opened = await evaluate(`(() => {
  const button=document.querySelector('.title-screen__play')
    ?? [...document.querySelectorAll('.side-nav nav button, .mobile-nav button')].find((item)=>item.innerText.trim().toUpperCase()==='JOGAR');
  button?.click(); return Boolean(button);
})()`);
if (!opened) throw new Error("Não encontrei a entrada JOGAR");
await wait(900);
const hubReady = await evaluate(`Boolean(document.querySelector('.arpg-hub-shell .arpg-hub-stage canvas'))`);
if (hubReady) {
  const cartographerPoint = await evaluate(`(() => {
    const canvas=document.querySelector('.arpg-hub-stage canvas');
    const rect=canvas?.getBoundingClientRect();
    return rect?{x:rect.x+rect.width*0.5,y:rect.y+rect.height*0.15}:null;
  })()`);
  if (!cartographerPoint) throw new Error("Canvas do HUB ausente após JOGAR");
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...cartographerPoint, button: "none" });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...cartographerPoint, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...cartographerPoint, button: "left", clickCount: 1 });
  await wait(1500);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
  await wait(140);
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
  await wait(700);
}
const expeditionPoint = await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')].find((item)=>item.innerText.includes(${JSON.stringify(expeditionName)}));
  const button=card?.querySelector('button:not(:disabled)');
  if(!button) return null;
  button.scrollIntoView({block:'center',inline:'center'});
  const r=button.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};
})()`);
if (!expeditionPoint) throw new Error(`Expedição não encontrada: ${expeditionName}`);
await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: expeditionPoint.x, y: expeditionPoint.y, button: "left", clickCount: 1 });
await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: expeditionPoint.x, y: expeditionPoint.y, button: "left", clickCount: 1 });
await wait(1800);
if (!desktopMode) await installVirtualGamepad();
await evaluate(`window.focus(); document.querySelector('canvas')?.setAttribute('tabindex','0'); document.querySelector('canvas')?.focus(); true`);
let state = await readState();
for (let attempt = 0; attempt < 40 && !state.debug?.rooms?.length; attempt += 1) {
  await wait(250);
  state = await readState();
}
const initial = state;
console.log("start", JSON.stringify({ rooms: state.debug?.rooms?.length, start: state.debug?.startRoomId, boss: state.debug?.bossRoomId, room: state.debug?.room }));
if (!state.debug?.rooms?.length) throw new Error("O grafo não está disponível no debug");
let roomSteps = 0;
const roomLog = [];
const visitedRoomIds = new Set([initial.debug?.startRoomId]);
while (!state.result && roomSteps < 36) {
  roomSteps += 1;
  state = await resolveCurrentRoom();
  const currentId = state.debug?.room?.id;
  if (currentId) visitedRoomIds.add(currentId);
  roomLog.push({ id: currentId, type: state.debug?.room?.type, state: state.debug?.room?.state, hp: state.health });
  console.log("resolved", JSON.stringify(roomLog.at(-1)));
  if (process.env.ARPG_SMOKE_STOP_AFTER_ENEMY_ANIMATIONS === "1") {
    const observed = commonEnemyProfile === "sprout-enemy"
      ? sproutAnimationsObserved
      : commonEnemyProfile === "boto-enemy"
        ? botoAnimationsObserved
        : raijuAnimationsObserved;
    const states = ["idle", "walk", "attack", "defeat"].map((animation) => `${commonEnemyProfile}-${animation}`);
    if (states.every((animation) => observed.has(animation))) {
      console.log("ENEMY_ANIMATION_SMOKE_RESULT", JSON.stringify({
        expeditionName,
        commonEnemyProfile,
        resolvedRoom: currentId,
        roomType: state.debug?.room?.type,
        animationsObserved: states,
        screenshot: commonEnemyProfile === "sprout-enemy"
          ? sproutScreenshotFile
          : commonEnemyProfile === "boto-enemy"
            ? botoScreenshotFile
            : raijuScreenshotFile,
      }));
      ws.close();
      await fetch(`${debugBase}/json/close/${encodeURIComponent(target.id)}`).catch(() => undefined);
      process.exit(0);
    }
  }
  if (state.result) break;
  const rooms = state.debug.rooms;
  const bossId = state.debug.bossRoomId;
  const startId = state.debug.startRoomId;
  const remaining = rooms.filter((room) => bossOnly
    ? room.id === bossId && !visitedRoomIds.has(room.id)
    : room.id !== bossId && room.id !== startId && !visitedRoomIds.has(room.id));
  const targets = remaining.length ? remaining : rooms.filter((room) => room.id === bossId && !visitedRoomIds.has(room.id));
  if (!targets.length) break;
  const targetRoom = targets
    .map((room) => ({ room, path: shortestPath(rooms, currentId, room.id) }))
    .filter((item) => item.path.length > 1)
    .sort((left, right) => left.path.length - right.path.length)[0];
  if (!targetRoom) throw new Error(`Não há caminho para salas restantes: ${targets.map((room) => room.id).join(",")}`);
  const nextRoomId = targetRoom.path[1];
  console.log("route", JSON.stringify({ currentId, targetId: targetRoom.room.id, path: targetRoom.path }));
  state = await travelToRoom(nextRoomId);
  console.log("entered", JSON.stringify({ id: state.debug.room.id, type: state.debug.room.type, direction: state.debug.rooms.find((room) => room.id === currentId)?.connections }));
}
state = await readState();
const resultScreen = state.result;
const finalRoom = state.debug?.room ?? null;
const finalHp = state.health;
const finalMap = state.map;
const exitClicked = await evaluate(`(() => {
  const button=[...document.querySelectorAll('.arpg-run-result button')].find((item)=>item.innerText.includes('Voltar à Guilda'));
  button?.click(); return Boolean(button);
})()`);
if (exitClicked) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await wait(500);
    const returned = await evaluate(`Boolean(document.querySelector('.arpg-hub-shell'))`);
    if (returned) break;
  }
}
const hubReturned = await evaluate(`Boolean(document.querySelector('.arpg-hub-shell'))`);
const significantErrors = events.filter((event) => {
  if (event.method === "Network.loadingFailed" && event.params?.canceled) return false;
  const text = event.params?.entry?.text ?? "";
  return !text.includes("beforeinstallpromptevent.preventDefault") && !text.includes("AudioContext was not allowed to start");
});
const chestPresentations = [...chestPresentationsObserved.values()].map((presentation) => ({
  ...presentation,
  phases: [...presentation.phases],
}));
const lootPresentations = chestPresentations.filter((presentation) => presentation.kind === "loot");
const result = {
  generatedAt: new Date().toISOString(),
  seed: initial.debug?.seed ?? null,
  expeditionName,
  initial: { roomCount: initial.roomCount, viewport: `${viewport.width}x${viewport.height}`, inputMode: desktopMode ? "keyboard-mouse" : "touch", startRoomId: initial.debug?.startRoomId, bossRoomId: initial.debug?.bossRoomId },
  roomSteps,
  roomLog,
  final: { result: resultScreen, room: finalRoom, portal: state.debug?.exitPortal, hp: finalHp, map: finalMap, hubReturned },
  checks: {
    generatedRoomCount: initial.roomCount >= 8 && initial.roomCount <= 12,
    reachedBoss: roomLog.some((room) => room.type === "boss"),
    extractedToResult: Boolean(resultScreen?.includes("RUN CONCLUÍDA")),
    returnedToHub: exitClicked && hubReturned,
    noRuntimeErrors: significantErrors.length === 0,
    bossAnimationStates: ["idle", "walk", "attack", "defeat"]
      .every((animation) => animationsObserved.has(`${bossProfile}-${animation}`)),
    curupiraPhasePatterns: expeditionName !== "Mata Encantada"
      || ["1:roots-burst", "2:decoy-ambush", "3:root-arena"].every((pattern) => bossPatternsObserved.has(pattern)),
    curupiraRootColliders: expeditionName !== "Mata Encantada" || rootBarriersObserved > 0,
    sproutAnimationStates: expeditionName !== "Mata Encantada"
      || ["idle", "walk", "attack", "defeat"].every((animation) => sproutAnimationsObserved.has(`sprout-enemy-${animation}`)),
    botoAnimationStates: expeditionName !== "Arquipélago das Marés"
      || ["idle", "walk", "attack", "defeat"].every((animation) => botoAnimationsObserved.has(`boto-enemy-${animation}`)),
    raijuAnimationStates: expeditionName !== "Montanhas Rúnicas"
      || ["idle", "walk", "attack", "defeat"].every((animation) => raijuAnimationsObserved.has(`raiju-enemy-${animation}`)),
    doorStatesReported: doorStatesObserved.has("open") && doorStatesObserved.has("closed"),
    treasureChestAnimation: bossOnly || [1, 2, 3].every((frame) => treasureChestAnimationFramesObserved.has(frame)),
    treasureChestDimensionsWithinNominalScale: bossOnly || (treasureChestDimensionsObserved.length > 0
      && treasureChestDimensionsObserved.every(({ frameWidth, frameHeight, displayWidth, displayHeight, scaleX, scaleY }) => (
        Number.isFinite(frameWidth) && frameWidth > 0
        && Number.isFinite(frameHeight) && frameHeight > 0
        && Number.isFinite(displayWidth) && displayWidth >= 52 && displayWidth <= 110
        && Number.isFinite(displayHeight) && displayHeight >= 52 && displayHeight <= 110
        && Number.isFinite(scaleX) && scaleX > 0 && scaleX <= 0.18
        && Number.isFinite(scaleY) && scaleY > 0 && scaleY <= 0.18
      ))),
    treasureChestLootRiseFallAndContact: bossOnly || (lootPresentations.length > 0
      && lootPresentations.every(({ phases }) => ["rise", "fall", "contact", "waiting-choice"].every((phase) => phases.includes(phase)))),
    treasureChestSingleVisualWithoutDuplicates: bossOnly || (chestPresentations.length > 0
      && chestPresentations.every(({ maxItemCount, maxSpawnCount }) => maxItemCount === 1 && maxSpawnCount === 1)),
  },
  reportFile: resultFile,
  bossAnimationsObserved: [...animationsObserved].filter((animation) => animation.startsWith(`${bossProfile}-`)),
  sproutAnimationsObserved: [...sproutAnimationsObserved],
  botoAnimationsObserved: [...botoAnimationsObserved],
  raijuAnimationsObserved: [...raijuAnimationsObserved],
  bossPatternsObserved: [...bossPatternsObserved],
  rootBarriersObserved,
  doorStatesObserved: [...doorStatesObserved],
  treasureChestAnimationFramesObserved: [...treasureChestAnimationFramesObserved].sort((left, right) => left - right),
  treasureChestDimensionsObserved,
  chestPresentationsObserved: chestPresentations,
  bossScreenshot: bossScreenshotSaved ? bossScreenshotFile : null,
  sproutScreenshot: sproutScreenshotSaved ? sproutScreenshotFile : null,
  botoScreenshot: botoScreenshotSaved ? botoScreenshotFile : null,
  raijuScreenshot: raijuScreenshotSaved ? raijuScreenshotFile : null,
  rootArenaScreenshot: rootArenaScreenshotSaved ? rootArenaScreenshotFile : null,
  treasureChestScreenshot: treasureChestScreenshotSaved ? treasureChestScreenshotFile : null,
  treasureChestLootScreenshot: treasureChestLootScreenshotSaved ? treasureChestLootScreenshotFile : null,
  events: significantErrors.map((event) => ({ method: event.method, params: event.params })),
};
const serializedResult = JSON.stringify(result, null, 2);
await fs.writeFile(resultFile, `${serializedResult}\n`, "utf8");
console.log(serializedResult);
ws.close();
await fetch(`${debugBase}/json/close/${encodeURIComponent(target.id)}`).catch(() => undefined);
const failed = Object.entries(result.checks).filter(([, value]) => value !== true);
if (failed.length) {
  console.error("FAILED_CHECKS", failed.map(([key]) => key).join(", "));
  process.exitCode = 1;
}
