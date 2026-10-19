// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GuidePage from "./page";

afterEach(() => {
  cleanup();
});

describe("Página Guia do Explorador (/guia)", () => {
  it("renderiza o cabeçalho, rotas de expedições e esquema de controles", () => {
    render(<GuidePage />);

    expect(screen.getByText("Guia do Explorador")).toBeInTheDocument();
    expect(screen.getByText(/Rotas & Fases Sequenciais/i)).toBeInTheDocument();
    expect(screen.getByText("Mata Encantada")).toBeInTheDocument();
    expect(screen.getByText("Arquipélago das Marés")).toBeInTheDocument();
    expect(screen.getByText("Montanhas Rúnicas")).toBeInTheDocument();

    expect(screen.getByText(/Dois Slots de Armas/i)).toBeInTheDocument();
    expect(screen.getByText(/Dois Poderes de Assinatura/i)).toBeInTheDocument();
    expect(screen.getByText(/Esquiva com Invulnerabilidade/i)).toBeInTheDocument();

    expect(screen.getByText("Esquema de Controles")).toBeInTheDocument();
    expect(screen.getByText("Jogar no Navegador")).toBeInTheDocument();
  });
});
