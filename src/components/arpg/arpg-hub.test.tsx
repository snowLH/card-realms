// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArpgHub } from "./arpg-hub";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const createHubGameMock = vi.hoisted(() => vi.fn());
vi.mock("@/game/arpg/runtime/create-hub-game", () => ({ createArpgHubGame: createHubGameMock }));

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("arpg.soundEnabled", "false");
  createHubGameMock.mockResolvedValue({ destroy: vi.fn() });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("ArpgHub audio control", () => {
  it("restores and persists the shared sound preference accessibly", async () => {
    render(
      <ArpgHub
        playerName="Explorador"
        level={1}
        coins={500}
        onNavigate={vi.fn()}
      />,
    );

    const enableButton = await screen.findByRole("button", { name: "Ativar música e sons" });
    expect(enableButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(enableButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "Desativar música e sons" })).toHaveAttribute("aria-pressed", "true"));
    expect(window.localStorage.getItem("arpg.soundEnabled")).toBe("true");
  });

  it("passes the saved avatar configuration into the physical Guilda", async () => {
    const avatarConfig = {
      ...DEFAULT_AVATAR_CONFIG,
      skin: "rose" as const,
      hair: "waves" as const,
      outfit: "ranger" as const,
      armor: "none" as const,
      accent: "emerald" as const,
    };

    render(
      <ArpgHub
        playerName="Explorador"
        level={1}
        coins={500}
        avatarConfig={avatarConfig}
        onNavigate={vi.fn()}
      />,
    );

    await waitFor(() => expect(createHubGameMock).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.anything(),
      expect.any(Function),
      expect.any(Function),
      avatarConfig,
    ));
  });
});
