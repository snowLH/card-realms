// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArpgExpeditionSelect } from "./expedition-select";

afterEach(() => {
  cleanup();
});

describe("ArpgExpeditionSelect com fases de mundo sequenciais", () => {
  it("renderiza as expedições disponíveis exibindo a rota das 3 zonas de mundo", () => {
    const onSelect = vi.fn();
    render(<ArpgExpeditionSelect onSelect={onSelect} restoreRemoteRun={false} />);

    expect(screen.getByText("Mata Encantada")).toBeInTheDocument();
    expect(screen.getByText("Arquipélago das Marés")).toBeInTheDocument();
    expect(screen.getByText("Montanhas Rúnicas")).toBeInTheDocument();

    // Verify sequential stages are listed
    expect(screen.getByText("1. Borda da Mata")).toBeInTheDocument();
    expect(screen.getByText("2. Travessia do Boitatá")).toBeInTheDocument();
    expect(screen.getByText("3. Santuário das Raízes")).toBeInTheDocument();

    expect(screen.getByText("1. Costa dos Corais")).toBeInTheDocument();
    expect(screen.getByText("2. Ilhotas Inundadas")).toBeInTheDocument();
    expect(screen.getByText("3. Fossa das Tempestades")).toBeInTheDocument();

    expect(screen.getByText("1. Passagem dos Pinheiros")).toBeInTheDocument();
    expect(screen.getByText("2. Desfiladeiro dos Glaciares")).toBeInTheDocument();
    expect(screen.getByText("3. Muralhas Esquecidas")).toBeInTheDocument();

    // Select first expedition
    const buttons = screen.getAllByRole("button", { name: /Preparar expedição/i });
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith("mata-encantada");
  });

  it("renderiza o botão Voltar à Guilda e o link para o Guia das Rotas", () => {
    const onBack = vi.fn();
    render(<ArpgExpeditionSelect onSelect={vi.fn()} onBack={onBack} restoreRemoteRun={false} />);

    const backButton = screen.getByRole("button", { name: /Voltar à Guilda/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);

    const guideLink = screen.getByRole("link", { name: /Guia das Rotas/i });
    expect(guideLink).toBeInTheDocument();
    expect(guideLink).toHaveAttribute("href", "/guia");
  });
});
