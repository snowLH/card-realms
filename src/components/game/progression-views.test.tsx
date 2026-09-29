// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CREATURES } from "@/game/catalog";
import { CollectionView } from "./collection-view";
import { TeamView } from "./team-view";

describe("telas de progressão da conta", () => {
  it("mostra somente a carta inicial na equipe e mantém cinco espaços vazios", () => {
    render(<TeamView teamIds={["iara"]} teamName="Equipe principal" />);

    expect(screen.getByText("Iara")).toBeInTheDocument();
    expect(screen.queryByText("Boitatá")).not.toBeInTheDocument();
    expect(screen.getByText("1/6 cartas vinculadas")).toBeInTheDocument();
    expect(screen.getAllByText("Espaço vazio")).toHaveLength(5);
  });

  it("oculta nome, arte e atributos das cartas ainda não encontradas", () => {
    render(<CollectionView ownedCatalogIds={["iara"]} />);

    expect(screen.getAllByText("Iara").length).toBeGreaterThan(0);
    expect(screen.queryByText("Boitatá")).not.toBeInTheDocument();
    expect(screen.getAllByText("Carta não descoberta")).toHaveLength(CREATURES.length - 1);
    expect(screen.getByText(`1/${CREATURES.length}`)).toBeInTheDocument();
  });
});
