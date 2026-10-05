const debugBase = "http://127.0.0.1:9224";
const appUrl = "http://localhost:3110";
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
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}
async function clickPoint(point) {
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}
async function clickSelector(selector) {
  const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  if (!point) return false;
  await clickPoint(point);
  return true;
}
async function setAttack(active, pointerId = 9) {
  const point = await evaluate(`(() => {
    const rect=document.querySelector('.arpg-touch__attack')?.getBoundingClientRect();
    return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null;
  })()`);
  if (!point) throw new Error("Botão de ataque indisponível no modo toque.");
  await cdp("Input.dispatchTouchEvent", {
    type: active ? "touchStart" : "touchEnd",
    touchPoints: active ? [{ ...point, id: pointerId }] : [],
  });
}
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 390, deviceScaleFactor: 1, mobile: true,
  screenWidth: 844, screenHeight: 390,
});
const progress = {
  version: 4, coins: 500, xp: 0, openedTreasures: [],
  playerRegionId: "roots", currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"], mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: [
    "ritual-staff", "iara-song-staff", "kelpie-mist-cloak",
    "leather-armor",
  ],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
async function seed(loadout) {
  await cdp("Page.navigate", { url: appUrl });
  await wait(800);
  await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(progress))});`);
  await evaluate(`localStorage.setItem('card-realms-arpg-loadout-v1:guest', ${JSON.stringify(JSON.stringify(loadout))});`);
  await cdp("Page.reload", { ignoreCache: true });
  await wait(1200);
}
async function enterGameAndExpedition(expeditionName) {
  let jogar = false;
  const deadline = Date.now() + 6000;
  while (!jogar && Date.now() < deadline) {
    if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
      await clickSelector('.welcome-view__preview');
      await wait(350);
    }
    jogar = await evaluate(`(() => {
      const button=[...document.querySelectorAll('.mobile-nav button,.side-nav nav button')]
        .find((item)=>{
          const r=item.getBoundingClientRect();
          return item.innerText.trim().toUpperCase()==='JOGAR' && r.width>0 && r.height>0;
        });
      if(!button) return false;
      button.click();
      return true;
    })()`);
    if (!jogar) await wait(200);
  }
  if (!jogar) {
    const debug = await evaluate(`document.body.innerText.slice(0, 2500)`);
    throw new Error(`Botão Jogar não encontrado. DOM: ${debug}`);
  }
  await wait(850);
  const expeditionReady = await evaluate(`(() => {
    const card=[...document.querySelectorAll('.arpg-expedition-card')]
      .find((item)=>item.innerText.includes(${JSON.stringify(expeditionName)}));
    const button=card?.querySelector('button');
    if(!button) return false;
    button.scrollIntoView({block:'center',inline:'center'});
    return true;
  })()`);
  if (!expeditionReady) {
    const debug = await evaluate(`(() => ({
      body: document.body.innerText.slice(0, 4000),
      sections: [...document.querySelectorAll('section')].map((item) => item.className),
      buttons: [...document.querySelectorAll('button')].map((item) => item.innerText.trim()).filter(Boolean).slice(0, 50),
    }))()`);
    console.log('EXPEDITION_DEBUG', JSON.stringify(debug, null, 2));
    throw new Error(`Expedição ${expeditionName} não encontrada`);
  }
  await wait(250);
  const expedition = await evaluate(`(() => {
    const card=[...document.querySelectorAll('.arpg-expedition-card')]
      .find((item)=>item.innerText.includes(${JSON.stringify(expeditionName)}));
    const button=card?.querySelector('button');
    if(!button) return null;
    const r=button.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  if (!expedition) throw new Error(`Botão da expedição ${expeditionName} não encontrado`);
  await clickPoint(expedition);
  await wait(2200);
  if (!(await evaluate(`Boolean(document.querySelector('canvas'))`))) {
    const debugState = await evaluate(`(() => ({
      body: document.body.innerText.slice(0, 3000),
      sections: [...document.querySelectorAll('section')].map((item)=>item.className),
      buttons: [...document.querySelectorAll('button')].map((item)=>item.innerText).filter(Boolean).slice(0,40),
    }))()`);
    console.log('PLAY_DEBUG', JSON.stringify(debugState, null, 2));
    console.log('PLAY_EVENTS', JSON.stringify(events.map((event)=>({method:event.method,params:event.params})), null, 2));
    throw new Error('Canvas ARPG não carregou');
  }
}
async function holdAttackAndWatch(durationMs, wanted) {
  const seen = [];
  await setAttack(true);
  const started = Date.now();
  while (Date.now() - started < durationMs) {
    const message = await evaluate(`document.querySelector('.arpg-shell__topbar span')?.innerText ?? ''`);
    if (message && !seen.includes(message)) seen.push(message);
    await wait(120);
  }
  await setAttack(false);
  return { seen, matched: seen.some((message) => message.includes(wanted)) };
}
const starterCards = ["ancestral-roots", "boitata-flame"];
const ritualLoadout = {
  weaponId: "ritual-staff", armorId: "leather-armor",
  abilityIds: starterCards,
};
await seed(ritualLoadout);
await enterGameAndExpedition("Mata Encantada");
const ritualResult = await holdAttackAndWatch(2400, "Eco Espiritual");
const iaraLoadout = {
  weaponId: "iara-song-staff", armorId: "kelpie-mist-cloak",
  abilityIds: starterCards,
};
await seed(iaraLoadout);
await enterGameAndExpedition("Arquipélago das Marés");
const iaraResult = await holdAttackAndWatch(2300, "Eco Restaurador");
const dashInitiallyDisabled = await evaluate(`document.querySelector('.arpg-touch__combat button:nth-child(2)')?.disabled ?? null`);
await evaluate(`document.querySelector('.arpg-touch__combat button:nth-child(2)')?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:10})); true`);
await wait(120);
const dashAfter120 = await evaluate(`(() => { const b=document.querySelector('.arpg-touch__combat button:nth-child(2)'); return b ? {disabled:b.disabled,text:b.innerText} : null; })()`);
await wait(580);
const dashAfter700 = await evaluate(`(() => { const b=document.querySelector('.arpg-touch__combat button:nth-child(2)'); return b ? {disabled:b.disabled,text:b.innerText} : null; })()`);
const overflow = await evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
const expectedUnsignedRunEvents = events.filter((event) => {
  const entry = event.params?.entry;
  return entry?.level === "error"
    && entry?.url === `${appUrl}/api/arpg/run`
    && String(entry?.text ?? "").includes("400 (Bad Request)");
});
const fatalEvents = events.filter((event) => {
  if (event.method === "Runtime.exceptionThrown") return true;
  const entry = event.params?.entry;
  if (entry?.level !== "error") return false;
  if (String(entry?.text ?? "").includes("beforeinstallprompt")) return false;
  if (entry?.url === `${appUrl}/api/arpg/run` && String(entry?.text ?? "").includes("400 (Bad Request)")) return false;
  return true;
});
const result = {
  ritualResult,
  iaraResult,
  dashInitiallyDisabled,
  dashAfter120,
  dashAfter700,
  overflow,
  expectedUnsignedRunEventCount: expectedUnsignedRunEvents.length,
  fatalEventCount: fatalEvents.length,
  fatalEvents: fatalEvents.map((event) => ({ method: event.method, params: event.params })),
  checks: {
    spiritEchoTriggered: ritualResult.matched,
    iaraRenewalTriggered: iaraResult.matched,
    kelpieDashEntersCooldown: dashAfter120?.disabled === true,
    kelpieDashReadyBy700ms: dashAfter700?.disabled === false,
    noHorizontalOverflow: overflow === false,
    noFatalRuntimeErrors: fatalEvents.length === 0,
  },
};
console.log(JSON.stringify(result, null, 2));
const failed = Object.entries(result.checks).filter(([, value]) => value !== true);
ws.close();
await fetch(`${debugBase}/json/close/${encodeURIComponent(target.id)}`).catch(() => undefined);
if (failed.length > 0) {
  throw new Error(`Smoke de equipamentos falhou: ${failed.map(([key]) => key).join(', ')}`);
}
