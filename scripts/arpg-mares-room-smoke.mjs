const debugBase = "http://127.0.0.1:9222";
const appUrl = "http://localhost:3110";
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
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
async function pointerDown(text) {
  return evaluate(`(() => {
    const button=[...document.querySelectorAll('button')]
      .find((item)=>item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if(!button) return false;
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,pointerType:'touch'}));
    return true;
  })()`);
}
async function pointerUp(text) {
  return evaluate(`(() => {
    const button=[...document.querySelectorAll('button')]
      .find((item)=>item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if(!button) return false;
    button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,pointerType:'touch'}));
    return true;
  })()`);
}
async function key(type, code, keyValue, vk) {
  await cdp("Input.dispatchKeyEvent", { type, code, key: keyValue, windowsVirtualKeyCode: vk });
}
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 390, deviceScaleFactor: 1, mobile: true,
  screenWidth: 844, screenHeight: 390,
});
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await cdp("Page.navigate", { url: appUrl });
await wait(1500);

await evaluate(`(() => {
  const entry=[...document.querySelectorAll('button')].find((b)=>/visitante|explorar|preview/i.test(b.innerText));
  entry?.click();
  return true;
})()`);
await wait(600);
await evaluate(`(() => {
  const play=[...document.querySelectorAll('button')].find((b)=>b.innerText.toLowerCase().includes('jogar'));
  play?.click();
  return true;
})()`);
await wait(600);
await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')].find((el)=>el.innerText.includes('Arquipélago das Marés'));
  card?.querySelector('button:not(:disabled)')?.click();
  return true;
})()`);
await wait(2600);
await pointerDown("ataque");
await key("keyDown", "KeyD", "d", 68);
for (const ability of ["raízes ancestrais", "chama do boitatá", "tornado travesso", "canto da iara", "raízes invertidas"]) {
  await pointerDown(ability);
  await wait(180);
}
await pointerDown("dash");
await wait(2200);
await key("keyUp", "KeyD", "d", 68);
await key("keyDown", "KeyW", "w", 87);
await pointerDown("dash");
await wait(2200);
await key("keyUp", "KeyW", "w", 87);
await key("keyDown", "KeyA", "a", 65);
for (const ability of ["chama do boitatá", "tornado travesso"]) {
  await pointerDown(ability);
  await wait(160);
}
await wait(2400);
await key("keyUp", "KeyA", "a", 65);
await key("keyDown", "KeyS", "s", 83);
await pointerDown("dash");
await wait(2200);
await key("keyUp", "KeyS", "s", 83);

for (let cycle = 0; cycle < 2; cycle += 1) {
  for (const [code, keyValue, vk] of [["KeyD", "d", 68], ["KeyW", "w", 87], ["KeyA", "a", 65], ["KeyS", "s", 83]]) {
    await key("keyDown", code, keyValue, vk);
    await pointerDown("dash");
    await wait(1300);
    await key("keyUp", code, keyValue, vk);
  }
  for (const ability of ["raízes ancestrais", "chama do boitatá", "tornado travesso", "canto da iara", "raízes invertidas"]) {
    await pointerDown(ability);
    await wait(140);
  }
}

await pointerUp("ataque");
await wait(700);

let body = await evaluate(`document.body.innerText`);
let chestResolutionText = "";
console.log("after-wave", body.match(/Sala\s+\d\/5[^\n]*/)?.[0] ?? "no-room", body.includes("Abrir"), body.includes("FIM DA EXPEDIÇÃO"));
if (body.includes("Abrir") && !body.includes("FIM DA EXPEDIÇÃO")) {
  const stick = await evaluate(`(() => {
    const el=document.querySelector('.arpg-stick');
    if(!el) return null;
    const r=el.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2+Math.min(24,r.height*0.28)};
  })()`);
  if (stick) {
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: stick.x, y: stick.y }] });
    await wait(420);
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await wait(180);
  }
  await pointerDown("abrir");
  await wait(220);
  body = await evaluate(`document.body.innerText`);
  if (!body.includes("Abrir")) chestResolutionText = body;

  const searchMoves = [
    ["KeyW", "w", 87, 500], ["KeyS", "s", 83, 1000],
    ["KeyW", "w", 87, 500], ["KeyA", "a", 65, 500],
    ["KeyD", "d", 68, 1000], ["KeyA", "a", 65, 500],
  ];
  for (const [code, keyValue, vk, duration] of searchMoves) {
    if (!body.includes("Abrir")) break;
    await key("keyDown", code, keyValue, vk);
    await wait(duration);
    await key("keyUp", code, keyValue, vk);
    await pointerDown("abrir");
    await wait(220);
    body = await evaluate(`document.body.innerText`);
    if (!body.includes("Abrir")) chestResolutionText = body;
  }
  await wait(1400);
  body = await evaluate(`document.body.innerText`);
}

const result = {
  room: body.match(/Sala\s+\d\/5[^\n]*/)?.[0] ?? null,
  chestAvailable: body.includes("Abrir"),
  runEnded: body.includes("FIM DA EXPEDIÇÃO") || body.includes("RUN CONCLUÍDA"),
  cardDropObserved: chestResolutionText.includes("carta Impacto do Kappa"),
  chestResolution: chestResolutionText.slice(0, 600),
  text: body.slice(0, 1800),
};
console.log("result", JSON.stringify(result, null, 2));
ws.close();
