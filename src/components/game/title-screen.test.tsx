// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "CONFIGURAÇÕES" })).toHaveFocus());
  });
});

describe("TitleScreen navigation", () => {
  it("keeps guest play, cooperative entry and the installer link available", () => {
    const onPlay = vi.fn();
    const onCooperative = vi.fn();
    render(<TitleScreen loginEnabled signedIn={false} onPlay={onPlay} onCooperative={onCooperative} />);

    fireEvent.click(screen.getByRole("button", { name: "JOGAR Começar como visitante" }));
    fireEvent.click(screen.getByRole("button", { name: "COOPERATIVO Dungeons com amigos" }));

    expect(onPlay).toHaveBeenCalledOnce();
    expect(onCooperative).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Baixar Folklard para PC ou celular" })).toHaveAttribute("href", "/instalar");
    expect(screen.getByText("Visitante · o progresso fica salvo neste aparelho.")).toBeVisible();
  });

  it("explains signed-in persistence and disables unavailable cooperative entry", () => {
    render(<TitleScreen loginEnabled signedIn onPlay={vi.fn()} />);

    expect(screen.getByRole("button", { name: "JOGAR Entrar na Guilda" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "COOPERATIVO Dungeons com amigos" })).toBeDisabled();
    expect(screen.getByText("Seu progresso está vinculado à sua conta.")).toBeVisible();
  });
});
