// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionView } from "./collection-view";
import { VillageView } from "./village-view";

describe("telas de progressão da conta", () => {
  it("mantém o Bestiário público para consultar monstros e chefes", () => {
    render(<CollectionView ownedCatalogIds={["iara"]} />);

    expect(screen.getAllByText("Gota de Iara").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Boitatá").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carta não descoberta")).not.toBeInTheDocument();
    expect(screen.getByText("Bestiário de Folklard")).toBeInTheDocument();
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
