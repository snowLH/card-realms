import { writeFile } from "node:fs/promises";

const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://localhost:3110";
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, {
  method: "PUT",
}).then((response) => response.json());
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
    if (["Runtime.exceptionThrown", "Log.entryAdded", "Network.loadingFailed"].includes(message.method)) {
      events.push(message);
    }
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
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(`CDP evaluate falhou: ${description}`);
  }
  return result.result.value;
}
function metricMap(result) {
  return Object.fromEntries((result.metrics ?? []).map((entry) => [entry.name, entry.value]));
}

try {
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");
await cdp("Performance.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 390, deviceScaleFactor: 1, mobile: true,
  screenWidth: 844, screenHeight: 390,
  screenOrientation: { type: "landscapePrimary", angle: 90 },
});
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await cdp("Page.navigate", { url: `${appUrl}/?mobilePerf=${Date.now()}&performanceBenchmark=1` });
await wait(900);
const localProgress = {
  version: 4, coins: 500, xp: 0, openedTreasures: [],
  playerRegionId: "roots", currentAreaId: "roots-gate",
  visitedAreaIds: ["roots-gate"], mapPositions: { roots: { x: 4, y: 20 } },
  energy: { fire: 12, water: 12, nature: 12, storm: 12, spirit: 12 },
  equipmentIds: [],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const loadout = {
  weaponId: "forest-bow",
  armorId: "leather-armor",
  relicId: "cartographer-compass",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(localProgress))}); true`);
await evaluate(`localStorage.setItem('card-realms-arpg-loadout-v1:guest', ${JSON.stringify(JSON.stringify(loadout))}); true`);
await cdp("Page.reload", { ignoreCache: true });
await wait(1200);
if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
  await evaluate(`document.querySelector('.welcome-view__preview')?.click(); true`);
  await wait(700);
}
const startedHub = await evaluate(`(() => {
  const button=document.querySelector('.title-screen__play');
  if (!button) return false;
  button.click(); return true;
})()`);
if (!startedHub) throw new Error("Entrada JOGAR da abertura não encontrada");
await wait(1000);
const openedExpeditions = await evaluate(`(() => {
  const button=[...document.querySelectorAll('button')].find((item)=>{
    const rect=item.getBoundingClientRect();
    return item.innerText.trim().toUpperCase()==='JOGAR' && rect.width>0 && rect.height>0;
  });
  if(!button) return false;
  button.click(); return true;
})()`);
if (!openedExpeditions) throw new Error("Navegação móvel JOGAR não encontrada");
await wait(500);
const expeditionStarted = await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')]
    .find((item)=>item.innerText.includes('Mata Encantada'));
  const button=card?.querySelector('button');
  if(!button) return false;
  button.click(); return true;
})()`);
if (!expeditionStarted) throw new Error("Mata Encantada não encontrada");
await wait(1800);
const layout = await evaluate(`(() => {
  const canvas=document.querySelector('canvas');
  const rect=canvas?.getBoundingClientRect();
  return {
    canvas: Boolean(canvas),
    canvasWidth: rect?.width ?? 0,
    canvasHeight: rect?.height ?? 0,
    documentWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    enemies: document.querySelector('.arpg-hud__status span:last-child')?.innerText ?? '',
    attackButton: Boolean(document.querySelector('.arpg-touch__attack')),
  };
})()`);
if (!layout.canvas || !layout.attackButton) throw new Error("Runtime mobile não carregou");
const debugReady = await evaluate(`typeof window.__cardRealmsDungeonSetPerformanceLoad === 'function'`);
if (!debugReady) throw new Error("Instrumentação local de benchmark da dungeon não carregou");

async function sampleScenario(name, load) {
  await evaluate(`window.__cardRealmsDungeonSetPerformanceLoad(${JSON.stringify(load)})`);
  await wait(350);
  const state = await evaluate(`window.__cardRealmsDungeonGetPerformanceState()`);
  const before = metricMap(await cdp("Performance.getMetrics"));
  await evaluate(`(() => {
    window.__arpgPerf={frames:0,start:performance.now(),duration:0,done:false};
    const tick=(now)=>{ const sample=window.__arpgPerf; sample.frames+=1; sample.duration=now-sample.start;
      if(sample.duration>=3000){ sample.done=true; return; } requestAnimationFrame(tick); };
    requestAnimationFrame(tick); return true;
  })()`);
  await wait(3150);
  const sample = await evaluate(`window.__arpgPerf`);
  const after = metricMap(await cdp("Performance.getMetrics"));
  const fps = Number((sample.frames * 1000 / sample.duration).toFixed(1));
  return {
    name,
    requested: load,
    spawned: state.actual,
    rendererType: state.rendererType,
    physicsFps: state.physicsFps,
    frames: sample.frames,
    durationMs: Math.round(sample.duration),
    fps,
    jsHeapBeforeMb: Number(((before.JSHeapUsedSize ?? 0) / 1048576).toFixed(1)),
    jsHeapAfterMb: Number(((after.JSHeapUsedSize ?? 0) / 1048576).toFixed(1)),
    taskDurationDeltaMs: Number((((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000).toFixed(1)),
  };
}

const scenarios = [
  ["base", { enemies: 0, projectiles: 0, particles: 0 }],
  ["10 inimigos", { enemies: 10, projectiles: 0, particles: 0 }],
  ["25 inimigos", { enemies: 25, projectiles: 0, particles: 0 }],
  ["50 inimigos", { enemies: 50, projectiles: 0, particles: 0 }],
  ["100 projéteis", { enemies: 0, projectiles: 100, particles: 0 }],
  ["300 projéteis", { enemies: 0, projectiles: 300, particles: 0 }],
  ["partículas", { enemies: 0, projectiles: 0, particles: 300 }],
];
const performance = [];
for (const [name, load] of scenarios) performance.push(await sampleScenario(name, load));
const blockingErrors = events.filter((event) => {
  if (event.method === "Log.entryAdded") return event.params?.entry?.level === "error";
  if (event.method === "Runtime.exceptionThrown") return true;
  return event.method === "Network.loadingFailed" && !event.params?.canceled;
});
const countsMatch = performance.every((scenario) =>
  scenario.spawned.enemies === scenario.requested.enemies
  && scenario.spawned.projectiles === scenario.requested.projectiles
  && scenario.spawned.particles === scenario.requested.particles,
);
const meetsFpsTarget = performance.every((scenario) => scenario.fps >= 58);
const result = {
  generatedAt: new Date().toISOString(),
  viewport: "844×390, Chrome mobile landscape emulado (sem throttling de CPU)",
  rendererType: performance[0]?.rendererType ?? null,
  layout,
  performance,
  checks: {
    noHorizontalOverflow: layout.documentWidth === layout.clientWidth,
    noVerticalOverflow: layout.documentHeight <= layout.clientHeight + 1,
    landscapeCanvasFits: layout.canvasWidth <= 845 && layout.canvasHeight <= 391,
    requestedLoadSpawned: countsMatch,
    targetFpsInEveryScenario: meetsFpsTarget,
    noBlockingErrors: blockingErrors.length === 0,
  },
  blockingErrors,
};
console.log(JSON.stringify(result, null, 2));
await writeFile(new URL("../arpg-mobile-performance-smoke.json", import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
if (Object.values(result.checks).some((value) => !value)) throw new Error("Smoke de performance mobile falhou");
} finally {
  await fetch(`${debugBase}/json/close/${target.id}`).catch(() => undefined);
  ws.close();
}
