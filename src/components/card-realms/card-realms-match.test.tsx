// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardRealmsMatch } from "./card-realms-match";

afterEach(() => {
  cleanup();
});

describe("CardRealmsMatch — Vertical Slice no Tabuleiro Vivo", () => {
  it("renderiza a Primeira Partida Guiada com Brasil vs Japão, invoca Curupira, transforma terreno e usa Despertar Ancestral", () => {
    render(<CardRealmsMatch playerName="Luzia" />);

    expect(screen.getByText(/CARD REALMS · TABULEIRO VIVO/i)).toBeInTheDocument();
    expect(screen.getByText(/Árvore Ancestral de Pindorama/i)).toBeInTheDocument();
    expect(screen.getByText(/Santuário Torii das Mil Eras/i)).toBeInTheDocument();
    expect(screen.getByText(/Passo 1 — A Lenda Ganha Vida na Floresta/i)).toBeInTheDocument();

    // Step 1: Select Curupira from hand and summon onto Lane 1 (index 0)
    const curupiraCardBtn = screen.getByRole("button", { name: /Guardião dos Pés Virados/i });
    fireEvent.click(curupiraCardBtn);

    const bottomSlot0 = screen.getByTestId("slot-player-0");
    fireEvent.click(bottomSlot0);

    // Curupira is now materialized on Lane 1 with native Mata Encantada synergy (3 base + 2 biome = 5 ATQ / 5 PV)
    expect(bottomSlot0).toHaveTextContent(/Curupira/i);
    expect(bottomSlot0).toHaveTextContent(/⚔️ 5 · ❤️ 5\/5/i);
    expect(screen.getByText(/Passos Invertidos/i)).toBeInTheDocument();

    // Guided banner automatically advances to Step 2
    expect(screen.getByText(/Passo 2 — Expanda Seu Território Vivo/i)).toBeInTheDocument();

    // Step 2: Select Mata Profunda and transform Lane 2 (index 1)
    const mataProfundaBtn = screen.getByRole("button", { name: /Mata Profunda/i });
    fireEvent.click(mataProfundaBtn);

    const bottomSlot1 = screen.getByTestId("slot-player-1");
    fireEvent.click(bottomSlot1);
    expect(bottomSlot1).toHaveTextContent(/Mata Encantada/i);

    // Step 3: End Turn 1 -> Japanese Yokai AI summons Kitsune and advances to Turn 2
    const endTurnBtn = screen.getByRole("button", { name: /Encerrar Turno 1/i });
    fireEvent.click(endTurnBtn);

    expect(screen.getByRole("button", { name: /Encerrar Turno 2/i })).toBeInTheDocument();

    // Select Curupira on Lane 1 and trigger 🔮 DESPERTAR ANCESTRAL (Rastro Invertido)
    fireEvent.click(screen.getByTestId("slot-player-0"));
    const awakeningBtn = screen.getByRole("button", {
      name: /DESPERTAR ANCESTRAL \(Rastro Invertido\)/i,
    });
    expect(awakeningBtn).toBeEnabled();
    fireEvent.click(awakeningBtn);

    expect(screen.getByText(/Despertar Ancestral canalizado com sucesso!/i)).toBeInTheDocument();
  });

  it("permite abrir o Grimório das 22 Cartas e alternar entre os modos e culturas", () => {
    render(<CardRealmsMatch playerName="Explorador" />);

    const grimoireBtn = screen.getByRole("button", { name: /Grimório \(22 Cartas\)/i });
    fireEvent.click(grimoireBtn);

    expect(
      screen.getByText(/GRIMÓRIO FOLCLÓRICO — 🇧🇷 BRASIL VS 🇯🇵 JAPÃO \(22 Cartas Autorais\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Mapinguari")).toBeInTheDocument();
    expect(screen.getByText("Raijū")).toBeInTheDocument();

    // Switch kingdom culture
    const cultureBtn = screen.getByRole("button", { name: /Reino: 🇧🇷 Folclore Brasileiro/i });
    fireEvent.click(cultureBtn);
    expect(screen.getByRole("button", { name: /Reino: 🇯🇵 Folclore Japonês/i })).toBeInTheDocument();
  });

  it("permite abrir o Construtor de Decks e o Modo Campanha Crônicas", () => {
    render(<CardRealmsMatch playerName="Mestre" />);

    // Open Deck Builder
    const deckBuilderBtn = screen.getByRole("button", { name: /Forja/i });
    fireEvent.click(deckBuilderBtn);
    expect(screen.getByText(/FORJA DO REINO — CONSTRUTOR DE BARALHOS/i)).toBeInTheDocument();

    // Close Deck Builder
    const closeDeckBtn = screen.getByRole("button", { name: /Fechar Construtor de Baralhos/i });
    fireEvent.click(closeDeckBtn);

    // Open Campaign
    const campaignBtn = screen.getByRole("button", { name: /Campanha/i });
    fireEvent.click(campaignBtn);
    expect(screen.getByText(/CRÔNICAS DE AURÓRIA — CAMPANHA FOLCLÓRICA MUNDIAL/i)).toBeInTheDocument();
  });
});
