const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://localhost:3110";
const expeditionName = process.argv[2] ?? "Mata Encantada";
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
}const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result.value;
}
async function clickPoint(point) {
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1,
  });
}
async function installVirtualGamepad() {
  const installed = await evaluate(`(() => {
    const buttons=Array.from({length:16},()=>({pressed:false,value:0}));
    window.__cardRealmsSmokePad={connected:true,axes:[0,0,0,0],buttons};
    try {
      Object.defineProperty(navigator,'getGamepads',{
        configurable:true,
        value:()=>[window.__cardRealmsSmokePad],
      });
      return typeof navigator.getGamepads === 'function';
    } catch { return false; }
  })()`);
  if (!installed) throw new Error("Gamepad virtual não pôde ser instalado");
}
async function moveStick(dx, dy, ms) {
  const stick = await evaluate(`(() => {
    const el=document.querySelector('.arpg-stick');
    if(!el) return null;
    const r=el.getBoundingClientRect();
    const radius=Math.min(r.width,r.height)*0.32;
    return {x:r.left+r.width/2+${dx}*radius,y:r.top+r.height/2+${dy}*radius};
  })()`);
  if (!stick) throw new Error('Joystick touch não encontrado');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stick.x,y:stick.y}]});
  await wait(ms);
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await wait(160);
}
async function setAttack(active, pointerId = 77) {
  const point = await evaluate(`(() => {
    const rect=document.querySelector('.arpg-touch__attack')?.getBoundingClientRect();
    return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null;
  })()`);
  if (!point) throw new Error("Botão de ataque indisponível no modo toque.");
  await cdp('Input.dispatchTouchEvent', {
    type: active ? 'touchStart' : 'touchEnd',
    touchPoints: active ? [{ x: point.x, y: point.y, id: pointerId }] : [],
  });
}
async function movePad(dx, dy, ms) {
  await evaluate(`(() => {
    if(!window.__cardRealmsSmokePad) return false;
    window.__cardRealmsSmokePad.axes[0]=${dx};
    window.__cardRealmsSmokePad.axes[1]=${dy};
    return true;
  })()`);
  await wait(ms);
  await evaluate(`(() => {
    if(!window.__cardRealmsSmokePad) return false;
    window.__cardRealmsSmokePad.axes[0]=0;
    window.__cardRealmsSmokePad.axes[1]=0;
    return true;
  })()`);
  await wait(160);
}
async function tapPadButton(index) {
  if (index !== 5) return;
  await evaluate(`(() => {
    const button=document.querySelector('.arpg-touch__interact');
    if(!button) return false;
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:505,pointerType:'touch'}));
    return true;
  })()`);
  await wait(160);
}
async function travelUntilRoom(direction, targetRoom) {
  const initial = await readHud();
  const debug = initial.dungeonDebug;
  if (debug?.player && debug.bounds) {
    const horizontalTravel = direction.dx !== 0;
    const target = horizontalTravel
      ? debug.bounds.y + debug.bounds.height / 2
      : debug.bounds.x + debug.bounds.width / 2;
    const current = horizontalTravel ? debug.player.y : debug.player.x;
    const delta = target - current;
    if (Math.abs(delta) > 20) {
      const adjustment = Math.sign(delta);
      const duration = Math.min(1600, Math.max(260, Math.round(Math.abs(delta) / 220 * 1000 + 150)));
      await movePad(horizontalTravel ? 0 : adjustment, horizontalTravel ? adjustment : 0, duration);
    }
  }
  for (let step = 0; step < 10; step += 1) {
    await movePad(direction.dx, direction.dy, 1250);
    const state = await readHud();
    if (state.room === targetRoom) return state;
  }
  return readHud();
}
async function readHud() {
  return evaluate(`(() => {
    const dungeonDebug = typeof window.__cardRealmsDungeonDebug === 'function'
      ? window.__cardRealmsDungeonDebug()
      : null;
    const text=[...document.querySelectorAll('.arpg-hud__status span')]
      .map((item)=>item.innerText ?? '')
      .find((value)=>/^Sala\\s+/i.test(value)) ?? '';
    const match=text.match(/Sala\\s+(\\d+)\\/(\\d+)\\s+·\\s+(\\d+)/);
    return {
      text,
      room: match ? Number(match[1]) : 0,
      roomCount: match ? Number(match[2]) : 0,
      enemies: match ? Number(match[3]) : 0,
      message: document.querySelector('.arpg-shell__topbar span')?.innerText ?? '',
      chest: [...document.querySelectorAll('.arpg-hud__loadout span')].some((item)=>item.innerText.includes('Baú disponível')),
      pendingLoot: Boolean(document.querySelector('.arpg-loot-choice')),
      roomChoice: Boolean(document.querySelector('.arpg-room-choice')),
      roomChoiceTitle: document.querySelector('.arpg-room-choice header strong')?.textContent?.trim() ?? '',
      minimapRooms: document.querySelectorAll('.arpg-minimap-room').length,
      minimapCurrent: document.querySelectorAll('.arpg-minimap-room.is-current').length,
      currentRoomTitle: document.querySelector('.arpg-minimap-room.is-current title')?.textContent ?? '',
      touchAbilitySlots: document.querySelectorAll('.arpg-touch__cards button').length,
      touchSupportControls: Boolean(document.querySelector('.arpg-touch__support')),
      dungeonDebug,
      minimapMarkers: document.querySelector('.arpg-hud__minimap svg')?.textContent ?? '',
    };
  })()`);
}await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 390, deviceScaleFactor: 1, mobile: true,
  screenWidth: 844, screenHeight: 390,
});
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
const progress = {
  version: 4, coins: 500, xp: 0, openedTreasures: [],
  playerRegionId: "roots", currentAreaId: "roots-gate", visitedAreaIds: ["roots-gate"],
  mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: ["iara-song-staff", "ahuizotl-guard-armor"],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const loadout = {
  weaponId: "iara-song-staff",
  armorId: "ahuizotl-guard-armor",
  relicId: "cartographer-compass",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};
await cdp("Page.navigate", { url: `${appUrl}/?proceduralSmoke=${Date.now()}&debugDungeon=1` });
await wait(900);
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(progress))}); true`);
await evaluate(`localStorage.setItem('card-realms-arpg-loadout-v1:guest', ${JSON.stringify(JSON.stringify(loadout))}); true`);
await cdp("Page.reload", { ignoreCache: true });
await wait(1400);
if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
  await evaluate(`document.querySelector('.welcome-view__preview')?.click(); true`);
  await wait(800);
}
const playOpened = await evaluate(`(() => {
  const button=[...document.querySelectorAll('.side-nav nav button, .mobile-nav button')]
    .find((item)=>{
      const r=item.getBoundingClientRect();
      return item.innerText.trim().toUpperCase()==='JOGAR' && r.width>0 && r.height>0;
    });
  if(!button) return false;
  button.click();
  return true;
})()`);
if (!playOpened) throw new Error("Navegação JOGAR não encontrada");
await wait(900);
const expeditionPoint = await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')]
    .find((item)=>item.innerText.includes(${JSON.stringify(expeditionName)}));
  const button=card?.querySelector('button:not(:disabled)');
  if(!button) return null;
  button.scrollIntoView({block:'center',inline:'center'});
  const r=button.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
})()`);
if (!expeditionPoint) throw new Error(`Expedição não encontrada: ${expeditionName}`);
await clickPoint(expeditionPoint);
await wait(1800);
await installVirtualGamepad();
await evaluate(`window.focus(); document.querySelector('canvas')?.setAttribute('tabindex','0'); document.querySelector('canvas')?.focus(); true`);
const initial = await readHud();
const directions = [
  { dx: 0, dy: -1, backDx: 0, backDy: 1, label: "north" },
  { dx: 1, dy: 0, backDx: -1, backDy: 0, label: "east" },
  { dx: 0, dy: 1, backDx: 0, backDy: -1, label: "south" },
  { dx: -1, dy: 0, backDx: 1, backDy: 0, label: "west" },
];
const directionsByLabel = new Map(directions.map((direction) => [direction.label, direction]));
const connectedDirections = initial.dungeonDebug?.doors
  .map((door) => directionsByLabel.get(door.direction))
  .filter((direction) => direction !== undefined);
