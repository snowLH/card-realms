// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionView } from "./collection-view";
import { TeamView } from "./team-view";
import { VillageView } from "./village-view";

const iaraInstanceId = "00000000-0000-4000-8000-000000000101";
const teamId = "00000000-0000-4000-8000-000000000201";
const ownedIara = {
  instanceId: iaraInstanceId,
  catalogId: "iara",
  nickname: null,
  level: 1,
  xp: 0,
  bond: 0,
  variant: "standard",
  acquiredFrom: "starter",
  acquiredAt: "2026-10-01T12:00:00.000Z",
  evolutionStage: 0,
};

describe("telas de progressão da conta", () => {
  it("mostra somente a carta inicial na equipe e mantém cinco espaços vazios", () => {
    render(
      <TeamView
        team={{
          id: teamId,
          name: "Equipe principal",
          isActive: true,
          members: [{
            slot: 1,
            playerCreatureId: iaraInstanceId,
            catalogId: "iara",
            evolutionStage: 0,
          }],
        }}
        collection={[ownedIara]}
        source="local"
      />,
    );

    expect(screen.getAllByText("Gota de Iara").length).toBeGreaterThan(0);
    expect(screen.queryByText("Boitatá")).not.toBeInTheDocument();
    expect(screen.getByText("1/6 cartas selecionadas")).toBeInTheDocument();
    expect(screen.getAllByText("Espaço vazio")).toHaveLength(5);
  });

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
