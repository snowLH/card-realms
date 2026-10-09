import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const origin = "https://folklard.test";
const source = readFileSync("public/sw.js", "utf8");

function worker() {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const key = (request: string | { url: string }) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      const entries = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, entries);
      return {
        match: async (request: string | { url: string }) => entries.get(key(request))?.clone(),
        put: async (request: string | { url: string }, response: Response) => { entries.set(key(request), response.clone()); },
        addAll: async () => {},
      };
    },
    match: async (request: string | { url: string }) => {
      for (const entries of stores.values()) if (entries.has(key(request))) return entries.get(key(request))!.clone();
    },
  };
  const fetch = vi.fn<(path: string) => Promise<Response>>().mockImplementation(async () => new Response("network"));
  runInNewContext(source, { caches, fetch, URL, Response, Promise, Set, Error,
    self: { location: new URL(origin), addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) => handlers.set(name, handler), skipWaiting: async () => {}, clients: { claim: async () => {} } },
  });
  const prepare = async () => {
    const messages: Array<{ ready: boolean; error?: string }> = [];
    let task: Promise<unknown> | undefined;
    handlers.get("message")!({ data: { type: "PREPARE_OFFLINE" }, ports: [{ postMessage: (message: { ready: boolean; error?: string }) => messages.push(message) }], waitUntil: (pending: Promise<unknown>) => { task = pending; } });
    await task;
    return messages;
  };
  const request = async (path: string, navigate = false) => {
    let result: Promise<Response> | undefined;
    const tasks: Promise<unknown>[] = [];
    handlers.get("fetch")!({ request: { url: `${origin}${path}`, method: "GET", mode: navigate ? "navigate" : "cors", destination: navigate ? "document" : "image" },
      respondWith: (pending: Promise<Response>) => { result = pending; }, waitUntil: (pending: Promise<unknown>) => tasks.push(pending),
    });
    const response = await result;
    await Promise.all(tasks);
    return response;
  };
  return { caches, fetch, prepare, request };
}

describe("offline game pack and fast immutable cache", () => {
  it("reopens offline through the public solo shell and never caches account pages or APIs", async () => {
    const w = worker();
    w.fetch.mockImplementation(async (path) => String(path) === "/offline-pack.json"
      ? Response.json({ version: "a", files: ["/offline", "/art/hero-v4.webp"] }) : new Response("public solo"));
    expect((await w.prepare()).at(-1)?.ready).toBe(true);
    const before = w.fetch.mock.calls.length;
    expect(await (await w.request("/art/hero-v4.webp"))?.text()).toBe("public solo");
    expect(w.fetch.mock.calls.length).toBe(before);
    w.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await w.request("/", true))?.headers.get("location")).toBe(`${origin}/offline`);
    expect(await (await w.request("/offline", true))?.text()).toBe("public solo");
    expect(await w.request("/api/player/progress")).toBeUndefined();
  });

  it("keeps the last complete offline game after a failed update", async () => {
    const w = worker();
    w.fetch.mockImplementation(async (path) => String(path) === "/offline-pack.json"
      ? Response.json({ version: "a", files: ["/offline"] }) : new Response("old complete game"));
    await w.prepare();
    w.fetch.mockImplementation(async (path) => String(path) === "/offline-pack.json"
      ? Response.json({ version: "b", files: ["/offline", "/art/missing.webp"] })
      : String(path).includes("missing") ? new Response("not found", { status: 404 }) : new Response("new partial game"));
    expect((await w.prepare()).at(-1)?.error).toContain("missing.webp");
    w.fetch.mockRejectedValue(new TypeError("offline"));
    expect(await (await w.request("/offline", true))?.text()).toBe("old complete game");
  });
});
