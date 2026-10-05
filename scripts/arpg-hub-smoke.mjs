import fs from "node:fs/promises";

const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.APP_URL ?? "http://localhost:3110";
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

async function clickSelector(selector) {
  const point = await evaluate(`(() => {
    const element=document.querySelector(${JSON.stringify(selector)});
    if(!element) return null;
    const rect=element.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  if (!point) return false;
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  return true;
}
async function touchSelector(selector) {
  const point = await evaluate(`(() => {
    const element=document.querySelector(${JSON.stringify(selector)});
    if(!element) return null;
    const rect=element.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  if (!point) return false;
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return true;
}
async function steerHubJoystick(upMs, rightMs) {
  const center = await evaluate(`(() => {
    const stick=document.querySelector('.arpg-hub-stick');
    if(!stick) return null;
    const rect=stick.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,radius:rect.width*0.42};
  })()`);
  if (!center) return false;
  const at = (x, y) => ({ x, y, id: 3, radiusX: 1, radiusY: 1, force: 1 });
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(center.x, center.y)] });
  await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(center.x, center.y - center.radius * 0.82)] });
  await wait(upMs);
  await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(center.x + center.radius * 0.82, center.y)] });
  await wait(rightMs);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return true;
}
async function pressKey(key, code, durationMs = 160) {
  const virtualKey = { a: 65, d: 68, e: 69, s: 83, w: 87 }[key.toLowerCase()];
  await cdp("Input.dispatchKeyEvent", {
    type: "keyDown", key, code, ...(virtualKey ? { windowsVirtualKeyCode: virtualKey } : {}),
  });
  await wait(durationMs);
  await cdp("Input.dispatchKeyEvent", {
    type: "keyUp", key, code, ...(virtualKey ? { windowsVirtualKeyCode: virtualKey } : {}),
  });
}
async function clickButtonWithText(text) {
  const point = await evaluate(`(() => {
    const element=[...document.querySelectorAll('button')].find((button)=>button.textContent?.trim()===${JSON.stringify(text)});
    if(!element) return null;
    const rect=element.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  if (!point) return false;
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  return true;
}
async function configureViewport(width, height, mobile) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
  });
  await cdp("Emulation.setTouchEmulationEnabled", {
    enabled: mobile,
    maxTouchPoints: mobile ? 5 : 1,
  });
}

async function waitForHubReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await evaluate(`(() => {
      const prompt=document.querySelector('.arpg-hub-prompt')?.textContent??'';
      return Boolean(document.querySelector('.arpg-hub-stage canvas')) && !prompt.startsWith('Carregando');
    })()`);
    if (ready) return true;
    await wait(250);
  }
  return false;
}

async function openHub(width, height, mobile) {
  await configureViewport(width, height, mobile);
  await cdp("Page.navigate", { url: appUrl });
  await wait(1200);
  if (await evaluate(`Boolean(document.querySelector('.title-screen__play'))`)) {
    await clickSelector(".title-screen__play");
    await wait(700);
  }
  if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
    await clickSelector('.welcome-view__preview');
    await wait(900);
  }
  await waitForHubReady();
  return evaluate(`(() => {
    const canvas=document.querySelector('.arpg-hub-stage canvas');
    const rect=canvas?.getBoundingClientRect();
    return {
      hub:Boolean(document.querySelector('.arpg-hub-shell')),
      canvas:Boolean(canvas),
      canvasRect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      prompt:document.querySelector('.arpg-hub-prompt')?.textContent??'',
      touch:document.querySelector('.arpg-hub-touch')?getComputedStyle(document.querySelector('.arpg-hub-touch')).display:null,
    };
  })()`);
}
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");

const desktop = await openHub(1366, 768, false);
if (!desktop.hub || !desktop.canvas) throw new Error("HUB físico não carregou no desktop.");

const soundEnabledAtStart = await evaluate(`(() => {
  const button=document.querySelector('button[aria-label="Desativar música e sons"]');
  return button?.getAttribute('aria-pressed') === 'true';
})()`);
const muteButtonClicked = await clickSelector('button[aria-label="Desativar música e sons"]');
const soundMutedAndPersisted = await evaluate(`document.querySelector('button[aria-label="Ativar música e sons"]')?.getAttribute('aria-pressed') === 'false'
  && window.localStorage.getItem('arpg.soundEnabled') === 'false'`);
const unmuteButtonClicked = await clickSelector('button[aria-label="Ativar música e sons"]');
const soundEnabledAndPersisted = await evaluate(`document.querySelector('button[aria-label="Desativar música e sons"]')?.getAttribute('aria-pressed') === 'true'
  && window.localStorage.getItem('arpg.soundEnabled') === 'true'`);

const desktopStationClick = {
  x: desktop.canvasRect.x + desktop.canvasRect.width * 0.5,
  y: desktop.canvasRect.y + desktop.canvasRect.height * 0.15,
};
await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...desktopStationClick, button: "none" });
await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...desktopStationClick, button: "left", clickCount: 1 });
await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...desktopStationClick, button: "left", clickCount: 1 });
await wait(1500);
const clickPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
const promptAfterWalk = clickPrompt;
const clickDidNotTeleport = !(await evaluate(`Boolean(document.querySelector('.arpg-expeditions'))`));

await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
await wait(140);
await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
await wait(650);
const physicalNavigationWorked = await evaluate(`Boolean(document.querySelector('.arpg-expeditions'))`);

await clickSelector(".brand");
await waitForHubReady();
await pressKey("a", "KeyA", 760);
const archivePrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
await pressKey("e", "KeyE");
await wait(650);
const archiveOpenedLoadout = await evaluate(`Boolean(document.querySelector('.arpg-loadout-view'))`);
const archiveShowsAbilityCards = await evaluate(`Array.from(document.querySelectorAll('.arpg-loadout-section__heading'))
  .some((heading)=>heading.textContent?.includes('Ataques das lendas'))`);
const archiveFocusCorrect = await evaluate(`document.querySelector('#arpg-loadout-title')?.textContent === 'Arquivo de Poderes'
  && document.querySelectorAll('[aria-label="Dois espaços de ataque"] button').length === 2
  && !Array.from(document.querySelectorAll('.arpg-loadout-section__heading')).some((heading)=>heading.textContent?.includes('Suportes'))`);
const archivePurchaseClicked = await clickSelector('button[aria-label^="Caipora, Flecha da Caipora: Comprar por"]');
await wait(450);
const archivePurchaseWorked = await evaluate(`Boolean(document.querySelector('.arpg-ability-collection button.is-owned[aria-label^="Caipora, Flecha da Caipora:"]'))
  && (document.querySelector('[role="status"]')?.textContent ?? '').includes('foi adicionada à sua coleção')`);

await clickSelector(".brand");
await waitForHubReady();
await pressKey("d", "KeyD", 760);
const merchantPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
await pressKey("e", "KeyE");
await wait(650);
const merchantOpenedVillage = await evaluate(`Boolean(document.querySelector('.village-view'))`);
const merchantOnlyOffersCosmetics = await evaluate(`Array.from(document.querySelectorAll('.village-catalog-card'))
  .length > 0 && Array.from(document.querySelectorAll('.village-catalog-card'))
  .every((card)=>card.getAttribute('data-category') === 'cosmetic')
  && !/arma|armadura/i.test(document.querySelector('.village-catalog-grid')?.textContent ?? '')`);
const merchantBackLabel = await evaluate(`document.querySelector('.village-view__header button')?.textContent?.trim() ?? ''`);
const merchantReturned = await clickButtonWithText("Voltar à Guilda");
await waitForHubReady();
const merchantReturnsToHub = await evaluate(`Boolean(document.querySelector('.arpg-hub-shell .arpg-hub-stage canvas'))`);

await pressKey("w", "KeyW", 280);
await pressKey("d", "KeyD", 1550);
await wait(350);
const avatarPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
await pressKey("e", "KeyE");
await wait(650);
const avatarOpened = await evaluate(`document.querySelector('#arpg-loadout-title')?.textContent === 'Seu personagem'
  && Boolean(document.querySelector('.character-creator'))`);
const avatarBackLabel = await evaluate(`Array.from(document.querySelectorAll('.arpg-loadout-hero button'))
  .some((button)=>button.textContent?.includes('Voltar à Guilda'))`);
await configureViewport(900, 900, false);
await wait(200);
const compactDesktopAvatarLayout = await evaluate(`(() => {
  const creator=document.querySelector('.character-creator');
  const save=creator?.querySelector('.character-creator__book > button');
  if(!creator || !save) return {creator:false,withinViewport:false,saveInside:false,noHorizontalOverflow:false};
  const card=creator.getBoundingClientRect();
  const button=save.getBoundingClientRect();
  return {
    creator:true,
    withinViewport:card.left>=0 && card.right<=window.innerWidth+1,
    saveInside:button.left>=card.left-1 && button.right<=card.right+1,
    noHorizontalOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
  };
})()`);
await configureViewport(390, 844, true);
await wait(200);
const mobileAvatarLayout = await evaluate(`(() => {
  const creator=document.querySelector('.character-creator');
  const save=creator?.querySelector('.character-creator__book > button');
  if(!creator || !save) return {creator:false,withinViewport:false,saveInside:false,noHorizontalOverflow:false};
  const card=creator.getBoundingClientRect();
  const button=save.getBoundingClientRect();
  return {
    creator:true,
    withinViewport:card.left>=0 && card.right<=window.innerWidth+1,
    saveInside:button.left>=card.left-1 && button.right<=card.right+1,
    noHorizontalOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
  };
})()`);
await configureViewport(1366, 768, false);
await wait(200);
const avatarReturned = await clickButtonWithText('Voltar à Guilda');
await waitForHubReady();

await clickSelector(".brand");
await waitForHubReady();
await pressKey("w", "KeyW", 500);
await pressKey("d", "KeyD", 2500);
await pressKey("s", "KeyS", 1200);
await pressKey("a", "KeyA", 1300);
const altarPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
await pressKey("e", "KeyE");
await wait(650);
const altarOpensWeeklyBoss = await evaluate(`Boolean(document.querySelector('.raid-view h1')?.textContent?.includes('Raids Míticas de sábado'))`);

await clickSelector(".brand");
await waitForHubReady();
await pressKey("s", "KeyS", 1050);
await wait(350);
const portalPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
await pressKey("e", "KeyE");
await wait(650);
const portalOpensExpeditions = await evaluate(`Boolean(document.querySelector('.arpg-expeditions'))`);

await clickSelector(".brand");
await waitForHubReady();
await pressKey("w", "KeyW", 500);
await pressKey("d", "KeyD", 1000);
await pressKey("a", "KeyA", 250);
await pressKey("w", "KeyW", 650);
await pressKey("d", "KeyD", 650);
const bestiaryPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
await pressKey("e", "KeyE");
await wait(650);
const bestiaryOpensCollection = await evaluate(`Boolean(document.querySelector('.collection-view h1')?.textContent?.includes('Bestiário de Aurória'))
  && document.querySelector('.collection-view')?.innerText.includes('origens')`);

const mobile = await openHub(844, 390, true);
const mobileStationTap = {
  x: mobile.canvasRect.x + mobile.canvasRect.width * 0.5,
  y: mobile.canvasRect.y + mobile.canvasRect.height * 0.15,
};
await cdp("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ ...mobileStationTap, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
});
await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await wait(1500);
const mobileTapPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile(
  "C:/Users/user/Documents/ChatGPT/folklard/arpg-hub-mobile-smoke.png",
  Buffer.from(screenshot.data, "base64"),
);
const mobileReset = await openHub(844, 390, true);
const mobileJoystickMoved = await steerHubJoystick(280, 1800);
await wait(350);
const mobileAvatarPrompt = await evaluate(`document.querySelector('.arpg-hub-prompt')?.textContent ?? ''`);
const mobileInteracted = await touchSelector(".arpg-hub-touch > button");
await wait(700);
const mobileAvatarOpened = await evaluate(`document.querySelector('#arpg-loadout-title')?.textContent === 'Seu personagem'
  && Boolean(document.querySelector('.character-creator'))`);
const mobileLoadoutNoOverflow = await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`);
const fatalEvents = events.filter((event) => {
  if (event.method === "Runtime.exceptionThrown") return true;
  const entry = event.params?.entry;
  return entry?.level === "error" && !String(entry?.text ?? "").includes("beforeinstallprompt");
});

const result = {
  desktop,
  soundEnabledAtStart,
  muteButtonClicked,
  soundMutedAndPersisted,
  unmuteButtonClicked,
  soundEnabledAndPersisted,
  promptAfterWalk,
  clickPrompt,
  clickDidNotTeleport,
  physicalNavigationWorked,
  archivePrompt,
  archiveOpenedLoadout,
  archiveShowsAbilityCards,
  archiveFocusCorrect,
  archivePurchaseClicked,
  archivePurchaseWorked,
  merchantPrompt,
  merchantOpenedVillage,
  merchantOnlyOffersCosmetics,
  merchantBackLabel,
  merchantReturned,
  merchantReturnsToHub,
  avatarPrompt,
  avatarOpened,
  avatarBackLabel,
  compactDesktopAvatarLayout,
  mobileAvatarLayout,
  avatarReturned,
  altarPrompt,
  altarOpensWeeklyBoss,
  portalPrompt,
  portalOpensExpeditions,
  bestiaryPrompt,
  bestiaryOpensCollection,
  mobile,
  mobileTapPrompt,
  mobileReset: mobileReset.hub && mobileReset.canvas,
  mobileJoystickMoved,
  mobileAvatarPrompt,
  mobileInteracted,
  mobileAvatarOpened,
  mobileLoadoutNoOverflow,
  fatalEventCount: fatalEvents.length,
  checks: {
    desktopCanvasReady: desktop.hub && desktop.canvas,
    desktopNoOverflow: desktop.overflow === false,
    promptDetectedCartographer: /Cartógrafo|Expedições/i.test(promptAfterWalk),
    desktopClickMovesNearStation: /Cartógrafo|Expedições/i.test(clickPrompt),
    clickRequiresPhysicalInteraction: clickDidNotTeleport,
    physicalNavigationWorked,
    soundToggleAvailable: soundEnabledAtStart,
    soundMutePersists: muteButtonClicked && soundMutedAndPersisted,
    soundUnmutePersists: unmuteButtonClicked && soundEnabledAndPersisted,
    archiveStationReached: /Arquivo de Poderes|Ataques das lendas/i.test(archivePrompt),
    archiveOpensAbilityLoadout: archiveOpenedLoadout && archiveShowsAbilityCards,
    archiveOpensFocusedCardCollection: archiveFocusCorrect,
    archiveBuysAbilityWithLocalCoins: archivePurchaseClicked && archivePurchaseWorked,
    merchantStationReached: /Mercador|Empório de Aurória/i.test(merchantPrompt),
    merchantOpensCosmeticShop: merchantOpenedVillage && merchantOnlyOffersCosmetics,
    merchantReturnsToHub: merchantBackLabel.includes("Voltar à Guilda") && merchantReturned && merchantReturnsToHub,
    avatarStudioReached: /Ateliê do Cartógrafo|Seu personagem/i.test(avatarPrompt),
    avatarStudioOpensCreator: avatarOpened,
    compactDesktopAvatarFits: compactDesktopAvatarLayout.creator && compactDesktopAvatarLayout.withinViewport && compactDesktopAvatarLayout.saveInside && compactDesktopAvatarLayout.noHorizontalOverflow,
    mobileAvatarFits: mobileAvatarLayout.creator && mobileAvatarLayout.withinViewport && mobileAvatarLayout.saveInside && mobileAvatarLayout.noHorizontalOverflow,
    avatarStudioReturnsToHub: avatarBackLabel && avatarReturned,
    mythicAltarStationReached: /Altar Mítico|Boss semanal/i.test(altarPrompt),
    mythicAltarOpensWeeklyBoss: altarOpensWeeklyBoss,
    dungeonPortalStationReached: /Portal das Dungeons/i.test(portalPrompt),
    dungeonPortalOpensExpeditions: portalOpensExpeditions,
    bestiaryKeeperReached: /Luzia, naturalista/i.test(bestiaryPrompt),
    bestiaryStationOpensFolkloreCollection: bestiaryOpensCollection,
    mobileCanvasReady: mobile.hub && mobile.canvas,
    mobileNoOverflow: mobile.overflow === false,
    mobileTouchVisible: mobile.touch !== "none",
    mobileTapMovesNearStation: /Cartógrafo|Expedições/i.test(mobileTapPrompt),
    mobileHubReset: mobileReset.hub && mobileReset.canvas,
    mobileJoystickMoved,
    mobileAvatarStudioReached: /Ateliê do Cartógrafo|Seu personagem/i.test(mobileAvatarPrompt),
    mobileAvatarStudioOpensCreator: mobileInteracted && mobileAvatarOpened,
    mobileLoadoutNoOverflow,
    noFatalRuntimeErrors: fatalEvents.length === 0,
  },
};
console.log(JSON.stringify(result, null, 2));
const failed = Object.entries(result.checks).filter(([, value]) => value !== true);
ws.close();
if (failed.length) throw new Error(`Smoke do HUB falhou: ${failed.map(([key]) => key).join(", ")}`);
