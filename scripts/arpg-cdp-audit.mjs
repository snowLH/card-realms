import fs from "node:fs/promises";

const debugBase = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9222";
const appUrl = process.env.APP_URL ?? "http://localhost:3110";
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
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Log.enable");
await cdp("Network.enable");

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result.value;
}

async function setViewport(width, height, mobile) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 5 });
  const origin = new URL(appUrl).origin;
  await cdp("Storage.clearDataForOrigin", { origin, storageTypes: "all" });
  await cdp("Page.navigate", { url: appUrl });
  await wait(1500);
}

async function clickButtonContaining(text) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}
async function enterArpg() {
  if (await evaluate(`Boolean(document.querySelector('.title-screen__play'))`)) {
    await clickButtonContaining("jogar");
    await wait(1000);
  }
  if (await evaluate(`Boolean(document.querySelector('.welcome-view__preview'))`)) {
    let previewOpened = await clickButtonContaining("visitante");
    if (!previewOpened) previewOpened = await clickButtonContaining("explorar");
    if (!previewOpened) await clickButtonContaining("preview");
    await wait(900);
  }
  if (!await evaluate(`Boolean(document.querySelector('.arpg-expeditions'))`)) {
    const expeditionsOpened = await clickButtonContaining("jogar");
    if (!expeditionsOpened) throw new Error("Não encontrei a navegação para as expedições.");
    await wait(1000);
  }
  if (await evaluate(`Boolean(document.querySelector('.arpg-expeditions'))`)) {
    let selected = await clickButtonContaining("preparar expedição");
    if (!selected) selected = await clickButtonContaining("continuar run");
    if (!selected) throw new Error("Não encontrei uma expedição disponível para iniciar.");
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await evaluate(`Boolean(document.querySelector('.arpg-hud, .arpg-run-result, .arpg-rotate-gate'))`);
    if (ready) return;
    await wait(250);
  }
  const diagnostics = await evaluate(`({
    text:document.body.innerText.slice(0,1800),
    route:{hub:Boolean(document.querySelector('.arpg-hub-shell')),expeditions:Boolean(document.querySelector('.arpg-expeditions')),game:Boolean(document.querySelector('.arpg-shell')),rotate:Boolean(document.querySelector('.arpg-rotate-gate'))},
    canvas:document.querySelectorAll('canvas').length
  })`);
  throw new Error(`O ARPG não abriu depois da seleção da expedição: ${JSON.stringify(diagnostics)}`);
}

