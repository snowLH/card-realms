const debugBase = "http://127.0.0.1:9224";
const appUrl = "http://localhost:3110";
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
  equipmentIds: [],
  avatar: { skin: "copper", hair: "braids", outfit: "traveler", armor: "none", accent: "gold" },
};
const loadout = {
  weaponId: "forest-bow",
  armorId: "leather-armor",
  relicId: "iara-shell-charm",
  abilityIds: ["ancestral-roots", "boitata-flame"],
};
await evaluate(`localStorage.setItem('card-realms:progress:v4', ${JSON.stringify(JSON.stringify(localProgress))}); true`);
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
      const rect=item.getBoundingClientRect();
      return item.innerText.trim().toUpperCase()==='JOGAR' && rect.width>0 && rect.height>0;
    });
  button?.click();
  return Boolean(button);
})()`);
if (!playOpened) throw new Error("Navegação JOGAR não encontrada");
await wait(900);

const expeditionStarted = await evaluate(`(() => {
  const button=document.querySelector('.arpg-expedition-card.is-available button:not(:disabled)');
  button?.click();
  return Boolean(button);
})()`);
if (!expeditionStarted) throw new Error("Expedição disponível não encontrada");
await wait(1800);

const dungeon = await evaluate(`(() => ({
  canvas: Boolean(document.querySelector('canvas')),
  abilityLabels: [...document.querySelectorAll('.arpg-touch__cards button')]
    .map((button)=>button.getAttribute('aria-label') ?? ''),
  abilityNames: [...document.querySelectorAll('.arpg-touch__cards .arpg-touch__card-name')]
    .map((item)=>item.textContent?.trim() ?? ''),
  supportControls: Boolean(document.querySelector('.arpg-touch__support')),
  basicWeaponAttack: Boolean(document.querySelector('.arpg-touch__attack')),
  hud: document.querySelector('.arpg-hud__loadout')?.innerText ?? '',
  width: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}))()`);
const significantErrors = events.filter((event) => {
  if (event.method === "Network.loadingFailed" && event.params?.canceled) return false;
  const text = event.params?.entry?.text ?? "";
  return !text.includes("beforeinstallpromptevent.preventDefault")
    && !text.includes("AudioContext was not allowed to start");
});
const result = {
  dungeon,
  checks: {
    canvasReady: dungeon.canvas,
    exactlyTwoAttackSlots: dungeon.abilityLabels.length === 2,
    rootsInSlotOne: dungeon.abilityNames[0] === "Raízes Ancestrais",
    boitataInSlotTwo: dungeon.abilityNames[1] === "Chama do Boitatá",
    noSupportControls: !dungeon.supportControls,
    weaponBasicAttackAvailable: dungeon.basicWeaponAttack,
    noHorizontalOverflow: dungeon.width === dungeon.clientWidth,
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
