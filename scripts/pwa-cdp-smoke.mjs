const debugBase = "http://127.0.0.1:9222";
const appUrl = "http://localhost:3110";
const target = await fetch(`${debugBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const [resolve, reject] = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const commandId = ++id;
  pending.set(commandId, [resolve, reject]);
  ws.send(JSON.stringify({ id: commandId, method, params }));
});
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Page.navigate", { url: appUrl });
await new Promise((resolve) => setTimeout(resolve, 1800));
const result = await cdp("Runtime.evaluate", {
  expression: `navigator.serviceWorker.ready.then((registration) => ({
    active: registration.active?.state ?? null,
    scope: registration.scope,
    controller: Boolean(navigator.serviceWorker.controller),
    script: registration.active?.scriptURL ?? null,
    displayMode: matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
  }))`,
  awaitPromise: true,
  returnByValue: true,
});
console.log(JSON.stringify(result.result.value, null, 2));
ws.close();
