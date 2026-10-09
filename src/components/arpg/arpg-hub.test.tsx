// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArpgHub } from "./arpg-hub";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";

const createHubGameMock = vi.hoisted(() => vi.fn());
const portraitModeMock = vi.fn();
const queryStates = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
vi.mock("@/game/arpg/runtime/create-hub-game", () => ({ createArpgHubGame: createHubGameMock }));

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("arpg.soundEnabled", "false");
  createHubGameMock.mockReset();
  portraitModeMock.mockReset();
  queryStates.clear();
  createHubGameMock.mockResolvedValue({ destroy: vi.fn(), setPortraitMode: portraitModeMock });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => {
      let state = queryStates.get(media);
      if (!state) { state = { matches: false, listeners: new Set() }; queryStates.set(media, state); }
      const query = state;
      return {
        get matches() { return query.matches; },
        media,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_type: string, listener: () => void) => query.listeners.add(listener)),
        removeEventListener: vi.fn((_type: string, listener: () => void) => query.listeners.delete(listener)),
        dispatchEvent: vi.fn(() => false),
      };
    }),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("ArpgHub session and audio", () => {
  it("preserves the session across rotations and pointer changes while updating the instructions", async () => {
    render(<ArpgHub playerName="Explorador" level={1} coins={500} onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.queryByText("Abrindo a Guilda...")).not.toBeInTheDocument());
    expect(createHubGameMock).toHaveBeenCalledOnce();
    act(() => createHubGameMock.mock.calls[0][3]("WASD, joystick ou direcional movem sua Lenda. Pressione E para interagir."));
    const change = (media: string, matches: boolean) => {
      const query = queryStates.get(media)!;
      act(() => { query.matches = matches; for (const listener of query.listeners) listener(); });
    };
    change("(max-width: 900px) and (orientation: portrait)", true);
    change("(pointer: coarse)", true);
    expect(screen.getByText("Use o joystick para mover. Toque em Interagir para interagir.")).toBeVisible();
    expect(portraitModeMock).toHaveBeenLastCalledWith(true);
    change("(max-width: 900px) and (orientation: portrait)", false);
    expect(portraitModeMock).toHaveBeenLastCalledWith(false);
    expect(createHubGameMock).toHaveBeenCalledOnce();
  });

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
