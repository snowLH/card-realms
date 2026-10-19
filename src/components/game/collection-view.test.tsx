// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionView } from "./collection-view";

afterEach(() => {
  cleanup();
});

describe("CollectionView (Bestiário)", () => {
  it("renderiza o Bestiário com catálogo de criaturas, contagem e filtro de busca", () => {
    const onBack = vi.fn();
    render(<CollectionView onBack={onBack} />);

    expect(screen.getByRole("heading", { level: 1, name: "Bestiário de Folklard" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nome, habitat, origem ou traço/i)).toBeInTheDocument();

    // Verify back button
    const backBtn = screen.getByRole("button", { name: /Voltar à Guilda/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);

    // Filter by searching
    const searchInput = screen.getByPlaceholderText(/Nome, habitat, origem ou traço/i);
    fireEvent.change(searchInput, { target: { value: "Curupira" } });

    // Should find Curupira entry
    expect(screen.getAllByText(/Curupira/i).length).toBeGreaterThan(0);
  });
});
