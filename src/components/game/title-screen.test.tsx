// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleScreen } from "./title-screen";

vi.mock("@/components/auth/login-dialog", () => ({ LoginDialog: () => null }));

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("arpg.soundEnabled", "false");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("TitleScreen audio setting", () => {
  it("restores the shared preference and lets the player change it accessibly", async () => {
    render(<TitleScreen loginEnabled={false} signedIn onPlay={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "CONFIGURAÇÕES" }));

    const audioSetting = await screen.findByRole("checkbox");
    expect(audioSetting).not.toBeChecked();
    fireEvent.click(audioSetting);

    expect(window.localStorage.getItem("arpg.soundEnabled")).toBe("true");
    expect(audioSetting).toBeChecked();
  });
});
