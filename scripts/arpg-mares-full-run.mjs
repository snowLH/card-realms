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
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,pointerType:'touch'}));
    return true;
  })()`);
}
async function pointerUp(text) {
  return evaluate(`(() => {
    const button=[...document.querySelectorAll('button')]
      .find((item)=>item.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if(!button) return false;
    button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:9,pointerType:'touch'}));
    return true;
  })()`);
}
async function key(type, code, keyValue, vk) {
  await cdp("Input.dispatchKeyEvent", { type, code, key: keyValue, windowsVirtualKeyCode: vk });
}
function parseRoom(text) {
  const match = text.match(/Sala\s+(\d)\/5\s+·\s+(\d+)\s+inimigos/);
  return match ? { room: Number(match[1]), enemies: Number(match[2]) } : null;
}
async function readState() {
  const text = await evaluate(`document.body.innerText`);
  return {
    text,
    room: parseRoom(text),
    ended: text.includes("FIM DA EXPEDIÇÃO") || text.includes("RUN CONCLUÍDA"),
    victory: text.includes("RUN CONCLUÍDA"),
    chest: text.includes("Abrir"),
  };
}
async function move(code, keyValue, vk, duration = 900) {
  await key("keyDown", code, keyValue, vk);
  await pointerDown("dash");
  await wait(duration);
  await key("keyUp", code, keyValue, vk);
}
async function castRotation() {
  for (const ability of ["raízes ancestrais", "chama do boitatá", "tornado travesso", "canto da iara", "raízes invertidas"]) {
    await pointerDown(ability);
    await wait(120);
  }
}
async function fightRoom(maxCycles) {
  await pointerDown("ataque");
  let state = await readState();
  for (let cycle = 0; cycle < maxCycles; cycle += 1) {
    for (const [code, keyValue, vk] of [["KeyD", "d", 68], ["KeyW", "w", 87], ["KeyA", "a", 65], ["KeyS", "s", 83]]) {
      await move(code, keyValue, vk, 850);
      state = await readState();
      if (state.ended || (state.room && state.room.enemies === 0)) break;
    }
    await castRotation();
    state = await readState();
    console.log("combat", JSON.stringify({ cycle, room: state.room, ended: state.ended }));
    if (state.ended || (state.room && state.room.enemies === 0)) break;
  }
  await pointerUp("ataque");
  await wait(500);
  return readState();
}
async function nudgeToChest() {
  const stick = await evaluate(`(() => {
    const el=document.querySelector('.arpg-stick');
    if(!el) return null;
    const r=el.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2+Math.min(24,r.height*0.28)};
  })()`);
  if (!stick) return;
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: stick.x, y: stick.y }] });
  await wait(420);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(160);
}
async function openChest() {
  let state = await readState();
  if (!state.chest) return state;
  await nudgeToChest();
  await pointerDown("abrir");
  await wait(500);
  state = await readState();
  if (state.chest) {
    await nudgeToChest();
    await pointerDown("abrir");
    await wait(500);
  }
  await wait(1300);
  return readState();
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
  entry?.click(); return true;
})()`);
await wait(600);
await evaluate(`(() => {
  const play=[...document.querySelectorAll('button')].find((b)=>b.innerText.toLowerCase().includes('jogar'));
  play?.click(); return true;
})()`);
await wait(600);
await evaluate(`(() => {
  const card=[...document.querySelectorAll('.arpg-expedition-card')].find((el)=>el.innerText.includes('Arquipélago das Marés'));
  card?.querySelector('button:not(:disabled)')?.click();
  return true;
})()`);
await wait(2600);

let state = await readState();
console.log("start", JSON.stringify({ room: state.room, ended: state.ended }));
for (let expectedRoom = 1; expectedRoom <= 5; expectedRoom += 1) {
  if (state.ended) break;
  state = await fightRoom(expectedRoom === 5 ? 10 : 7);
  console.log("room-cleared", JSON.stringify({ expectedRoom, room: state.room, chest: state.chest, ended: state.ended }));
  if (state.ended) break;
  if (!state.room || state.room.enemies !== 0) break;
  if (expectedRoom < 5) {
    state = await openChest();
    console.log("after-chest", JSON.stringify({ room: state.room, chest: state.chest, ended: state.ended }));
  } else {
    await wait(1200);
    state = await readState();
  }
}
const finalText = state.text;
console.log("final", JSON.stringify({
  room: state.room,
  ended: state.ended,
  victory: state.victory,
  hasTideBlade: finalText.includes("Lâmina das Marés"),
  hasShellArmor: finalText.includes("Armadura de Conchas"),
  hasIaraStaff: finalText.includes("Cajado do Canto da Iara"),
  hasAhuizotlArmor: finalText.includes("Armadura do Ahuízotl"),
  summary: finalText.slice(0, 2200),
}, null, 2));
ws.close();
