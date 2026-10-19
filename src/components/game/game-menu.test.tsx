// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameMenu } from "./game-menu";

vi.mock("@/components/auth/login-dialog", () => ({ LoginDialog: () => <button type="button">Conta e progresso</button> }));

afterEach(() => {
  cleanup();
});

describe("GameMenu", () => {
  it("abre o diálogo do menu exibindo os dados do jogador e as opções expandidas", () => {
    const onNavigate = vi.fn();
    render(
      <GameMenu
        currentView="hub"
        playerName="Luzia"
        level={5}
        coins={1250}
        onNavigate={onNavigate}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Abrir menu do jogo" });
    fireEvent.click(trigger);

    expect(screen.getByText("Luzia")).toBeInTheDocument();
    expect(screen.getByText(/Nv\. 5/)).toBeInTheDocument();
    expect(screen.getByText(/1\.250 moedas/)).toBeInTheDocument();

    // Verify all menu options
    expect(screen.getByRole("button", { name: /Expedições/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arsenal da Lenda/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ataques da Lenda/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lendas jogáveis/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refúgio do Explorador/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bestiário das Lendas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Perfil do Cartógrafo/i })).toBeInTheDocument();

    // Verify Guide link
    expect(screen.getByRole("link", { name: /Guia do Explorador/i })).toHaveAttribute("href", "/guia");

    // Clicking an option calls onNavigate with the correct action
    fireEvent.click(screen.getByRole("button", { name: /Expedições/i }));
    expect(onNavigate).toHaveBeenCalledWith("expeditions");
  });

  it("exibe o botão 'Voltar à Guilda' quando a visão atual não é o hub", () => {
    const onNavigate = vi.fn();
    render(
      <GameMenu
        currentView="other"
        playerName="Luzia"
        level={3}
        coins={400}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu do jogo" }));

    const returnBtn = screen.getByRole("button", { name: /Voltar à Guilda/i });
    expect(returnBtn).toBeInTheDocument();

    fireEvent.click(returnBtn);
    expect(onNavigate).toHaveBeenCalledWith("lobby");
  });
});