async function audit(label, width, height, mobile) {
  events.length = 0;
  await setViewport(width, height, mobile);
  const landing = await evaluate(`(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(el).display};
    };
    return {
      viewport:{width:innerWidth,height:innerHeight},
      document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
      title:rect('.title-screen'),
      heading:rect('.title-screen h1'),
      play:rect('.title-screen__play'),
      playText:document.querySelector('.title-screen__play')?.innerText.trim()??''
    };
  })()`);
  const landingShot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(`C:/Users/user/Documents/ChatGPT/folklard/title-${label}.png`, Buffer.from(landingShot.data, "base64"));
  await fs.writeFile(`C:/Users/user/Documents/ChatGPT/folklard/title-${label}.json`, JSON.stringify({ landing }, null, 2));
  await enterArpg();
  const compactLandscape = mobile && width > height && height <= 520;
  const portraitMobile = mobile && height > width && width <= 900;
  const metrics = await evaluate(`(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, w:r.width, h:r.height, sw:el.scrollWidth, cw:el.clientWidth, sh:el.scrollHeight, ch:el.clientHeight, display:getComputedStyle(el).display };
    };
    return {
      doc:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight},
      shell:rect('.arpg-shell'), canvas:rect('.arpg-stage__canvas canvas'), hud:rect('.arpg-hud'),
      touch:rect('.arpg-touch'), rotate:rect('.arpg-rotate-gate'), result:rect('.arpg-run-result'),
      topbarButtons:[...document.querySelectorAll('.arpg-shell__topbar button')].map((el)=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height}}),
      touchButtons:[...document.querySelectorAll('.arpg-touch button')].map((el)=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,visible:getComputedStyle(el).display!=='none'}}),
      cardPortraits:document.querySelectorAll('.arpg-touch__cards .arpg-touch__creature').length,
      powerNames:[...document.querySelectorAll('.arpg-touch__cards .arpg-touch__card-name')]
        .map((el)=>({text:el.textContent?.trim()??'',fontSize:parseFloat(getComputedStyle(el).fontSize)})),
      cardCooldowns:[...document.querySelectorAll('.arpg-touch__cards small')].map((el)=>({text:el.textContent?.trim()??'',fontSize:parseFloat(getComputedStyle(el).fontSize),visible:getComputedStyle(el).display!=='none'})),
      touchAttackSlots:document.querySelectorAll('.arpg-touch__cards button').length,
      touchSupportControls:Boolean(document.querySelector('.arpg-touch__support')),
      basicWeaponAttack:Boolean(document.querySelector('.arpg-touch__attack')),
      basicWeaponAttackLabel:document.querySelector('.arpg-touch__attack')?.getAttribute('aria-label')??'',
      hudBand:{status:rect('.arpg-hud__status'),equipment:rect('.arpg-hud__loadout'),minimap:rect('.arpg-hud__minimap')},
      touchTextFontSizes:[...document.querySelectorAll('.arpg-shell--portrait-mobile .arpg-hud__status span, .arpg-shell--portrait-mobile .arpg-touch__combat button span')]
        .map((el)=>parseFloat(getComputedStyle(el).fontSize)),
      minimapLabelFontSize:(()=>{const el=document.querySelector('.arpg-shell--portrait-mobile .arpg-hud__minimap > span');return el?parseFloat(getComputedStyle(el).fontSize):null})(),
      compactMedia:matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 520px)').matches,
      text:document.body.innerText.slice(0,1800)
    };
  })()`);

  const fatalEvents = events.filter((event) => {
    if (event.method === "Runtime.exceptionThrown") return true;
    const entry = event.params?.entry;
    return entry?.level === "error" && !String(entry?.text ?? "").includes("beforeinstallprompt");
  });
  const checks = {
    pageFitsViewport: metrics.doc.sw <= metrics.doc.cw && metrics.doc.sh <= metrics.doc.ch,
    canvasReady: Boolean(metrics.canvas),
    mobileTouchControls: !mobile || metrics.touch?.display !== "none",
    portraitCanPlay: !portraitMobile || (Boolean(metrics.canvas)
      && (!metrics.rotate || metrics.rotate.display === "none")
      && metrics.touch?.display !== "none"),
    noFatalRuntimeErrors: fatalEvents.length === 0,
    portraitTopbarTargetsAtLeast44: !portraitMobile || (metrics.topbarButtons.length > 0
      && metrics.topbarButtons.every((button) => button.w >= 44 && button.h >= 44)),
    portraitTouchTargetsAtLeast44: !portraitMobile || (metrics.touchButtons.length > 0
      && metrics.touchButtons.every((button) => !button.visible || (button.w >= 44 && button.h >= 44))),
    portraitTwoPowersReadable: !portraitMobile || (metrics.touchAttackSlots === 2
      && metrics.cardPortraits === 2 && metrics.powerNames.length === 2
      && metrics.powerNames.every((item) => item.text.length > 0 && item.fontSize >= 9)
      && metrics.cardCooldowns.length === 2
      && metrics.cardCooldowns.every((item) => item.visible && item.text.length > 0 && item.fontSize >= 9)),
    portraitHudTextReadable: !portraitMobile || (metrics.touchTextFontSizes.length > 0
      && metrics.touchTextFontSizes.every((size) => size >= 9)
      && metrics.minimapLabelFontSize >= 9),
    portraitNoSupportControls: !portraitMobile || !metrics.touchSupportControls,
    portraitAttackAvailable: !portraitMobile || (metrics.basicWeaponAttack
      && metrics.basicWeaponAttackLabel.toLowerCase().includes("mirar")),
    compactTopbarButtonsAtLeast48: !compactLandscape || (metrics.compactMedia && metrics.topbarButtons.length > 0
      && metrics.topbarButtons.every((button) => button.w >= 48 && button.h >= 48)),
    compactTouchButtonsAtLeast48: !compactLandscape || (metrics.touchButtons.length > 0
      && metrics.touchButtons.every((button) => !button.visible || (button.w >= 48 && button.h >= 48))),
    compactTwoPowerSlotsAndCooldowns: !compactLandscape || (metrics.touchAttackSlots === 2
      && metrics.cardPortraits === 2 && metrics.powerNames.length === 2
      && metrics.cardCooldowns.length === 2 && metrics.cardCooldowns.every((item) => item.visible && item.text.length > 0)),
    compactNoSupportControls: !compactLandscape || !metrics.touchSupportControls,
    compactBasicWeaponAttackAvailable: !compactLandscape || metrics.basicWeaponAttack,
    compactHudUsesOneBand: !compactLandscape || (metrics.hudBand.status && metrics.hudBand.equipment && metrics.hudBand.minimap
      && Math.max(metrics.hudBand.status.y, metrics.hudBand.equipment.y, metrics.hudBand.minimap.y)
        - Math.min(metrics.hudBand.status.y, metrics.hudBand.equipment.y, metrics.hudBand.minimap.y) <= 2),
    compactHudNoOverflow: !compactLandscape || (metrics.hudBand.status?.sw <= metrics.hudBand.status?.cw
      && metrics.hudBand.equipment?.sw <= metrics.hudBand.equipment?.cw
      && metrics.hudBand.minimap?.sw <= metrics.hudBand.minimap?.cw),
  };
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(`C:/Users/user/Documents/ChatGPT/folklard/arpg-${label}.png`, Buffer.from(shot.data, "base64"));
  await fs.writeFile(`C:/Users/user/Documents/ChatGPT/folklard/arpg-${label}.json`, JSON.stringify({ metrics, events, checks }, null, 2));
  console.log(label, JSON.stringify({ width, height, doc: metrics.doc, shell: metrics.shell, canvas: metrics.canvas, touch: metrics.touch, rotate: metrics.rotate, checks }));
  if (Object.values(checks).some((passed) => !passed)) throw new Error(`Auditoria ARPG falhou em ${label}: ${Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name).join(", ")}`);
}
try {
  for (const [label, width, height, mobile] of [
    ["1920x1080", 1920, 1080, false],
    ["1366x768", 1366, 768, false],
    ["1280x720", 1280, 720, false],
    ["640x360-mobile", 640, 360, true],
    ["844x390", 844, 390, true],
    ["932x430", 932, 430, true],
    ["1024x768-tablet", 1024, 768, true],
    ["390x844-portrait", 390, 844, true],
  ]) {
    await audit(label, width, height, mobile);
  }
} finally {
  ws.close();
  await fetch(`${debugBase}/json/close/${encodeURIComponent(target.id)}`).catch(() => undefined);
}
