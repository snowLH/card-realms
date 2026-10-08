// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionView } from "./collection-view";
import { VillageView } from "./village-view";

afterEach(() => cleanup());

describe("telas de progressão da conta", () => {
  it("mantém o Bestiário público para consultar monstros e chefes", () => {
    render(<CollectionView ownedCatalogIds={["iara"]} />);

    expect(screen.getByText("Bestiário de Folklard")).toBeInTheDocument();
    const search = screen.getByPlaceholderText("Nome, habitat, origem ou traço");
    fireEvent.change(search, { target: { value: "Iara" } });
    expect(screen.getAllByRole("button", { name: /Abrir ficha de .*Iara/i }).length).toBeGreaterThan(0);
    fireEvent.change(search, { target: { value: "Boitatá" } });
    expect(screen.getAllByRole("button", { name: /Abrir ficha de .*Boitatá/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Carta não descoberta")).not.toBeInTheDocument();
  });

  it("mantém a loja focada em suprimentos e cosméticos sem ofertas de armadura", () => {
    render(
      <VillageView
        coins={500}
        ownedItemKeys={[]}
        onBack={vi.fn()}
        onBuyItem={vi.fn()}
      />,
    );

    expect(screen.queryByText("Mercadora de energias")).not.toBeInTheDocument();
    expect(screen.getByText("Itens e cosméticos")).toBeInTheDocument();
    expect(screen.getByText(/Armas e relíquias são conquistadas nas masmorras/i)).toBeInTheDocument();
    expect(screen.queryByText(/armadura|armor/i)).not.toBeInTheDocument();
    expect(screen.getByText("Estante de Lendas")).toBeInTheDocument();
  });
});
