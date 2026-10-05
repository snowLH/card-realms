// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { HubTouchControls } from "./hub-touch-controls";

afterEach(cleanup);

describe("HubTouchControls", () => {
  it("queues station interaction from a button click, including keyboard activation", () => {
    const bridge = {
      setMove: vi.fn(),
      queueInteract: vi.fn(),
    } as unknown as ArpgBridge;
    render(<HubTouchControls bridge={bridge} />);

    const interact = screen.getByRole("button", { name: "Interagir com a estação próxima" });
    fireEvent.click(interact);

    expect(bridge.queueInteract).toHaveBeenCalledTimes(1);
  });
});