let transition = null;
for (const direction of connectedDirections.length ? connectedDirections : directions) {
  await moveStick(direction.dx, direction.dy, 5000);
  const state = await readHud();
  const changed = state.room !== initial.room
    || state.enemies > 0
    || state.chest
    || state.roomChoice
    || /onda|tesouro|descanso|mercador|evento/i.test(state.message);
  if (changed) {
    transition = { direction, state };
    await moveStick(direction.dx, direction.dy, 950);
    break;
  }
  await moveStick(direction.backDx, direction.backDy, 1250);
}
if (!transition) throw new Error(`Nenhuma porta procedural foi encontrada. HUD: ${JSON.stringify(initial)}`);
let active = await readHud();
const enteredRoom = active.room;
const initialAmbient = initial.dungeonDebug?.ambient;
const transitionAmbient = transition.state.dungeonDebug?.ambient;
const initialRoomId = initial.dungeonDebug?.room?.id;
const enteredRoomId = transition.state.dungeonDebug?.room?.id;
const initialRoomAmbient = initialAmbient?.rooms?.find((room) => room.roomId === initialRoomId);
const departedRoomAmbient = transitionAmbient?.rooms?.find((room) => room.roomId === initialRoomId);
const hasInitialRoomAmbient = Boolean(initialRoomAmbient
  && initialRoomAmbient.tweens.active + initialRoomAmbient.tweens.paused
    + initialRoomAmbient.fx.active + initialRoomAmbient.fx.paused > 0);
