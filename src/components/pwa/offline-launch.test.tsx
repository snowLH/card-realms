// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OfflineLaunch } from "./offline-launch";

const originalWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalWorker) Object.defineProperty(navigator, "serviceWorker", originalWorker);
  else Reflect.deleteProperty(navigator, "serviceWorker");
});

it("waits for a compatible worker when upgrading an existing player's cached game", async () => {
  const channels: TestChannel[] = [];
  class TestChannel {
    port1 = { onmessage: null as null | ((event: { data: unknown }) => void), close: vi.fn() };
    port2 = {};
    constructor() { channels.push(this); }
  }
  vi.stubGlobal("MessageChannel", TestChannel);
  const legacyWorker = { postMessage: vi.fn() };
  const currentWorker = { postMessage: vi.fn((_message: unknown, ports: object[]) => {
    const channel = channels.find((entry) => entry.port2 === ports[0])!;
    channel.port1.onmessage?.({ data: { ready: false, completed: 0, total: 0 } });
  }) };
  const workers = Object.assign(new EventTarget(), {
    controller: legacyWorker as typeof legacyWorker | typeof currentWorker,
    ready: Promise.resolve({ active: legacyWorker }),
  });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: workers });
  render(<OfflineLaunch />);
  await waitFor(() => expect(legacyWorker.postMessage).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Preparar jogo offline" })).toBeDisabled();
  await act(async () => {
    workers.controller = currentWorker;
    workers.dispatchEvent(new Event("controllerchange"));
  });
  expect(screen.getByRole("button", { name: "Preparar jogo offline" })).toBeEnabled();
});
