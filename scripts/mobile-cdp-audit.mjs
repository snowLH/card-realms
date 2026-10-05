import fs from 'node:fs/promises';
const port = 9222;
const base = `http://127.0.0.1:${port}`;
const target = await fetch(`${base}/json/new?${encodeURIComponent('http://localhost:3100')}`, { method: 'PUT' }).then(r => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let seq = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (!msg.id || !pending.has(msg.id)) return;
  const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
  if (msg.error) reject(new Error(msg.error.message));
  else resolve(msg.result);
});
function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
await cdp('Page.enable');
await cdp('Runtime.enable');
async function setViewport(width, height) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: height });
  await cdp('Page.navigate', { url: 'http://localhost:3100' });
  await wait(1800);
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}
async function clickText(text) {
  return evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})); if(!b) return false; b.click(); return true; })()`);
}
async function audit(label, width, height) {
  await setViewport(width, height);
  const intro = await evaluate(`({text:document.body.innerText.slice(0,2500),buttons:[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,40)})`);
  if ((intro.buttons || []).some(x => /visitante|preview|explorar/i.test(x))) {
    let entered = await clickText('visitante');
    if (!entered) entered = await clickText('preview');
    if (!entered) await clickText('explorar');
    await wait(900);
  }
  const metrics = await evaluate(`(() => { const all=[...document.querySelectorAll('*')]; const overflowing=all.filter(el=>el.scrollWidth>el.clientWidth+2 && getComputedStyle(el).overflowX==='visible').slice(0,30).map(el=>({tag:el.tagName,cls:el.className?.toString?.().slice(0,100)||'',sw:el.scrollWidth,cw:el.clientWidth})); return {bodyText:document.body.innerText.slice(0,3500),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,overflowing}; })()`);
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(`C:/Users/user/Documents/ChatGPT/folklard/mobile-${label}.png`, Buffer.from(shot.data, 'base64'));
  await fs.writeFile(`C:/Users/user/Documents/ChatGPT/folklard/mobile-${label}.json`, JSON.stringify({ intro, metrics }, null, 2));
  console.log(label, JSON.stringify({width,height,doc:metrics.clientWidth,scroll:metrics.scrollWidth,overflowing:metrics.overflowing.length,buttons:intro.buttons}));
}
for (const [label, width, height] of [['390x844',390,844],['430x932',430,932],['768x1024',768,1024]]) {
  await audit(label, width, height);
}
ws.close();