const ambientFocusedOnEnteredRoom = Boolean(transitionAmbient
  && transitionAmbient.activeRoomId === enteredRoomId);
const departedRoomAmbientPaused = Boolean(departedRoomAmbient
  && departedRoomAmbient.tweens.active === 0
  && departedRoomAmbient.fx.active === 0
  && (!hasInitialRoomAmbient
    || (departedRoomAmbient.tweens.paused === initialRoomAmbient.tweens.active + initialRoomAmbient.tweens.paused
      && departedRoomAmbient.fx.paused === initialRoomAmbient.fx.active + initialRoomAmbient.fx.paused)));
const specialRoomSeen = active.roomChoice
  || ["rest", "event", "shop"].includes(active.dungeonDebug?.room?.type);
let specialRoomResolved = !specialRoomSeen;
if (specialRoomSeen && !active.roomChoice) {
  const anchor = active.dungeonDebug?.specialRoomAnchor;
  if (!anchor) throw new Error(`A sala ${active.dungeonDebug?.room?.type} não criou um ponto físico de interação.`);
  const moved = await evaluate(`window.__cardRealmsDungeonMoveToWorld?.(${anchor.x},${anchor.y}) ?? false`);
  if (!moved) throw new Error("O personagem não conseguiu traçar uma rota até o ponto da sala especial.");
  let nearAnchor = false;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await wait(220);
    const state = await readHud();
    const player = state.dungeonDebug?.player;
    if (player && Math.hypot(player.x - anchor.x, player.y - anchor.y) <= 128) {
      nearAnchor = true;
      active = state;
      break;
    }
  }
  if (!nearAnchor) throw new Error("O personagem não alcançou o ponto físico da sala especial.");
  await tapPadButton(5);
  await wait(350);
  active = await readHud();
  if (!active.roomChoice) throw new Error("A interação próxima não abriu as opções da sala especial.");
}
if (specialRoomSeen) {
  await evaluate(`(() => {
    const options=[...document.querySelectorAll('.arpg-room-choice__options button:not(:disabled)')];
    const free=options.find((button)=>button.innerText.includes('Grátis')) ?? options[0];
    free?.click();
    return Boolean(free);
  })()`);
  await wait(550);
  active = await readHud();
  specialRoomResolved = !active.roomChoice;
}
let combatSeen = active.enemies > 0;
let combatCleared = false;
if (combatSeen) {
  await setAttack(true);
  for (let cycle = 0; cycle < 18; cycle += 1) {
    await evaluate(`(() => {
      document.querySelectorAll('.arpg-touch__cards button').forEach((button,index)=>
        button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:100+index,pointerType:'touch'}))
      );
      return true;
    })()`);
    if (cycle % 3 === 0) await moveStick(cycle % 6 === 0 ? 1 : -1, 0, 260);
    await wait(620);
    active = await readHud();
    if (active.enemies === 0) {
      await wait(750);
      active = await readHud();
      combatCleared = /· cleared$/i.test(active.currentRoomTitle);
      if (combatCleared) break;
    }
    const ended = await evaluate(`Boolean(document.querySelector('.arpg-run-result'))`);
    if (ended) break;
  }
  await setAttack(false);
  await wait(900);
  active = await readHud();
}
const chestSeen = active.chest;
let chestOpened = false;
let lootResolved = false;
if (chestSeen) {
  let afterOpen = await readHud();
  await moveStick(-1, 0, 1500);
  await moveStick(0, -1, 1500);
  for (let row = 0; row < 8 && !afterOpen.pendingLoot; row += 1) {
    const dx = row % 2 === 0 ? 1 : -1;
    for (let column = 0; column < 8; column += 1) {
      await tapPadButton(5);
      afterOpen = await readHud();
      if (afterOpen.pendingLoot) break;
      await moveStick(dx, 0, 260);
    }
    if (!afterOpen.pendingLoot) await moveStick(0, 1, 260);
  }
  chestOpened = afterOpen.pendingLoot;
  if (chestOpened) {
    await evaluate(`document.querySelector('.arpg-loot-choice__actions .is-primary')?.click(); true`);
    await wait(500);
    const afterChoice = await readHud();
    lootResolved = !afterChoice.pendingLoot && !afterChoice.chest
      && /Continue pela dungeon/i.test(afterChoice.message);
    active = afterChoice;
  }
}
const roomResolved = specialRoomResolved && (
  combatSeen
    ? combatCleared && (!chestSeen || lootResolved)
    : (!chestSeen || lootResolved)
);
let returnedToStart = null;
let revisitedCleared = null;
if (transition && roomResolved) {
  returnedToStart = await travelUntilRoom(
    { dx: transition.direction.backDx, dy: transition.direction.backDy },
    initial.room,
  );
  if (returnedToStart.room === initial.room) {
    revisitedCleared = await travelUntilRoom(
      { dx: transition.direction.dx, dy: transition.direction.dy },
      enteredRoom,
    );
  }
}
const significantErrors = events.filter((event) => {
  if (event.method === "Network.loadingFailed" && event.params?.canceled) return false;
  const text = event.params?.entry?.text ?? "";
  if (text.includes("beforeinstallpromptevent.preventDefault")) return false;
  if (text.includes("AudioContext was not allowed to start")) return false;
  return true;
});const result = {
  initial,
  transition: transition ? { direction: transition.direction.label, state: transition.state } : null,
  enteredRoom,
  specialRoomSeen,
  specialRoomResolved,
  final: active,
  returnedToStart,
  revisitedCleared,
  checks: {
    generatedRoomCount: initial.roomCount >= 8 && initial.roomCount <= 12,
    minimapVisible: initial.minimapRooms > 0,
    minimapPartial: initial.minimapRooms < initial.roomCount,
    bossHiddenInitially: !initial.minimapMarkers.includes("B"),
    minimapHasSingleCurrent: initial.minimapCurrent === 1 && transition?.state.minimapCurrent === 1,
    exactlyTwoTouchAttacks: initial.touchAbilitySlots === 2,
    noSupportTouchControls: !initial.touchSupportControls,
    leftStartRoom: enteredRoom > initial.room,
    ambientTracksEnteredRoom: ambientFocusedOnEnteredRoom,
    departedRoomAmbientPaused,
    firstRoomResolved: roomResolved,
    specialRoomResolvedWhenPresent: !specialRoomSeen || specialRoomResolved,
    combatResolvedWhenPresent: !combatSeen || combatCleared,
    chestResolvedWhenPresent: !chestSeen || (chestOpened && lootResolved),
    returnedToStart: returnedToStart?.room === initial.room,
    revisitedClearedRoom: revisitedCleared?.room === enteredRoom,
    clearedRoomStayedEmpty: revisitedCleared?.enemies === 0,
    noRuntimeErrors: significantErrors.length === 0,
  },
  events: significantErrors.map((event) => ({ method: event.method, params: event.params })),
};
console.log(JSON.stringify(result, null, 2));
const failed = Object.entries(result.checks).filter(([, value]) => value !== true);
ws.close();
await fetch(`${debugBase}/json/close/${encodeURIComponent(target.id)}`).catch(() => undefined);
if (failed.length) {
  console.error("FAILED_CHECKS", failed.map(([key]) => key).join(", "));
  process.exitCode = 1;
}
